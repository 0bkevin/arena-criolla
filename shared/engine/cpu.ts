// The single-player opponent. Reads the match and presses buttons as player 2.
import { WORLD } from "./arena";
import { SUPER_ENERGY_COST, fighterById } from "../roster/roster";
import { arenaFinaleInRange, isArenaFinalist } from "./finales/arena-finales";
import { finaleById } from "./finales/finales";
import { TECHNIQUES } from "./techniques";
import type { Input, MatchState, PlayerState } from "./types";

export function cpuInput(
  s: MatchState,
  previous: Input,
  difficulty: "easy" | "normal" | "hard",
): Input {
  const next: Input = { ...previous, actions: { ...previous.actions } };
  const p = s.players[1];
  const other = s.players[0];
  next.superHeld = false;
  const dx = other.x - p.x;
  next.left = dx < -86;
  next.right = dx > 86;
  next.down =
    p.grounded &&
    p.supportPlatform !== null &&
    p.supportPlatform >= 0 &&
    other.y > p.y + 80 &&
    Math.abs(dx) < 180;
  if (p.superChargeTicks > 0) {
    next.superHeld = true;
    next.block = false;
    next.down = false;
    return next;
  }
  next.block =
    difficulty !== "easy" &&
    (other.attack === "heavy" || other.attack === "special") &&
    Math.abs(dx) < 220 &&
    s.tick % 90 < 45;
  const cadence =
    difficulty === "easy" ? 68 : difficulty === "normal" ? 38 : 24;
  if (s.tick % cadence === 0 && p.cooldown === 0 && Math.abs(dx) < 165)
    next.actions[s.tick % 3 === 0 ? "heavy" : "light"]++;
  const def = fighterById(p.config.fighter);
  const technique = TECHNIQUES[def.ability];
  const defensiveOpportunity = technique.reflect
    ? s.projectiles.some(
        (shot) =>
          shot.owner !== 1 &&
          Math.abs(shot.x - p.x) < 290 &&
          Math.abs(shot.y - (p.y - 75)) < 95,
      )
    : technique.counter
      ? !!other.attack && Math.abs(dx) < technique.counter.range
      : false;
  const projectile = technique.projectile;
  // Returning shots reverse before their full lifetime; the CPU must close the gap first.
  const projectileReach = projectile?.returnAfter
    ? Math.min(
        540,
        48 +
          projectile.speed * projectile.returnAfter +
          (projectile.radius ?? 22),
      )
    : 540;
  const specialInRange = projectile
    ? Math.abs(dx) > 165 && Math.abs(dx) < projectileReach
    : Math.abs(dx) < technique.range - 15;
  if (
    ((specialInRange && s.tick % 100 === 0) ||
      (defensiveOpportunity && s.tick % 12 === 0)) &&
    p.energy >= 25 &&
    p.config.wins >= (def.specialUnlockWins ?? 0)
  ) {
    if (defensiveOpportunity) next.block = false;
    next.actions.special++;
  }
  if (
    (other.y < p.y - 70 ||
      (p.jumps === 1 && !p.grounded && other.y < p.y && p.vy > -2) ||
      p.x < WORLD.left + 30 ||
      p.x > WORLD.right - 30) &&
    p.jumps < 2 &&
    s.tick % 34 === 0
  )
    next.actions.jump++;
  if (
    difficulty === "hard" &&
    !p.superUsed &&
    p.energy >= SUPER_ENERGY_COST &&
    definitiveInReach(s, p, other, dx) &&
    s.tick % 90 === 0
  ) {
    next.actions.super++;
    next.superHeld = true;
    next.block = false;
  }
  return next;
}

/** Whether the CPU's definitive would reach its rival from where it stands. */
function definitiveInReach(
  s: MatchState,
  p: PlayerState,
  other: PlayerState,
  dx: number,
): boolean {
  const finale = finaleById(p.config.fighter);
  if (finale?.mode === "field")
    return (
      !s.fieldFinales?.some((field) => field.owner === 1) &&
      (isArenaFinalist(p.config.fighter)
        ? arenaFinaleInRange(p, other)
        : (p.config.fighter !== "dayana" || p.grounded) && Math.abs(dx) < 520)
    );
  if (finale?.mode === "transformation") return !p.transformation;
  if (finale?.mode === "projectile") {
    const shot = finale.projectile;
    return (
      shot !== undefined &&
      Math.abs(dx) < shot.speed * (shot.life - 1) &&
      Math.abs(other.y - p.y) < 100
    );
  }
  return Math.abs(dx) < 210;
}
