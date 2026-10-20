import { ATTACK_ART, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const OSCAR_POSES = [
  "ready",
  "pull",
  "release",
  "accent",
  "note",
  "note-pair",
] as const;
export const OSCAR_NOTE_TRAVEL = 24;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

// Raw v2 crown-to-sole is 425px. The scroll is taller than the man.
// Use one source-pixel scale through all four poses, undoing atlas packing;
// the accent's bent knees therefore lower his head without enlarging his face.
export const OSCAR_HEIGHTS: Record<string, number> = {
  ready: (469 * 305) / 425,
  pull: (470 * 305) / 425,
  release: (470 * 305) / 425,
  accent: (447 * 305) / 425,
};

export function oscarPlayingPose(tick: number, beats: readonly number[]) {
  if (tick < 12 || tick >= 158) return "ready";
  for (const beat of beats) {
    const afterPluck = tick - (beat - OSCAR_NOTE_TRAVEL);
    if (afterPluck >= -7 && afterPluck < 0) return "pull";
    if (afterPluck >= 0 && afterPluck < 8)
      return beat === beats[beats.length - 1] ? "accent" : "release";
    if (afterPluck >= 8 && afterPluck < 17) return "pull";
  }
  return Math.floor(tick / 10) % 2 ? "ready" : "pull";
}

/** A captured performance: visible note arrivals are the three damage beats. */
export function drawOscarFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "oscar", OSCAR_POSES)) return false;
  const { tick, profile, pulse, motion } = view;
  const sheet = ATTACK_ART.oscar;
  const source = view.point(330, 510),
    target = view.point(783, 510);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 330 + ((x - source.x) * 453) / span;
  // A bounded visual step back leaves room for the bass and note flight in a
  // close capture. Physics, camera, captured feet and painted scale stay fixed.
  const spacing =
    Math.max(0, 310 - span) *
    Math.min(clamp(tick / 12), clamp((profile.duration - tick) / 12));
  const ranges = OSCAR_POSES.slice(0, 4).map((pose) =>
    finaleArtXRange(view.viewport, sheet.frames[pose], OSCAR_HEIGHTS[pose]),
  );
  const minX = Math.max(...ranges.map((range) => range.minX));
  const maxX = Math.min(...ranges.map((range) => range.maxX));
  const x =
    minX <= maxX
      ? Math.max(minX, Math.min(maxX, source.x - spacing))
      : (minX + maxX) / 2;
  const at = authored(x);
  const pose = oscarPlayingPose(tick, profile.damageBeats);
  view.art(
    pose,
    at,
    510 + source.y - view.point(at, 510).y,
    OSCAR_HEIGHTS[pose],
  );
  view.body(view.rival, 783, 510, 290, -1, pulse ? "hurt" : "stand");

  for (const [index, beat] of profile.damageBeats.entries()) {
    const delta = tick - beat;
    if (delta < -OSCAR_NOTE_TRAVEL || delta > 8) continue;
    const flight = clamp((delta + OSCAR_NOTE_TRAVEL) / OSCAR_NOTE_TRAVEL);
    const notePose = index === 2 ? "note-pair" : "note";
    const height = index === 2 ? 76 : 66;
    const end = { x: target.x - 24, y: target.y - 150 };
    const noteX = x + 63 + (end.x - x - 63) * flight;
    const noteY =
      source.y -
      174 +
      (end.y - source.y + 174) * flight -
      (motion ? Math.sin(flight * Math.PI) * 18 : 0);
    const noteAt = authored(noteX);
    const noteFeet = noteY + height / 2;
    const alpha = delta <= 0 ? 1 : clamp(1 - delta / 8);
    view.art(
      notePose,
      noteAt,
      510 + noteFeet - view.point(noteAt, 510).y,
      height,
      1,
      alpha,
    );
    if (delta >= 0 && delta < 8 && motion)
      view.ring(end.x + 12, end.y, 18 + delta * 3, "#ffe6a2", 0.85);
  }
  view.damage(115);
  return true;
}
