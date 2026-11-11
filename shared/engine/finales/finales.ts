import {
  ARENA_FINALES,
  ARENA_FINALE_CUES,
  isArenaFinalist,
} from "./arena-finales";
import { fighterById, type FighterId } from "../../roster/roster";
import perroMujeriego from "./perro-mujeriego-choreography.json";
import type { PlayerIndex } from "../types";
import { FINALE_ENTRIES } from "./finale-entries";

export type FinaleFamily =
  | "transport"
  | "sport"
  | "conversation"
  | "broadcast"
  | "music"
  | "dance"
  | "theater"
  | "technology"
  | "folklore";

export interface FinaleDefinition {
  id: FighterId;
  title: string;
  description: string;
  family: FinaleFamily;
  prop: string;
  caption: string;
  accent: string;
  mode: "capture" | "transformation" | "projectile" | "field";
  empowerment?: { id: string; duration: number; damageMultiplier: number };
  /** A normal combat projectile: no capture, homing or scheduled remote damage. */
  projectile?: {
    kind: "sonic";
    speed: number;
    life: number;
    radius: number;
    growth: number;
    maxRadius: number;
    offsetX: number;
    offsetY: number;
    force: number;
  };
  duration: number;
  /** Optional finishing throw; zero releases in place, ordinary captures keep force12. */
  release?: { force: number; knockoutDelay?: number };
  damageBeats: readonly number[];
  /** Sound and gesture timing for spatial attacks. Damage still requires contact. */
  cueBeats?: readonly number[];
  sound: "coffee" | "dance" | "hack" | "music" | "show" | "engine" | "mystic";
}

export interface FinaleState {
  owner: PlayerIndex;
  target: PlayerIndex;
  fighter: FighterId;
  startedTick: number;
  tick: number;
  duration: number;
  x: number;
  y: number;
  direction: number;
  damage: number;
  initialHp: number;
}

export const FINALE_DURATION = 180;
export const FINALE_CAPTURE_TICK = 9;
export const FINALE_DAMAGE_BEATS = [42, 90, 138] as const;
export const FINALE_RANGE = 245;

export const FINALES = Object.fromEntries(
  FINALE_ENTRIES.map(
    ([id, title, family, description, prop, caption, sound]): [
      FighterId,
      FinaleDefinition,
    ] => [
      id,
      {
        id,
        title,
        description,
        family,
        prop,
        caption,
        accent: fighterById(id).color,
        ...(isArenaFinalist(id) ? { cueBeats: ARENA_FINALE_CUES[id] } : {}),
        mode:
          id === "dayana" || id === "deyna" || isArenaFinalist(id)
            ? "field"
            : id === "conde" || id === "emilio"
              ? "transformation"
              : id === "maite"
                ? "projectile"
                : "capture",
        ...(id === "maite"
          ? {
              projectile: {
                kind: "sonic" as const,
                speed: 12,
                life: 55,
                radius: 20,
                growth: 0.7,
                maxRadius: 52,
                offsetX: 38,
                offsetY: 154,
                force: 12,
              },
            }
          : {}),
        ...(id === "conde" || id === "emilio"
          ? {
              empowerment: {
                id: id === "conde" ? "conde-bond" : "el-chunior",
                duration: 360,
                damageMultiplier: 1.2,
              },
            }
          : {}),
        duration: isArenaFinalist(id)
          ? ARENA_FINALES[id].duration
          : id === "deyna"
            ? 96
            : id === "conde" || id === "emilio"
              ? 360
              : id === "maite"
                ? 84
                : id === "nacho"
                  ? perroMujeriego.durationTicks
                  : FINALE_DURATION,
        ...(id === "nacho" ? { release: { force: 0 } } : {}),
        damageBeats:
          isArenaFinalist(id) ||
          id === "conde" ||
          id === "emilio" ||
          id === "maite" ||
          id === "deyna" ||
          id === "dayana"
            ? []
            : id === "nacho"
              ? FINALE_DAMAGE_BEATS.map(
                  (tick) =>
                    tick * (perroMujeriego.durationTicks / FINALE_DURATION),
                )
              : FINALE_DAMAGE_BEATS,
        sound,
      },
    ],
  ),
) as Record<FighterId, FinaleDefinition>;

export function finaleById(id: FighterId): FinaleDefinition | undefined {
  return FINALES[id as FighterId];
}

export const FINALE_ASSET_GROUPS = [
  [
    "zavarce",
    "vallenilla",
    "javier",
    "capriles",
    "renny",
    "gomez",
    "simon",
    "conde",
  ],
  ["emilio", "maite", "oscar", "puma", "chataing", "george", "mcm", "ali"],
  [
    "gualberto",
    "reynaldo",
    "dudamel",
    "danny",
    "nacho",
    "sarcos",
    "yordano",
    "lila",
  ],
  [
    "rummy",
    "chiqui",
    "norkys",
    "gabriela",
    "amanda",
    "lele",
    "giuseppe",
    "silbon",
  ],
  [
    "llorona",
    "sayona",
    "lionza",
    "florentino",
    "diablo",
    "knoche",
    "momoy",
    "tiotigre",
  ],
  ["tioconejo", "enrique", "jesus", "carlos", "victor", "juan"],
] as const satisfies readonly (readonly FighterId[])[];

// The original authored batch is immutable. Later roster additions use their
// canonical combat sprites with arena props drawn by the renderer.
export const CANONICAL_FINALE_FIGHTERS = [
  "lorenzo",
  "carolina",
  "dayana",
  "deyna",
  "bolivar",
  "edgar",
  "melanio",
] as const satisfies readonly FighterId[];

export function finaleAsset(id: FighterId) {
  // Capriles uses the cafe atlases. The other fighters in the first two batches
  // now use field, transformation or projectile finales with their own artwork.
  if (id === "capriles" || finaleById(id)?.mode !== "capture") return undefined;
  for (const [group, ids] of FINALE_ASSET_GROUPS.entries()) {
    const index = (ids as readonly string[]).indexOf(id);
    if (index !== -1)
      return {
        file: `finales-v1-${group + 1}`,
        column: index % 4,
        row: Math.floor(index / 4),
      };
  }
  return undefined;
}
