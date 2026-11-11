import type { FinalePose } from "../finales/types";
import { TAU, clamp, smooth } from "./math";

export type BodyMode = FinalePose;
export interface Point {
  x: number;
  y: number;
}

/** Painted hands, arms and faces are untouched; only the lower support leg flexes. */
export function finaleDancePoint(point: Point, phase: number): Point {
  if (point.y <= 0.64) return point;
  const angle = phase * Math.PI * 2;
  const side = point.x < 0 ? -1 : 1;
  const support = Math.max(0, Math.sin(angle + (side < 0 ? Math.PI : 0)));
  const foot = smooth((point.y - 0.78) / 0.22);
  const rotation = -side * support * 0.055 * foot;
  const pivotX = side * 0.13,
    pivotY = 0.78;
  const dx = point.x - pivotX,
    dy = point.y - pivotY;
  return {
    x: pivotX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
    y:
      pivotY +
      dx * Math.sin(rotation) +
      dy * Math.cos(rotation) -
      support * 0.003 * foot,
  };
}

/** Explicit hip/knee bending preserves the rival's own bitmap, including custom fighters. */
export function finaleBodyPoint(
  point: Point,
  mode: BodyMode,
  phase: number,
): Point {
  let { x, y } = point;
  const seated =
    mode === "seat" || mode === "talk" || mode === "sip" || mode === "type";
  if (seated && y > 0.57) {
    const thigh = clamp((y - 0.57) / 0.22);
    const thickness = Math.sin(thigh * Math.PI);
    const acrossLeg = point.x - (point.x < 0 ? -0.075 : 0.075);
    x += 0.235 * thigh;
    x -= acrossLeg * 0.65 * thickness;
    y = y < 0.79 ? 0.57 + (y - 0.57) * 0.42 : 0.6624 + (y - 0.79) * 1.24;
    y += acrossLeg * 0.9 * thickness;
  }
  const rhythm = Math.sin(phase * TAU);
  const left = point.x < 0 ? -1 : 1;
  if (mode === "dance" && point.y > 0.55) {
    const hip = clamp((point.y - 0.55) / 0.4);
    const foot = smooth((point.y - 0.74) / 0.26);
    x += left * Math.sin(phase * TAU + left * 0.85) * 0.095 * hip;
    y -=
      Math.max(0, Math.sin(phase * TAU + (left < 0 ? Math.PI : 0))) *
      0.09 *
      foot;
    x += rhythm * 0.035 * (1 - foot);
  }
  // Local sleeve/wrist fields move hands without stretching the face or torso.
  if (point.y > 0.22 && point.y < 0.68) {
    const arm =
      smooth((Math.abs(point.x) - 0.07) / 0.11) *
      Math.sin(clamp((point.y - 0.22) / 0.46) * Math.PI);
    const front = point.x > 0;
    if (mode === "sip" && front) {
      x -= arm * 0.06;
      y -= arm * 0.2 * (0.7 + rhythm * 0.3);
    }
    if (mode === "type") {
      x += arm * (front ? 0.17 : 0.24);
      y += arm * (0.02 - Math.max(0, rhythm * left) * 0.025);
    }
    if (mode === "talk") {
      x += arm * (front ? 0.07 : -0.015);
      y -= arm * (0.02 + Math.max(0, rhythm) * 0.065);
    }
    if (mode === "dance") {
      x += arm * rhythm * left * 0.085;
      y -= arm * (0.035 + Math.max(0, -rhythm * left) * 0.08);
    }
    if (mode === "perform") {
      x += arm * rhythm * 0.04;
      y -= arm * Math.max(0, rhythm * left) * 0.075;
    }
  }
  const head = 1 - smooth((point.y - 0.21) / 0.11);
  if (mode === "talk" || mode === "sip" || mode === "type")
    y += head * Math.sin(phase * TAU * 2) * 0.009;
  if (mode === "dance")
    x += Math.sin(phase * TAU) * 0.018 * (1 - smooth((point.y - 0.5) / 0.2));
  if (mode === "recoil") x += Math.sin(phase * Math.PI) * 0.05 * (1 - point.y);
  return { x, y };
}
