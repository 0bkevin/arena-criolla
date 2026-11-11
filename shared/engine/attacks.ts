// Starting, timing and landing attacks, specials and definitives.
import { WORLD } from "./arena";
import { ARENA_FINALES, isArenaFinalist } from "./finales/arena-finales";
import { SUPER_ENERGY_COST, fighterById } from "../roster/roster";
import { beginFieldFinale } from "./finales/field-finales";
import {
  FINALE_CAPTURE_TICK,
  FINALE_RANGE,
  finaleById,
  type FinaleDefinition,
} from "./finales/finales";
import { TECHNIQUES, type Technique } from "./techniques";
import { effect, hurt, outgoingDamageMultiplier } from "./combat";
import { beginFinale } from "./capture-finale";
import {
  opponentOf,
  type Attack,
  type MatchState,
  type PlayerIndex,
} from "./types";

export function canUseSuper(s: MatchState, i: PlayerIndex) {
  const p = s.players[i];
  return (
    !p.superUsed &&
    p.energy >= SUPER_ENERGY_COST &&
    !s.fieldFinales?.some((field) => field.owner === i) &&
    !s.projectiles.some((shot) => shot.owner === i && shot.tether) &&
    (!(p.config.fighter === "dayana" || isArenaFinalist(p.config.fighter)) ||
      p.grounded)
  );
}

export function canBeginAttack(
  s: MatchState,
  i: PlayerIndex,
  attack: NonNullable<Attack>,
) {
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  // One physical handheld object: it must be caught before another attack starts.
  if (s.projectiles.some((shot) => shot.owner === i && shot.tether))
    return false;
  if (
    attack === "special" &&
    (p.config.wins < (def.specialUnlockWins ?? 0) ||
      (TECHNIQUES[def.ability].requiresGround && !p.grounded))
  )
    return false;
  if (attack === "super" && !canUseSuper(s, i)) return false;
  if (attack === "special" && p.energy < 25) return false;
  return true;
}

export function beginAttack(
  s: MatchState,
  i: PlayerIndex,
  attack: NonNullable<Attack>,
) {
  if (!canBeginAttack(s, i, attack)) return;
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  if (attack === "special") p.energy -= 25;
  if (attack === "super") {
    p.energy -= SUPER_ENERGY_COST;
    p.superUsed = true;
    p.superChargeTicks = 0;
  }
  p.attack = attack;
  p.attackTick = 0;
  p.attackHit = false;
  p.countered = false;
  p.comboBonus = 0;
  p.cooldown =
    attack === "light"
      ? 21
      : attack === "heavy"
        ? 33
        : attack === "special"
          ? TECHNIQUES[def.ability].recovery + 1
          : finaleById(p.config.fighter)?.mode === "projectile"
            ? finaleById(p.config.fighter)!.duration + 1
            : 42;
  if (attack === "super" && p.config.fighter === "dayana") p.cooldown = 190;
  if (attack === "super" && isArenaFinalist(p.config.fighter))
    p.cooldown = ARENA_FINALES[p.config.fighter].recovery + FINALE_CAPTURE_TICK;
  p.history = p.history.filter((h) => s.tick - h.tick < 150);
  p.history.push({ action: attack, tick: s.tick });
  if (p.history.length > 3) p.history.shift();
  const sequence = p.history.map((h) => h.action).join(",");
  if (sequence.endsWith("light,heavy")) {
    p.combo = def.combos[0];
    p.comboTick = s.tick;
    p.comboBonus = 3;
  }
  if (sequence === "light,light,heavy") {
    p.combo = def.combos[1];
    p.comboTick = s.tick;
    p.comboBonus = 7;
  }
  if (attack === "super") {
    p.combo = def.combos[2];
    p.comboTick = s.tick;
    p.comboBonus = 12;
  }
  if (
    attack === "special" ||
    (attack === "super" &&
      def.id !== "dorangel" &&
      finaleById(p.config.fighter)?.mode !== "projectile")
  )
    effect(s, p.x, p.y - 75, "special", def.color, {
      owner: i,
      impact: attack,
      direction: p.facing,
    });
}

export function reflectProjectiles(s: MatchState, i: PlayerIndex) {
  const p = s.players[i];
  if (p.attack !== "special") return;
  const def = fighterById(p.config.fighter);
  const technique = TECHNIQUES[def.ability];
  if (
    technique.reflect &&
    p.attackTick >= technique.reflect.from &&
    p.attackTick <= technique.reflect.to
  ) {
    for (const shot of s.projectiles) {
      const dx = shot.x - p.x;
      if (
        shot.owner !== i &&
        dx * p.facing >= -20 &&
        Math.abs(dx) < technique.reflect.radius &&
        Math.abs(shot.y - (p.y - 75)) < 95
      ) {
        if (shot.tether) {
          if (shot.connected) continue;
          // A cable cannot change owners. A parry bats the head back along it.
          shot.returning = true;
          shot.connected = true;
          effect(s, shot.x, shot.y, "block", def.color, {
            owner: i,
            impact: "special",
            direction: p.facing,
          });
          continue;
        }
        shot.owner = i;
        shot.direction = p.facing;
        shot.vx = p.facing * Math.max(6, Math.abs(shot.vx));
        shot.vy = -(shot.vy ?? 0);
        shot.returnAfter = undefined;
        shot.plantAfter = undefined;
        shot.armAfter = undefined;
        shot.life = Math.max(30, shot.life);
        effect(s, shot.x, shot.y, "special", def.color, {
          owner: i,
          impact: "special",
          direction: p.facing,
        });
      }
    }
  }
}

export function updateAttack(s: MatchState, i: PlayerIndex) {
  const p = s.players[i];
  if (!p.attack) return;
  const attack = p.attack;
  const def = fighterById(p.config.fighter);
  const technique = TECHNIQUES[def.ability];
  const activeAt =
    attack === "light"
      ? 6
      : attack === "heavy"
        ? 11
        : attack === "special"
          ? technique.startup
          : FINALE_CAPTURE_TICK;
  const finale = attack === "super" ? finaleById(p.config.fighter) : undefined;
  if (finale && advanceStandaloneDefinitive(s, i, finale, activeAt)) return;
  const movingStrike =
    attack === "special" &&
    Boolean(technique.dash) &&
    !technique.projectile &&
    !technique.pulses;
  const pulseIndex = movingStrike
    ? p.attackTick >= activeAt &&
      p.attackTick < activeAt + (technique.dash?.ticks ?? 0) &&
      !p.attackHit
      ? 0
      : -1
    : attack === "special"
      ? (technique.pulses || [0]).findIndex(
          (offset) => p.attackTick === activeAt + offset,
        )
      : p.attackTick === activeAt && !p.attackHit
        ? 0
        : -1;
  if (pulseIndex >= 0) {
    if (!movingStrike) p.attackHit = true;
    if (attack === "special" && pulseIndex === 0 && p.attackTick === activeAt)
      applySpecialMovement(s, i, technique);
    const danceStep =
      attack === "special" &&
      technique.steps?.find((step) => step.pulse === pulseIndex);
    if (danceStep && !p.rootTicks) {
      p.vx = p.facing * danceStep.speed * (p.slowTicks ? 0.6 : 1);
      p.recoilVx = 0;
      p.dash = danceStep.ticks;
      if (danceStep.lift) {
        p.vy = danceStep.lift;
        p.grounded = false;
        p.supportPlatform = null;
      }
    }
    if (attack === "special" && technique.projectile) {
      if (technique.requiresGround && !p.grounded) return;
      spawnTechniqueProjectiles(s, i, technique, technique.projectile);
    } else if (strike(s, i, attack, technique, pulseIndex, movingStrike))
      return;
  }
  if (p.attackTick >= recoveryTicks(attack, technique)) p.attack = null;
}

/**
 * Field, projectile and transformation definitives run their own timeline
 * instead of the strike below. Returns false for capture definitives.
 */
function advanceStandaloneDefinitive(
  s: MatchState,
  i: PlayerIndex,
  finale: FinaleDefinition,
  activeAt: number,
): boolean {
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  if (finale.mode === "field") {
    if (p.attackTick === activeAt && !p.attackHit) {
      p.attackHit = true;
      beginFieldFinale(
        s,
        i,
        (28 * def.damage + p.comboBonus) * outgoingDamageMultiplier(p),
      );
    }
    if (p.config.fighter === "deyna" && p.attackTick >= 24) {
      p.attack = null;
      p.cooldown = 0;
    }
    return true;
  }
  if (finale.mode === "projectile") {
    const shot = finale.projectile;
    if (p.attackTick === activeAt && !p.attackHit && shot) {
      p.attackHit = true;
      s.projectiles.push({
        id: s.nextId++,
        owner: i,
        direction: p.facing,
        x: p.x + p.facing * shot.offsetX,
        y: p.y - shot.offsetY,
        vx: p.facing * shot.speed,
        life: shot.life,
        age: 0,
        kind: shot.kind,
        impact: "super",
        radius: shot.radius,
        growth: shot.growth,
        maxRadius: shot.maxRadius,
        force: shot.force,
        damage: (28 * def.damage + p.comboBonus) * outgoingDamageMultiplier(p),
      });
      effect(
        s,
        p.x + p.facing * shot.offsetX,
        p.y - shot.offsetY,
        "special",
        def.color,
        { owner: i, impact: "super", direction: p.facing, strength: 1.4 },
      );
    }
    if (p.attackTick >= finale.duration) p.attack = null;
    return true;
  }
  if (finale.mode === "transformation") {
    if (p.attackTick === activeAt && !p.attackHit && finale.empowerment) {
      p.attackHit = true;
      p.transformation = {
        id: finale.empowerment.id,
        ticks: finale.empowerment.duration,
        damageMultiplier: finale.empowerment.damageMultiplier,
      };
    }
    if (p.attackTick > 36) p.attack = null;
    return true;
  }
  return false;
}

/** Launch a special's projectile, or its spread or formation of them. */
function spawnTechniqueProjectiles(
  s: MatchState,
  i: PlayerIndex,
  technique: Technique,
  projectile: NonNullable<Technique["projectile"]>,
) {
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  const count = projectile.count || 1;
  for (let note = 0; note < count; note++) {
    s.projectiles.push({
      id: s.nextId++,
      owner: i,
      direction: p.facing,
      x:
        p.x +
        p.facing *
          ((projectile.offsetX ?? 48) +
            (note - (count - 1) / 2) * (projectile.spacing ?? 0)),
      y: p.y - (projectile.offsetY ?? (projectile.groundOnly ? 42 : 75)),
      originY: p.y - 75,
      vx: p.facing * projectile.speed,
      vy:
        (projectile.initialVy ?? 0) +
        (note - (count - 1) / 2) * (projectile.spread || 0),
      age: 0,
      formationIndex: projectile.spacing ? note : undefined,
      hitInvincibility: projectile.hitInvincibility,
      returnAfter: projectile.returnAfter,
      tether: projectile.tether ? { ...projectile.tether } : undefined,
      life: projectile.life,
      kind: def.ability,
      damage: technique.damage * def.damage * outgoingDamageMultiplier(p),
      force: technique.force,
      wave: projectile.wave,
      acceleration: projectile.acceleration,
      maxSpeed: projectile.maxSpeed,
      gravity: projectile.gravity,
      homing: projectile.homing,
      pulls: projectile.pulls,
      groundOnly: projectile.groundOnly,
      slowTicks: projectile.slowTicks,
      blastRadius: projectile.blastRadius,
      bounces: projectile.bounces,
      radius: projectile.radius,
      growth: projectile.growth,
      maxRadius: projectile.maxRadius,
      plantAfter: projectile.plantAfter,
      armAfter: projectile.armAfter,
    });
  }
}

/**
 * Land a melee pulse on the rival if it is in reach. Returns true when the hit
 * opened a capture definitive, which takes over the rest of this tick.
 */
function strike(
  s: MatchState,
  i: PlayerIndex,
  attack: NonNullable<Attack>,
  technique: Technique,
  pulseIndex: number,
  movingStrike: boolean,
): boolean {
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  const other = s.players[opponentOf(i)];
  let range = attack === "light" ? 110 : attack === "heavy" ? 155 : 165;
  if (attack === "super") range = FINALE_RANGE;
  if (attack === "special") {
    range =
      (movingStrike
        ? (technique.contactRange ?? technique.range)
        : technique.range) +
      pulseIndex *
        (technique.pulseRangeStep ?? (def.ability === "echo" ? 70 : 90));
    const mirrored = technique.mirrorPulse === pulseIndex;
    const behindRival = mirrored && Math.abs(other.x - p.x) < range;
    effect(
      s,
      behindRival
        ? other.x + p.facing * 90
        : p.x +
            p.facing *
              (technique.aimed
                ? Math.min(range - 50, Math.abs(other.x - p.x))
                : 35),
      behindRival ? other.y - 75 : technique.groundOnly ? p.y - 5 : p.y - 75,
      "special",
      def.color,
      {
        owner: i,
        impact: attack,
        direction: mirrored ? -p.facing : p.facing,
      },
    );
  }
  const dx = other.x - p.x;
  const inFront =
    dx * p.facing > -30 ||
    (attack === "special" &&
      (technique.radial || technique.mirrorPulse === pulseIndex));
  if (
    Math.abs(dx) < range &&
    Math.abs(p.y - other.y) < (attack === "special" ? technique.height : 120) &&
    !(
      attack === "special" &&
      technique.groundOnly &&
      (!p.grounded || !other.grounded)
    ) &&
    inFront
  ) {
    if (attack === "super" && finaleById(p.config.fighter)) {
      beginFinale(s, i);
      return true;
    }
    const damage =
      (attack === "light"
        ? 7
        : attack === "heavy"
          ? 13
          : attack === "super"
            ? 28
            : technique.damage) *
        def.damage +
      p.comboBonus;
    const healthBefore = other.hp;
    const supportBefore = other.supportPlatform;
    const connected = hurt(
      s,
      i,
      damage * outgoingDamageMultiplier(p),
      attack === "light"
        ? 4.5
        : attack === "super"
          ? 12
          : attack === "special"
            ? pulseIndex === (technique.pulses?.length ?? 1) - 1
              ? (technique.finisherForce ?? technique.force)
              : technique.force
            : 8,
      attack === "special" && technique.mirrorPulse === pulseIndex
        ? -p.facing
        : dx >= 0
          ? 1
          : -1,
      other.x,
      other.y - 80,
      attack,
      attack === "special" ? technique.hitInvincibility : undefined,
    );
    if (movingStrike && connected) p.attackHit = true;
    if (attack === "special" && technique.snare && other.hp < healthBefore) {
      other.rootTicks = technique.snare;
      if (def.ability === "bite") other.rootKind = "bite";
      else delete other.rootKind;
      other.vx = 0;
      other.recoilVx = 0;
      other.vy = 0;
      other.grounded = true;
      other.supportPlatform = supportBefore;
    }
  }
  return false;
}

function recoveryTicks(attack: NonNullable<Attack>, technique: Technique) {
  return attack === "light"
    ? 20
    : attack === "heavy"
      ? 32
      : attack === "special"
        ? technique.recovery
        : 40;
}

function applySpecialMovement(
  s: MatchState,
  i: PlayerIndex,
  technique: Technique,
) {
  const p = s.players[i];
  if (p.rootTicks > 0) return;
  if (technique.blink) {
    const other = s.players[opponentOf(i)];
    const distance = Math.max(0, Math.abs(other.x - p.x) - technique.blink.gap);
    const startX = p.x;
    p.x = Math.max(
      WORLD.left,
      Math.min(
        WORLD.right,
        p.x + p.facing * Math.min(technique.blink.reach, distance),
      ),
    );
    p.invincible = Math.max(p.invincible, technique.blink.invincibility);
    effect(
      s,
      startX,
      p.y - 75,
      "special",
      fighterById(p.config.fighter).color,
      { owner: i, direction: p.facing, impact: "special" },
    );
  }
  if (technique.dash) {
    p.vx = p.facing * technique.dash.speed * (p.slowTicks ? 0.6 : 1);
    p.recoilVx = 0;
    p.dash = technique.dash.ticks;
    p.invincible = Math.max(p.invincible, technique.dash.invincibility);
  }
  const lift = technique.lift ?? technique.dash?.lift;
  if (lift) {
    p.vy = lift;
    p.grounded = false;
    p.supportPlatform = null;
  }
}
