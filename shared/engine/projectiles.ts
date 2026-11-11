// Projectile flight, tethers, blasts and hits.
import { WORLD } from "./arena";
import { fighterById } from "../roster/roster";
import { effect, hurt } from "./combat";
import type { MatchState } from "./types";

/** Advance every projectile one tick and resolve the ones that land. */
export function advanceProjectiles(s: MatchState) {
  // Snapshot interruption before any projectile lands: simultaneous wired casts
  // get the same chance to connect on either player side.
  const tetherOwners = s.players.map((p) => ({
    alive: p.hp > 0 && p.stocks > 0,
    interrupted: p.attack !== "special" || p.stun > 0,
  }));
  s.projectiles = s.projectiles.filter((projectile) => {
    projectile.age = (projectile.age || 0) + 1;
    const target = s.players[1 - projectile.owner];
    if (projectile.tether) {
      const owner = s.players[projectile.owner];
      if (!tetherOwners[projectile.owner].alive) return false;
      if (tetherOwners[projectile.owner].interrupted) {
        projectile.returning = true;
        projectile.connected = true;
      }
      if (projectile.age >= (projectile.returnAfter ?? Infinity))
        projectile.returning = true;
      if (
        projectile.x + projectile.vx < WORLD.x + 16 ||
        projectile.x + projectile.vx > WORLD.x + WORLD.width - 16
      )
        projectile.returning = true;
      if (projectile.returning) {
        const direction = projectile.direction ?? owner.facing;
        const dx =
          owner.x + direction * projectile.tether.catchX - projectile.x;
        const dy = owner.y - projectile.tether.catchY - projectile.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= projectile.tether.returnSpeed) return false;
        projectile.vx = (dx / distance) * projectile.tether.returnSpeed;
        projectile.vy = (dy / distance) * projectile.tether.returnSpeed;
      }
    }
    if (projectile.plantAfter && projectile.age >= projectile.plantAfter) {
      projectile.vx = 0;
      projectile.vy = 0;
      projectile.y = WORLD.floor - 42;
    }
    if (projectile.growth)
      projectile.radius = Math.min(
        projectile.maxRadius ?? 48,
        (projectile.radius ?? 12) + projectile.growth,
      );
    if (
      !projectile.tether &&
      projectile.returnAfter &&
      projectile.age === projectile.returnAfter
    )
      projectile.vx *= -1;
    if (projectile.acceleration)
      projectile.vx =
        Math.sign(projectile.vx) *
        Math.min(
          projectile.maxSpeed ?? 20,
          Math.abs(projectile.vx) + projectile.acceleration,
        );
    if (projectile.gravity)
      projectile.vy = (projectile.vy || 0) + projectile.gravity;
    projectile.x += projectile.vx;
    projectile.y += projectile.vy || 0;
    if (projectile.wave)
      projectile.y =
        (projectile.originY ?? projectile.y) +
        Math.sin((projectile.age * Math.PI * 2) / projectile.wave.period) *
          projectile.wave.amplitude;
    if (projectile.homing)
      projectile.y += Math.max(
        -projectile.homing,
        Math.min(projectile.homing, target.y - 75 - projectile.y),
      );
    projectile.life--;
    if (projectile.gravity && projectile.y >= WORLD.floor - 20) {
      if (projectile.bounces && projectile.bounces > 0) {
        projectile.y = WORLD.floor - 21;
        projectile.vy = -Math.abs(projectile.vy ?? 0) * 0.75;
        projectile.bounces--;
      } else projectile.life = 0;
    }
    if (projectile.life <= 0) {
      if (projectile.blastRadius) {
        effect(
          s,
          projectile.x,
          projectile.y,
          "special",
          fighterById(s.players[projectile.owner].config.fighter).color,
          { owner: projectile.owner, impact: "special", strength: 1.5 },
        );
        if (
          Math.abs(target.x - projectile.x) < projectile.blastRadius &&
          Math.abs(target.y - 60 - projectile.y) < 100
        )
          hurt(
            s,
            projectile.owner,
            projectile.damage,
            projectile.force ?? 7,
            target.x >= projectile.x ? 1 : -1,
            target.x,
            target.y - 60,
            projectile.impact ?? "special",
          );
      }
      return false;
    }
    if (
      !projectile.connected &&
      (!projectile.armAfter || projectile.age >= projectile.armAfter) &&
      Math.abs(target.x - projectile.x) <
        (projectile.radius ? 20 + projectile.radius : 42) &&
      projectile.y > target.y - 135 - (projectile.radius ?? 0) &&
      projectile.y < target.y - 10 + (projectile.radius ?? 0) &&
      (!projectile.groundOnly || target.grounded)
    ) {
      const healthBefore = target.hp;
      if (
        hurt(
          s,
          projectile.owner,
          projectile.damage,
          projectile.force ?? 7,
          Math.sign(projectile.vx) || projectile.direction || 1,
          target.x,
          projectile.y,
          projectile.impact ?? "special",
          projectile.hitInvincibility,
        )
      ) {
        if (target.hp < healthBefore) {
          if (projectile.pulls) {
            const source = s.players[projectile.owner];
            target.vx = (source.x >= target.x ? 1 : -1) * Math.abs(target.vx);
            target.recoilVx = target.vx;
          }
          if (projectile.slowTicks)
            target.slowTicks = Math.max(target.slowTicks, projectile.slowTicks);
        }
        if (projectile.blastRadius)
          effect(
            s,
            projectile.x,
            projectile.y,
            "special",
            fighterById(s.players[projectile.owner].config.fighter).color,
            { owner: projectile.owner, impact: "special", strength: 1.5 },
          );
        if (projectile.tether) {
          projectile.connected = true;
          projectile.returning = true;
          return true;
        }
        return false;
      }
    }
    return (
      projectile.life > 0 &&
      projectile.x > WORLD.x - 50 &&
      projectile.x < WORLD.x + WORLD.width + 50
    );
  });
}
