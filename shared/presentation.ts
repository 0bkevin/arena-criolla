import type { FighterId } from "./content";
import definitions from "./presentations.json";

export type PresentationStyle =
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
  selectionName: string;
  battleFrame: number;
  frameFacing: number[];
  introStyle: PresentationStyle;
  selectionStyle: PresentationStyle;
  prop: PresentationProp;
  color: string;
  durationMs: number;
  introBeats: PoseBeat[];
  selectionBeats: PoseBeat[];
}
export const PRESENTATIONS = definitions as Record<FighterId, Presentation>;
export const presentationById = (id: FighterId): Presentation =>
  PRESENTATIONS[id];

// Selection presents once per character choice, then holds the ready stance.
export function selectionProgress(id: FighterId, elapsedMs: number): number {
  return Math.max(0, Math.min(1, elapsedMs / presentationById(id).durationMs));
}

// Shared ticks keep both clients on the same entrance, countdown and opening pose.
export const INTRO_PLAYER_TICKS = 180;
export const INTRO_COUNTDOWN_START = INTRO_PLAYER_TICKS * 2;
export const INTRO_COUNTDOWN_TICKS = 150;
export const INTRO_TOTAL_TICKS = INTRO_COUNTDOWN_START + INTRO_COUNTDOWN_TICKS;
export function introActor(tick: number): 0 | 1 | null {
  return tick < INTRO_COUNTDOWN_START
    ? tick < INTRO_PLAYER_TICKS
      ? 0
      : 1
    : null;
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
export function normalizedFacing(
  id: FighterId,
  frame: number,
  facing: number,
): number {
  return (facing < 0 ? -1 : 1) * presentationById(id).frameFacing[frame];
}
export function samplePose(beats: PoseBeat[], progress: number): PoseBeat {
  const t = Math.max(0, Math.min(1, progress));
  const next = beats.findIndex((beat) => beat.at > t);
  if (next < 0) return { ...beats[beats.length - 1] };
  const a = beats[Math.max(0, next - 1)],
    b = beats[next];
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
