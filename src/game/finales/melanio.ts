import type { PlayerState, Projectile } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

export const MELANIO_FINAL_POSES = [
  "record",
  "windup",
  "strike-high",
  "strike-low",
  "recover",
] as const;
export const MELANIO_SPECIAL_POSES = [
  "signal-windup",
  "signal-release",
  "signal",
] as const;
export const MELANIO_POSES = [...MELANIO_FINAL_POSES, ...MELANIO_SPECIAL_POSES];
// Effective crown-to-sole source dimensions, calibrated to the same 424px body.
// Separate generations receive a uniform whole-figure scale, never a head patch.
export const MELANIO_BODY_HEIGHTS: Record<string, number> = {
  record: 424,
  windup: 424,
  "strike-high": 958 * 0.44,
  "strike-low": 334,
  recover: 433,
  "signal-windup": 667 * 0.65,
  "signal-release": 1142 * 0.378,
};
export const melanioPoseHeight = (pose: string, height: number) =>
  (height * MELANIO_BODY_HEIGHTS[pose]) / 424;
const unit = (n: number) => Math.max(0, Math.min(1, n));

export function melanioSpecialPose(tick: number) {
  return tick < 21 ? "signal-windup" : tick < 29 ? "signal-release" : undefined;
}
export function drawMelanioSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "melanio" ||
    p.attack !== "special" ||
    p.stun ||
    !images ||
    !hasAttackArt(images, "melanio", MELANIO_SPECIAL_POSES)
  )
    return false;
  const pose = melanioSpecialPose(p.attackTick);
  if (!pose) return false;
  return drawAttackArt(
    ctx,
    images,
    "melanio",
    pose,
    p.x,
    p.y,
    melanioPoseHeight(pose, height),
    p.facing,
  );
}

/** Painted gathering light; no stale square/arc effect remains after release. */
export function drawMelanioSignalCharge(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "melanio" ||
    !images ||
    !hasAttackArt(images, "melanio", MELANIO_SPECIAL_POSES)
  )
    return false;
  if (!p.stun && p.attack === "special" && p.attackTick < 21) {
    const amount = unit(p.attackTick / 21),
      h = ((7 + amount * 10) * height) / 177;
    const frame = ATTACK_ART.melanio.frames.signal;
    ctx.save();
    ctx.shadowBlur = 0;
    drawAttackArt(
      ctx,
      images,
      "melanio",
      "signal",
      p.x + (p.facing * 20 * height) / 177,
      p.y -
        (98 * height) / 177 +
        ((frame.anchorY! - frame.height / 2) * h) / frame.bodyHeight!,
      h,
      p.facing,
      0.35 + amount * 0.5,
    );
    ctx.restore();
  }
  return true;
}

/** The pulse is centred on the real hitbox and follows velocity on return/reflection. */
export function drawMelanioSignal(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (
    shot.kind !== "signal" ||
    !images ||
    !hasAttackArt(images, "melanio", MELANIO_SPECIAL_POSES)
  )
    return false;
  const frame = ATTACK_ART.melanio.frames.signal;
  const h = 34;
  ctx.save();
  ctx.shadowBlur = 0;
  // A single warm halo distinguishes the return without tinting source artwork.
  if (!!shot.returnAfter && (shot.age ?? 0) >= shot.returnAfter) {
    ctx.strokeStyle = "#ffd788";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const result = drawAttackArt(
    ctx,
    images,
    "melanio",
    "signal",
    0,
    ((frame.anchorY! - frame.height / 2) * h) / frame.bodyHeight!,
    h,
  );
  ctx.restore();
  return result;
}
