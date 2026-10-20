import { WORLD } from "./arena";

export const COUTURE_MODEL_COUNT = 4;
export const COUTURE_MODEL_HEIGHT = 177;
export const COUTURE_MODEL_SPEED = 3.2;
export const COUTURE_RUNWAY_LENGTH = 560;
export const COUTURE_MODEL_CUES = [8, 28, 48, 68] as const;

/** The runway starts ahead of its caller and shortens at walls, never behind her. */
export function coutureRunwayRange(field: { x: number; direction: number }) {
  const boundary = field.direction > 0 ? WORLD.right - 8 : WORLD.left + 8,
    space = Math.max(0, (boundary - field.x) * field.direction),
    gap = Math.min(80, space * 0.35),
    start = field.x + field.direction * gap,
    end =
      start + field.direction * Math.min(COUTURE_RUNWAY_LENGTH, space - gap);
  return { left: Math.min(start, end), right: Math.max(start, end) };
}

export function coutureModelStart(field: { x: number; direction: number }) {
  const range = coutureRunwayRange(field),
    inset = Math.min(24, (range.right - range.left) / 4);
  return (
    (field.direction > 0 ? range.left : range.right) + field.direction * inset
  );
}

export function coutureModelEnd(field: { x: number; direction: number }) {
  const range = coutureRunwayRange(field),
    inset = Math.min(24, (range.right - range.left) / 4);
  return (
    (field.direction > 0 ? range.right : range.left) - field.direction * inset
  );
}
