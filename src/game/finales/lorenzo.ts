import { type PlayerState, type Projectile } from "../../../shared/engine";
import { TECHNIQUES } from "../../../shared/techniques";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

export const LORENZO_SPECIAL_POSES = [
  "windup",
  "throw",
  "recover",
  "bag",
] as const;
export const LORENZO_POSES = [
  ...LORENZO_SPECIAL_POSES,
  "ride-right",
  "ride-left",
  "truck-right",
  "truck-left",
  "front-right",
  "front-left",
] as const;
export const LORENZO_BODY_HEIGHTS: Record<string, number> = {
  windup: 559,
  throw: 1068 * 0.52,
  recover: 582,
};
export function lorenzoSpecialPose(tick: number) {
  return tick < 11
    ? "windup"
    : tick < 23
      ? "throw"
      : tick < 43
        ? "recover"
        : undefined;
}
export const lorenzoPoseHeight = (pose: string, height: number) =>
  (height * LORENZO_BODY_HEIGHTS[pose]) / 559;

/** The package remains upright in screen space, including a reflected projectile. */
export function drawLorenzoBag(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  height: number,
) {
  if (!hasAttackArt(images, "lorenzo", ["bag"])) return false;
  const f = ATTACK_ART.lorenzo.frames.bag;
  const mirror =
    typeof ctx.getTransform === "function" && ctx.getTransform().a < 0 ? -1 : 1;
  return drawAttackArt(
    ctx,
    images,
    "lorenzo",
    "bag",
    x,
    y + ((f.anchorY! - f.height / 2) * height) / f.bodyHeight!,
    height,
    mirror,
  );
}
export function drawLorenzoProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "polar") return false;
  ctx.save();
  ctx.shadowBlur = 0;
  if (!drawLorenzoBag(ctx, images, 0, 0, (shot.radius ?? 16) * 2.6)) {
    // An absent optional sheet keeps the hit location visible without the obsolete stars.
    ctx.fillStyle = "#e9c348";
    ctx.strokeStyle = "#203356";
    ctx.fillRect(-10, -16, 20, 32);
    ctx.strokeRect(-10, -16, 20, 32);
  }
  ctx.restore();
  return true;
}
export function drawLorenzoSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "lorenzo" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "lorenzo", LORENZO_SPECIAL_POSES)
  )
    return false;
  const pose = lorenzoSpecialPose(p.attackTick);
  if (!pose) return false;
  drawAttackArt(
    ctx,
    images,
    "lorenzo",
    pose,
    p.x,
    p.y,
    lorenzoPoseHeight(pose, height),
    p.facing,
  );
  if (p.attackTick < TECHNIQUES.polar.startup) {
    const unit = height / 177;
    const x = pose === "windup" ? -10 : TECHNIQUES.polar.projectile!.offsetX!;
    const y = pose === "windup" ? 66 : TECHNIQUES.polar.projectile!.offsetY!;
    for (let n = -1; n <= 1; n++)
      drawLorenzoBag(
        ctx,
        images,
        p.x + p.facing * (x + n * 7) * unit,
        p.y - (y + n * 9) * unit,
        38 * unit,
      );
  }
  return true;
}
