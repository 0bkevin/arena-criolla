// Contact between fighters: guards, counters, damage, launch and its effects.
import { SUPER_INTERRUPT_ENERGY_COST, fighterById } from "../roster/roster";
import { TECHNIQUES } from "./techniques";
import {
  opponentOf,
  type Attack,
  type Effect,
  type MatchState,
  type PlayerIndex,
  type PlayerState,
} from "./types";

/** Snapshot once for new attacks; reflected shots retain their original damage. */
export function outgoingDamageMultiplier(player: PlayerState): number {
  return player.transformation && player.transformation.ticks > 0
    ? player.transformation.damageMultiplier
    : 1;
}

export function effect(
  s: MatchState,
  x: number,
  y: number,
  kind: Effect["kind"],
  color: string,
  details: Partial<
    Pick<Effect, "owner" | "impact" | "strength" | "direction" | "visual">
  > = {},
) {
  const duration = kind === "ringout" ? 40 : kind === "hit" ? 26 : 18;
  s.effects.push({
    id: s.nextId++,
    x,
    y,
    kind,
    color,
    life: duration,
    duration,
    ...details,
  });
  if (s.effects.length > 40) s.effects.shift();
}

// Guard and counter rules are shared by normal contact and cinematic capture.
// A defended hit consumes the attack without starting a scene or doing damage.
export function interceptHit(
  s: MatchState,
  attacker: PlayerIndex,
  direction: number,
  x: number,
  y: number,
  impact: NonNullable<Attack>,
): "immune" | "defended" | undefined {
  const target = s.players[opponentOf(attacker)];
  const source = s.players[attacker];
  if (target.invincible > 0 || target.stocks <= 0 || target.hp <= 0)
    return "immune";
  const counter =
    TECHNIQUES[fighterById(target.config.fighter).ability].counter;
  if (
    target.attack === "special" &&
    counter &&
    !target.countered &&
    target.attackTick >= counter.from &&
    target.attackTick <= counter.to &&
    target.facing === -direction
  ) {
    target.countered = true;
    effect(s, target.x, target.y - 80, "block", "#e2bbff", {
      owner: opponentOf(attacker),
      impact: "special",
      direction: target.facing,
    });
    if (Math.abs(source.x - target.x) < counter.range)
      hurt(
        s,
        opponentOf(attacker),
        counter.damage *
          fighterById(target.config.fighter).damage *
          outgoingDamageMultiplier(target),
        counter.force,
        target.facing,
        source.x,
        source.y - 80,
        "special",
      );
    return "defended";
  }
  if (target.blocking && target.facing === -direction && target.energy > 3) {
    target.energy = Math.max(0, target.energy - 9);
    target.vx += direction * 1.5;
    target.recoilVx = (target.recoilVx ?? 0) + direction * 1.5;
    effect(s, x, y, "block", "#c7e8ff", {
      owner: attacker,
      impact,
      direction,
      strength: 0.8,
    });
    s.hitstop = Math.max(s.hitstop, 2);
    return "defended";
  }
  return undefined;
}

export function rewardHit(s: MatchState, attacker: PlayerIndex) {
  const target = s.players[opponentOf(attacker)];
  const source = s.players[attacker];
  if (target.superChargeInterruptedTick !== s.tick)
    target.energy = Math.min(100, target.energy + 9);
  source.energy = Math.min(100, source.energy + 13);
  source.hits++;
  source.streak = s.tick - source.lastHitTick < 100 ? source.streak + 1 : 1;
  source.lastHitTick = s.tick;
  source.peakCombo = Math.max(source.peakCombo, source.streak);
}

/** HP-dependent multiplier used for horizontal launch speed. */
export function launchScale(hp: number) {
  return 1 + (100 - hp) / 90;
}

export function launchTarget(
  target: PlayerState,
  force: number,
  direction: number,
) {
  target.vx = direction * force * launchScale(target.hp);
  target.recoilVx = target.vx;
  target.vy = -force * 0.65;
  target.grounded = false;
  target.supportPlatform = null;
  target.stun = Math.round(force * 2.6 + 5);
  target.attack = null;
  target.cooldown = Math.max(target.cooldown, target.stun);
}

export function hurt(
  s: MatchState,
  attacker: PlayerIndex,
  damage: number,
  force: number,
  direction: number,
  x: number,
  y: number,
  impact: NonNullable<Attack>,
  hitInvincibility = 12,
  visual?: Effect["visual"],
): boolean {
  const interception = interceptHit(s, attacker, direction, x, y, impact);
  if (interception) return interception === "defended";
  const target = s.players[opponentOf(attacker)];
  const source = s.players[attacker];
  const def = fighterById(target.config.fighter);
  interruptSuperCharge(s, target);
  target.hp = Math.max(0, target.hp - damage * def.armor);
  launchTarget(target, force, direction);
  target.invincible = hitInvincibility;
  rewardHit(s, attacker);
  const strength =
    impact === "super"
      ? 1.8
      : impact === "heavy"
        ? 1.35
        : impact === "special"
          ? 1.2
          : 0.85;
  effect(s, x, y, "hit", fighterById(source.config.fighter).color, {
    owner: attacker,
    impact,
    strength,
    direction,
    ...(visual ? { visual } : {}),
  });
  s.shake = Math.max(s.shake, Math.min(14, force * 1.15));
  s.hitstop = Math.max(
    s.hitstop,
    impact === "super" ? 7 : impact === "heavy" ? 5 : 3,
  );
  return true;
}

export function interruptSuperCharge(s: MatchState, player: PlayerState) {
  if (player.superChargeTicks === 0) return;
  player.superChargeTicks = 0;
  player.superChargeInterruptedTick = s.tick;
  player.energy = Math.max(0, player.energy - SUPER_INTERRUPT_ENERGY_COST);
}
