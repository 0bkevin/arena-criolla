import type { PlayerState } from "../../../../shared/engine/engine";
import { drawAttackArt, hasAttackArt } from "../../assets/attack-art";

export const BOLIVAR_SPECIAL_POSES = [
  "draw",
  "slash",
  "cut",
  "thrust",
] as const;
// Source core heights with one shared source pixel scale per generated sheet.
export const BOLIVAR_BODY_HEIGHTS: Record<string, number> = {
  draw: 494,
  slash: 493,
  cut: 502,
  thrust: 468,
  ready: 525,
  "gallop-a": 516,
  "gallop-b": 476,
  horse: 413,
};
export function bolivarSpecialPose(tick: number) {
  return tick < 10
    ? "draw"
    : tick < 22
      ? "slash"
      : tick < 34
        ? "cut"
        : tick < 46
          ? "thrust"
          : tick < 52
            ? "draw"
            : undefined;
}
export function drawBolivarSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "bolivar" ||
    p.attack !== "special" ||
    p.stun ||
    !images ||
    !hasAttackArt(images, "bolivar", BOLIVAR_SPECIAL_POSES)
  )
    return false;
  const pose = bolivarSpecialPose(p.attackTick);
  if (!pose) return false;
  return drawAttackArt(
    ctx,
    images,
    "bolivar",
    pose,
    p.x,
    p.y,
    (height * BOLIVAR_BODY_HEIGHTS[pose]) / 494,
    p.facing,
  );
}
