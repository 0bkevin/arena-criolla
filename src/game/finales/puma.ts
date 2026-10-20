import { ATTACK_ART, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const PUMA_POSES = [
  "summon",
  "release",
  "ring-a",
  "ring-b",
  "ring-c",
  "ring-d",
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
// Four authored quarter-turns move costumes around the ring; the bitmap is never
// rotated. Reduced motion holds a clear linked ring without changing combat.
export function pumaRingPose(tick: number, motion = 1) {
  return PUMA_POSES[
    2 + (motion ? Math.floor(Math.max(0, tick - 12) / 9) % 4 : 0)
  ];
}
export function drawPumaFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "puma", PUMA_POSES)) return false;
  const { tick, profile, pulse, motion } = view;
  const source = view.point(330, 510),
    target = view.point(783, 510);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 330 + ((x - source.x) * 453) / span;
  const feet = (x: number, y: number) =>
    510 + y - view.point(authored(x), 510).y;
  const transition = Math.min(
    clamp(tick / 12),
    clamp((profile.duration - tick) / 12),
  );
  const sheet = ATTACK_ART.puma;
  const ringHeight = 275;
  const ringRanges = PUMA_POSES.slice(2).map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], ringHeight),
  );
  const ringMin = Math.max(...ringRanges.map((r) => r.minX)),
    ringMax = Math.min(...ringRanges.map((r) => r.maxX));
  const actorRanges = PUMA_POSES.slice(0, 2).map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], 305),
  );
  const actorMin = Math.max(...actorRanges.map((r) => r.minX)),
    actorMax = Math.min(...actorRanges.map((r) => r.maxX));
  // A short, bounded presentation step separates the open arms and the ring in
  // close grabs. Real player coordinates, feet, arena and camera remain frozen.
  const desiredActor = source.x - Math.max(0, 335 - span) * transition;
  const actorX = Math.max(actorMin, Math.min(actorMax, desiredActor));
  const desiredRing = Math.max(target.x, actorX + 300 * transition);
  const ringX =
    target.x +
    (Math.max(ringMin, Math.min(ringMax, desiredRing)) - target.x) * transition;
  const ringFeet = target.y;
  const pose = tick >= 158 ? "release" : "summon";
  view.art(pose, authored(actorX), feet(actorX, source.y), 305);
  const ringPose = pumaRingPose(tick, motion);
  const alpha = Math.min(
    clamp((tick - 5) / 7),
    clamp((profile.duration - tick) / 2),
  );
  const paintRing = () =>
    view.art(
      ringPose,
      authored(ringX),
      feet(ringX, ringFeet),
      ringHeight,
      1,
      alpha,
    );
  // Canonical hurt frames lean forward. Place that lean in the empty center,
  // then return to the physical anchor before the real release velocity applies.
  const rivalX = ringX - 40 * transition;
  view.body(
    view.rival,
    authored(rivalX),
    feet(rivalX, target.y),
    290,
    -1,
    tick > 20 || pulse ? "hurt" : "stand",
  );
  // The authored open center preserves the rival's face. The complete linked
  // ring is foreground, keeping every helper face and handclasp unbroken.
  paintRing();
  if (tick >= 158 && motion)
    view.ring(ringX, target.y - 100, 35 + (tick - 158) * 2, "#ffe4a3", 0.5);
  view.bubble(
    "¡Agárrense de las manos!",
    actorX + 25,
    Math.min(source.y, target.y) - 475,
    330,
  );
  view.damage(115);
  return true;
}
