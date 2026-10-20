import { WORLD } from "./arena";

export const COUTURE_MODEL_COUNT = 4;
export const COUTURE_MODEL_HEIGHT = 177;
export const COUTURE_MODEL_SPEED = 3.2;
export const COUTURE_RUNWAY_LENGTH = 560;

/** The whole procession fits inside the arena, including casts near either wall. */
export function coutureRunwayRange(field: { x: number; direction: number }) {
  const start = field.x - field.direction * 160,
    end = start + field.direction * COUTURE_RUNWAY_LENGTH,
    left = Math.max(
      WORLD.left + 25,
      Math.min(Math.min(start, end), WORLD.right - 25 - COUTURE_RUNWAY_LENGTH),
    );
  return { left, right: left + COUTURE_RUNWAY_LENGTH };
}

export function coutureModelStart(
  field: { x: number; direction: number },
  index: number,
) {
  const range = coutureRunwayRange(field);
  return (
    (field.direction > 0 ? range.left : range.right) +
    field.direction * (24 + index * 80)
  );
}
