// Arena definitives: who has one, how long it lasts, its cues, its helpers'
// reach, and whether its caster is still performing it.
import { DORANGEL_FINALE, DORANGEL_POT } from "./dorangel";
import { INAKI_FINALE } from "./inaki";
import type { FighterId } from "../../roster/roster";
import type { MatchState, PlayerState } from "../engine";
import type { FieldFinaleState } from "./field-finales";
import { COUTURE_MODEL_CUES } from "./couture-runway";
import type { PlayerIndex } from "../types";

/** The authored batch. The other roster finales retain their existing rules. */
export const REVIEWED_FINALISTS = [
  "bolivar",
  "gomez",
  "zavarce",
  "vallenilla",
  "javier",
  "renny",
  "simon",
  "conde",
  "emilio",
  "maite",
  "oscar",
  "puma",
  "chataing",
  "george",
  "mcm",
  "ali",
  "melanio",
  "dayana",
  "lorenzo",
  "dudamel",
  "llorona",
  "deyna",
  "kevin",
  "carolina",
  "dorangel",
  "inaki",
] as const satisfies readonly FighterId[];

export const ARENA_FINALES = {
  inaki: INAKI_FINALE,
  dorangel: DORANGEL_FINALE,
  carolina: { duration: 196, recovery: 36, riding: false },
  kevin: { duration: 96, recovery: 82, riding: false },
  bolivar: { duration: 220, recovery: 104, riding: true },
  gomez: { duration: 180, recovery: 104, riding: true },
  zavarce: { duration: 210, recovery: 24, riding: false },
  vallenilla: { duration: 126, recovery: 30, riding: false },
  javier: { duration: 78, recovery: 78, riding: false },
  renny: { duration: 126, recovery: 90, riding: false },
  simon: { duration: 155, recovery: 68, riding: false },
  oscar: { duration: 96, recovery: 84, riding: false },
  puma: { duration: 125, recovery: 30, riding: false },
  chataing: { duration: 70, recovery: 68, riding: false },
  george: { duration: 112, recovery: 52, riding: false },
  mcm: { duration: 130, recovery: 96, riding: true },
  ali: { duration: 98, recovery: 84, riding: false },
  melanio: { duration: 76, recovery: 74, riding: false },
  lorenzo: { duration: 185, recovery: 96, riding: true },
  dudamel: { duration: 102, recovery: 90, riding: false },
  llorona: { duration: 80, recovery: 76, riding: false },
} as const;
export type ArenaFinalist = keyof typeof ARENA_FINALES;
/** Emission/gesture cues for sound, never guaranteed damage times. */
export const ARENA_FINALE_CUES: Record<ArenaFinalist, readonly number[]> = {
  inaki: INAKI_FINALE.cues,
  dorangel: DORANGEL_FINALE.cues,
  carolina: COUTURE_MODEL_CUES,
  kevin: [12, 26, 40, 54, 68],
  bolivar: [12, 23, 34, 45, 56, 67, 78],
  gomez: [12, 29, 51],
  zavarce: [0, 12, 24, 36, 48, 60, 72],
  vallenilla: [36, 49, 62, 75, 88, 101],
  javier: [12, 36, 60],
  renny: [48, 70, 92, 104],
  simon: [12, 32, 52],
  oscar: [12, 36, 60],
  puma: [12, 36],
  chataing: [14, 44],
  george: [28],
  mcm: [12],
  ali: [12, 36, 60],
  melanio: [20, 48],
  lorenzo: [12, 28, 48],
  dudamel: [12, 36, 60],
  llorona: [18, 38, 58],
};
export const isArenaFinalist = (id: FighterId): id is ArenaFinalist =>
  Object.prototype.hasOwnProperty.call(ARENA_FINALES, id);

export interface ArenaFinaleActor {
  id: number;
  kind:
    | "courier"
    | "horse"
    | "truck"
    | "mascot"
    | "dancer"
    | "woodhorse"
    | "handchain"
    | "curtain"
    | "model"
    | "supporter"
    | "pot";
  index: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  direction: number;
  height: number;
  connected: boolean;
  goalX?: number;
  /** A pot's forward placement is chosen once, before it is lowered. */
  placementOffset?: number;
  caughtTick?: number;
  supportPlatform?: number;
}

export interface ArenaContact {
  field: FieldFinaleState;
  actor?: ArenaFinaleActor | undefined;
  owner: PlayerIndex;
  damage: number;
  force: number;
  direction: number;
  x: number;
  y: number;
  rootTicks?: number | undefined;
  /** Preserve the struck surface when roots replace ordinary launch recoil. */
  rootSupport?: number | null | undefined;
  rootKind?: PlayerState["rootKind"] | undefined;
}

/** Painted leading edges, shared with the visible fallback when an atlas fails. */
export function arenaActorReach(actor: ArenaFinaleActor) {
  const melee = actor.kind === "mascot" || actor.kind === "dancer";
  return {
    offset: melee
      ? 38
      : actor.kind === "horse"
        ? 88
        : actor.kind === "courier"
          ? 77
          : actor.kind === "truck"
            ? 100
            : 0,
    halfWidth: melee
      ? 42
      : actor.kind === "model"
        ? 26
        : actor.kind === "curtain"
          ? 100
          : actor.kind === "truck"
            ? 75
            : actor.kind === "handchain"
              ? actor.caughtTick === undefined
                ? 85
                : 105
              : 32,
    top: melee
      ? 155
      : actor.kind === "model"
        ? 158
        : actor.kind === "curtain"
          ? 24
          : actor.kind === "truck"
            ? 160
            : actor.kind === "woodhorse"
              ? 105
              : actor.kind === "handchain" && actor.caughtTick !== undefined
                ? 165
                : 140,
    feetOffset: actor.kind === "curtain" ? 12 : 0,
    bottom: actor.kind === "curtain" ? 0 : melee ? 8 : 10,
  };
}

export function arenaMountReach(field: FieldFinaleState) {
  const truck = field.fighter === "mcm" || field.fighter === "lorenzo";
  return {
    offset: truck ? (field.fighter === "mcm" ? 175 : 98) : 88,
    halfWidth: truck ? (field.fighter === "mcm" ? 140 : 90) : 35,
    top: truck ? 165 : 145,
    feetOffset: 0,
    bottom: 8,
  };
}

export const mountedFinale = (field: FieldFinaleState) =>
  isArenaFinalist(field.fighter) && ARENA_FINALES[field.fighter].riding;

export function activeArenaPerformance(state: MatchState, player: PlayerState) {
  return state.fieldFinales?.find(
    (f) =>
      isArenaFinalist(f.fighter) &&
      state.players[f.owner] === player &&
      !f.cancelled &&
      f.tick < ARENA_FINALES[f.fighter].recovery &&
      player.attack === "super" &&
      !player.stun,
  );
}

export function cancelArenaPerformance(state: MatchState, player: PlayerState) {
  const field = activeArenaPerformance(state, player);
  if (!field) return;
  field.cancelled = true;
  player.attack = null;
  player.cooldown = Math.min(player.cooldown, 12);
}

export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const rideSpeed = (id: FighterId) =>
  id === "bolivar" || id === "gomez" ? 7.2 : 5.8;
export const rideMoving = (field: FieldFinaleState) =>
  !field.cancelled && field.tick >= 12 && field.tick < 88;

export function arenaFinaleInRange(player: PlayerState, target: PlayerState) {
  if (!player.grounded || Math.abs(player.y - target.y) > 125) return false;
  const id = player.config.fighter,
    distance = Math.abs(target.x - player.x);
  const reach =
    id === "dorangel"
      ? DORANGEL_POT.offset + DORANGEL_POT.halfWidth
      : id === "llorona" || id === "melanio"
        ? 115
        : id === "chataing"
          ? 170
          : id === "javier"
            ? 210
            : id === "george"
              ? 250
              : id === "vallenilla" || id === "renny" || id === "puma"
                ? 330
                : 620;
  return distance < reach;
}
