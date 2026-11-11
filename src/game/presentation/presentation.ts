import type { FighterId } from "../../../shared/roster/roster";
import { INTRO_PLAYER_TICKS } from "../../../shared/engine/intro";
import { PRESENTATION_DATA } from "./presentation-data";

export type PresentationStyle =
  | "defiant"
  | "greet"
  | "hat"
  | "strum"
  | "bass"
  | "conduct"
  | "dance"
  | "present"
  | "joke"
  | "inspect"
  | "spectral"
  | "stalk"
  | "hop"
  | "pounce"
  | "ritual"
  | "salute"
  | "broadcast"
  | "phone"
  | "card";
export type PresentationProp =
  | "none"
  | "microphone"
  | "cuatro"
  | "guitar"
  | "bass"
  | "baton"
  | "hat"
  | "phone"
  | "card"
  | "flower"
  | "light"
  | "leaves"
  | "mist"
  | "bag"
  | "book"
  | "vial"
  | "cane"
  | "fire"
  | "stars";
export interface PoseBeat {
  at: number;
  frame: number;
  dx: number;
  dy: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}
export interface Presentation {
  introName: string;
  battleFrame: number;
  frameFacing: number[];
  introStyle: PresentationStyle;
  selectionStyle: PresentationStyle;
  prop: PresentationProp;
  color: string;
  durationMs: number;
  /** Played at the match entrance and, once per pick, on the selection screen. */
  introBeats: PoseBeat[];
}
export const PRESENTATIONS: Record<FighterId, Presentation> = PRESENTATION_DATA;
export const presentationById = (id: FighterId): Presentation =>
  PRESENTATIONS[id];

// Selection presents once per character choice, then holds the ready stance.
export function selectionProgress(id: FighterId, elapsedMs: number): number {
  return Math.max(0, Math.min(1, elapsedMs / presentationById(id).durationMs));
}

export function entranceProgress(
  id: FighterId,
  tick: number,
  player: number,
): number {
  return Math.max(
    0,
    Math.min(
      1,
      ((tick - player * INTRO_PLAYER_TICKS) * 1000) /
        (60 * presentationById(id).durationMs),
    ),
  );
}
export function samplePose(beats: PoseBeat[], progress: number): PoseBeat {
  const t = Math.max(0, Math.min(1, progress));
  const next = beats.findIndex((beat) => beat.at > t);
  const a = beats[Math.max(0, next - 1)],
    b = beats[next];
  // Past the last beat (or with no later one), hold the final pose.
  if (!a || !b) {
    const last = beats.at(-1);
    if (!last) throw new RangeError("A pose needs at least one beat");
    return { ...last };
  }
  const span = b.at - a.at;
  const fraction = span > 0 ? (t - a.at) / span : 0;
  const eased = fraction * fraction * (3 - 2 * fraction);
  const mix = (x: number, y: number) => x + (y - x) * eased;
  return {
    at: t,
    frame: a.frame,
    dx: mix(a.dx, b.dx),
    dy: mix(a.dy, b.dy),
    rotate: mix(a.rotate, b.rotate),
    scaleX: mix(a.scaleX, b.scaleX),
    scaleY: mix(a.scaleY, b.scaleY),
  };
}
