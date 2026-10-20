import { WORLD } from "./arena";
import type { MatchState, PlayerState } from "./engine";

/** Temporary arena actors run on ordinary combat ticks; they never capture a rival. */
export interface FieldFinaleState {
  id: number;
  fighter: "dayana" | "deyna";
  owner: 0 | 1;
  startedTick: number;
  tick: number;
  duration: number;
  x: number;
  y: number;
  direction: number;
  damage: number;
}
export const SQUAD_COUNT = 5;
export const SQUAD_LAUNCH_TICK = 24;
export const SQUAD_DURATION = 96;
export const RUNWAY_DURATION = 180;
export const RUNWAY_POSE_TICKS = [42, 90, 138] as const;
export const RUNWAY_WALK_WINDOWS = [
  [12, 36],
  [60, 84],
  [108, 132],
] as const;
export const RUNWAY_SPEED = 3;
export const RUNWAY_LENGTH = 330;
// A compact huddle surrounds the captain: rear row, flanks and two forwards.
const SQUAD_OFFSETS = [
  { x: -85, y: -18, height: 167, layer: "back" },
  { x: -22, y: -27, height: 163, layer: "back" },
  { x: 72, y: -14, height: 170, layer: "back" },
  { x: -50, y: 3, height: 177, layer: "front" },
  { x: 40, y: 6, height: 180, layer: "front" },
] as const;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const runwayWalking = (tick: number) =>
  RUNWAY_WALK_WINDOWS.some(([a, b]) => tick >= a && tick < b);
export function squadMember(field: FieldFinaleState, index: number) {
  const offset = SQUAD_OFFSETS[index];
  const anchor =
    field.direction > 0
      ? clamp(field.x, WORLD.left + 150, WORLD.right - 137)
      : clamp(field.x, WORLD.left + 137, WORLD.right - 150);
  return {
    x: anchor + field.direction * offset.x,
    y: field.y + offset.y,
    height: offset.height,
    layer: offset.layer,
  };
}
export function runwayRange(field: FieldFinaleState) {
  const end = clamp(
    field.x + field.direction * RUNWAY_LENGTH,
    WORLD.left + 35,
    WORLD.right - 35,
  );
  return {
    left: Math.min(field.x, end) - 45,
    right: Math.max(field.x, end) + 45,
  };
}
export function fieldFinaleBounds(state: MatchState) {
  return (state.fieldFinales ?? []).flatMap((f) =>
    f.fighter === "deyna"
      ? Array.from({ length: SQUAD_COUNT }, (_, i) => {
          const p = squadMember(f, i);
          return { left: p.x - 65, right: p.x + 65 };
        })
      : [runwayRange(f)],
  );
}
export function activeRunway(state: MatchState, player: PlayerState) {
  return state.fieldFinales?.find(
    (f) =>
      f.fighter === "dayana" &&
      state.players[f.owner] === player &&
      player.attack === "super" &&
      !player.stun,
  );
}
export function beginFieldFinale(
  state: MatchState,
  owner: 0 | 1,
  damage: number,
) {
  const player = state.players[owner],
    fighter = player.config.fighter;
  if (fighter !== "dayana" && fighter !== "deyna") return;
  if (fighter === "dayana" && !player.grounded) {
    player.attack = null;
    player.cooldown = 12;
    return;
  }
  state.fieldFinales ??= [];
  state.fieldFinales.push({
    id: state.nextId++,
    fighter,
    owner,
    startedTick: state.tick,
    tick: 0,
    duration: fighter === "dayana" ? RUNWAY_DURATION : SQUAD_DURATION,
    x: player.x,
    y: fighter === "deyna" ? WORLD.floor : player.y,
    direction: player.facing,
    damage,
  });
}
/** Advance fields before reflection so every live ball can be reflected on its birth tick. */
export function advanceFieldFinales(state: MatchState) {
  state.fieldFinales = state.fieldFinales?.filter((field) => {
    const player = state.players[field.owner];
    if (
      player.hp <= 0 ||
      player.stocks <= 0 ||
      player.config.fighter !== field.fighter
    )
      return false;
    if (
      field.fighter === "dayana" &&
      (player.attack !== "super" || player.stun || !player.grounded)
    ) {
      if (player.attack === "super") player.attack = null;
      player.cooldown = Math.min(player.cooldown, Math.max(12, player.stun));
      return false;
    }
    if (field.startedTick !== state.tick) field.tick++;
    if (field.tick >= field.duration) {
      if (field.fighter === "dayana") {
        player.attack = null;
        player.cooldown = 12;
        player.vx = 0;
      }
      return false;
    }
    if (field.fighter === "deyna" && field.tick === SQUAD_LAUNCH_TICK) {
      for (let i = 0; i < SQUAD_COUNT; i++) {
        const member = squadMember(field, i);
        state.projectiles.push({
          id: state.nextId++,
          owner: field.owner,
          x: member.x + field.direction * 48,
          y: member.y - 16,
          vx: field.direction * 9,
          vy: 0,
          age: 0,
          life: 95,
          kind: "football",
          impact: "super",
          formationIndex: i,
          radius: 13,
          hitInvincibility: 4,
          force: i === SQUAD_COUNT - 1 ? 6 : 2.4,
          damage: field.damage / SQUAD_COUNT,
          direction: field.direction,
        });
      }
    }
    if (field.fighter === "dayana") {
      const range = runwayRange(field),
        move = runwayWalking(field.tick) ? field.direction * RUNWAY_SPEED : 0;
      player.vx =
        clamp(player.x + move, range.left + 45, range.right - 45) - player.x;
      player.recoilVx = 0;
      player.facing = field.direction;
      player.vy = 0;
    }
    return true;
  });
  if (!state.fieldFinales?.length) delete state.fieldFinales;
}
/** The temporary walkway supports its performer; attacks and jumps can interrupt it. */
export function supportRunway(state: MatchState) {
  for (const player of state.players) {
    const field = activeRunway(state, player);
    if (field) {
      player.y = field.y;
      player.vy = 0;
      player.grounded = true;
      player.supportPlatform = null;
    }
  }
}
export interface RunwayHit {
  owner: 0 | 1;
  damage: number;
  force: number;
  direction: number;
  x: number;
  y: number;
}
export function runwayContacts(state: MatchState): RunwayHit[] {
  return (state.fieldFinales ?? []).flatMap((field) => {
    if (
      field.fighter !== "dayana" ||
      !RUNWAY_POSE_TICKS.includes(field.tick as 42 | 90 | 138)
    )
      return [];
    const source = state.players[field.owner],
      target = state.players[1 - field.owner];
    if (
      !activeRunway(state, source) ||
      Math.abs(target.x - source.x) > 115 ||
      Math.abs(target.y - source.y) > 145 ||
      (target.x - source.x) * field.direction < -20
    )
      return [];
    return [
      {
        owner: field.owner,
        damage: field.damage / 3,
        force: field.tick === 138 ? 7 : 2.5,
        direction: field.direction,
        x: target.x,
        y: target.y - 80,
      },
    ];
  });
}
