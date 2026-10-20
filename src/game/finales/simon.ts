import { ATTACK_ART, hasAttackArt } from "../attack-art";
import { clampFinaleArtX, finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

const poses = [
  "ready",
  "downstroke",
  "upstroke",
  "accent",
  "horse-trot",
  "horse-spring",
];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** One visible strum releases the special's existing three-note fan. */
export function simonSpecialPose(tick: number): string {
  return tick < 12
    ? "ready"
    : tick < 20
      ? "downstroke"
      : tick < 28
        ? "upstroke"
        : "ready";
}

/** Original tonada: held cuatro, three wooden toys, three physical contacts. */
export function drawSimonFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "simon", poses)) return false;
  const sheet = ATTACK_ART.simon;
  const { tick, pulse, motion, profile } = view;
  const source = view.point(330, 510),
    target = view.point(783, 510);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 330 + ((x - source.x) * 453) / span;
  const nearest = Math.min(
    ...profile.damageBeats.map((beat) => Math.abs(tick - beat)),
  );
  const pose =
    tick < 14 || tick >= 162
      ? "ready"
      : nearest <= 5
        ? "accent"
        : Math.floor(tick / 8) % 2
          ? "downstroke"
          : "upstroke";
  // A narrow capture otherwise hides the cuatro behind the rival. Step back
  // only in presentation space, easing to the original anchor on recovery.
  // Keep the original actor floor and physical capture/camera unchanged.
  const spacing =
    Math.max(0, 300 - span) *
    Math.min(clamp(tick / 12), clamp((180 - tick) / 12));
  const ranges = poses
    .slice(0, 4)
    .map((name) => finaleArtXRange(view.viewport, sheet.frames[name], 305));
  const minX = Math.max(...ranges.map((range) => range.minX));
  const maxX = Math.min(...ranges.map((range) => range.maxX));
  const performerX =
    minX <= maxX
      ? Math.max(minX, Math.min(maxX, source.x - spacing))
      : (minX + maxX) / 2;
  const performerAt = authored(performerX);
  const performerFeet = 510 + source.y - view.point(performerAt, 510).y;
  view.art(pose, performerAt, performerFeet, 305);
  view.body(view.rival, 783, 510, 290, -1, pulse ? "hurt" : "stand");

  for (const beat of profile.damageBeats) {
    const delta = tick - beat;
    if (delta < -30 || delta > 20) continue;
    const spring = delta >= -6 && delta <= 6;
    const horsePose = spring ? "horse-spring" : "horse-trot";
    // Keep the same source-pixel scale in both toy poses, despite raised legs.
    const height = spring ? 136 : 125;
    const contact = target.x - 62;
    const room = finaleArtXRange(
      view.viewport,
      sheet.frames["horse-trot"],
      125,
    );
    const turnBack = target.x + 165 > room.maxX;
    let x =
      delta <= 0
        ? contact - 255 * clamp(-delta / 30)
        : contact + (turnBack ? -1 : 1) * 210 * clamp(delta / 20);
    const facing = delta > 6 && turnBack ? -1 : 1;
    x = clampFinaleArtX(
      view.viewport,
      sheet.frames[horsePose],
      height,
      facing,
      x,
    );
    const at = authored(x);
    // Toys follow the rival's surface even in a close or unequal-height capture.
    const hop = motion ? Math.sin(clamp((delta + 6) / 12) * Math.PI) * 9 : 0;
    const feet = 510 + target.y - view.point(at, 510).y - hop;
    const alpha = clamp((delta + 30) / 6) * clamp((20 - delta) / 9);
    view.art(horsePose, at, feet, height, facing, alpha);
  }
  view.damage(115);
  return true;
}
