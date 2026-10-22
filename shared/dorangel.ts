import type { MatchState, PlayerState } from "./engine";
import type { FieldFinaleState } from "./field-finales";

export const DORANGEL_FINALE = {
  duration: 174,
  recovery: 134,
  riding: false,
  cues: [48, 70, 92, 114],
} as const;

export const DORANGEL_BITE = {
  approachStart: 3,
  approachEnd: 13,
  stepSpeed: 4,
  gap: 66,
  range: 96,
  height: 35,
} as const;

/** A short, vulnerable step closes the gap before the jaw makes contact. */
export function advanceDorangelBite(state: MatchState) {
  for (const [index, player] of state.players.entries()) {
    if (
      player.config.fighter !== "dorangel" ||
      player.attack !== "special" ||
      player.stun ||
      player.rootTicks ||
      player.hp <= 0 ||
      !player.grounded
    )
      continue;
    const target = state.players[1 - index];
    const gap = (target.x - player.x) * player.facing;
    const approaching =
      player.attackTick >= DORANGEL_BITE.approachStart &&
      player.attackTick < DORANGEL_BITE.approachEnd &&
      Math.abs(target.y - player.y) < DORANGEL_BITE.height;
    player.vx = approaching
      ? player.facing *
        Math.min(
          DORANGEL_BITE.stepSpeed * (player.slowTicks ? 0.6 : 1),
          Math.max(0, gap - DORANGEL_BITE.gap),
        )
      : 0;
    player.recoilVx = 0;
  }
}

export const DORANGEL_POT = {
  spawnTick: 0,
  placeTick: 24,
  fireTick: 36,
  stirTick: 42,
  finishTick: 132,
  carryOffset: 36,
  carryLift: 22,
  hearthHeight: 36,
  potInset: 4,
  minOffset: 80, // Keeps the bowl in front of the caster at body-contact distance.
  offset: 105,
  height: 118,
  halfWidth: 50,
  surfaceTolerance: 18,
  snareTicks: 18,
} as const;

export function dorangelPot(field: FieldFinaleState) {
  return field.fighter === "dorangel"
    ? field.actors?.find((actor) => actor.kind === "pot" && actor.life > 0)
    : undefined;
}

/** A cold pot is a carried prop; only a placed, lit pot can hold a fighter. */
export function dorangelPotIsHot(field: FieldFinaleState) {
  return (
    field.fighter === "dorangel" &&
    !field.cancelled &&
    field.tick >= DORANGEL_POT.stirTick &&
    field.tick < DORANGEL_POT.finishTick
  );
}

export function insideDorangelPot(
  field: FieldFinaleState,
  target: PlayerState,
) {
  const pot = dorangelPot(field);
  return (
    !!pot &&
    dorangelPotIsHot(field) &&
    target.grounded &&
    Math.abs(target.x - pot.x) <= DORANGEL_POT.halfWidth &&
    Math.abs(target.y - pot.y) <= DORANGEL_POT.surfaceTolerance
  );
}

/** A local grip ends as soon as either body leaves contact or its source stops. */
export function releaseBrokenDorangelGrips(state: MatchState) {
  for (const [index, target] of state.players.entries()) {
    if (target.rootKind !== "bite" && target.rootKind !== "pot") continue;
    const source = state.players[1 - index];
    const field =
      target.rootKind === "pot"
        ? state.fieldFinales?.find(
            (f) =>
              f.owner === 1 - index && f.fighter === "dorangel" && !f.cancelled,
          )
        : undefined;
    const held =
      source.config.fighter === "dorangel" &&
      source.hp > 0 &&
      source.stocks > 0 &&
      !source.stun &&
      target.rootTicks > 0 &&
      target.hp > 0 &&
      target.grounded &&
      (target.rootKind === "pot"
        ? !!field && insideDorangelPot(field, target)
        : source.attack === "special" &&
          source.grounded &&
          Math.abs(target.x - source.x) < DORANGEL_BITE.range &&
          Math.abs(target.y - source.y) < DORANGEL_BITE.height);
    if (!held) {
      target.rootTicks = 0;
      delete target.rootKind;
    }
  }
}
