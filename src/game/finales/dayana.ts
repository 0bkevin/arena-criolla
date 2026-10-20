import {
  activeRunway,
  runwayRange,
  runwayWalking,
  RUNWAY_POSE_TICKS,
  type FieldFinaleState,
} from "../../../shared/field-finales";
import type { MatchState } from "../../../shared/engine";
import type { PlayerState, Projectile } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

export const DAYANA_SPECIAL_POSES = ["present", "turn", "sash-wave"] as const;
export const DAYANA_POSES = [
  ...DAYANA_SPECIAL_POSES,
  "walk-a",
  "walk-b",
  "walk-c",
  "walk-d",
  "pose-hip",
  "pose-wave",
  "runway",
] as const;
/** A raised hand or flared hem must not change the size of her head. */
export const dayanaPoseHeight = (pose: string, height: number) =>
  (height * ATTACK_ART.dayana.frames[pose].bodyHeight!) /
  ATTACK_ART.dayana.frames.present.bodyHeight!;
export function dayanaSpecialPose(tick: number) {
  return tick < 15
    ? "present"
    : tick < 35
      ? "turn"
      : tick < 48
        ? "present"
        : undefined;
}
function ribbon(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  height: number,
  facing = 1,
  alpha = 1,
) {
  if (!hasAttackArt(images, "dayana", ["sash-wave"])) return false;
  const f = ATTACK_ART.dayana.frames["sash-wave"];
  return drawAttackArt(
    ctx,
    images,
    "dayana",
    "sash-wave",
    x,
    y + ((f.anchorY! - f.height / 2) * height) / f.bodyHeight!,
    height,
    facing,
    alpha,
  );
}
/** Painted chiffon is centred on the physical projectile, including after reflection. */
export function drawDayanaProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "corona") return false;
  const diameter = (shot.radius ?? 20) * 2;
  if (ribbon(ctx, images, 0, 0, diameter)) return true;
  // Keep the actual hit location visible if optional attack artwork cannot load.
  ctx.save();
  ctx.strokeStyle = "#ffe079";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, diameter * 0.4, -1.3, 1.3);
  ctx.stroke();
  ctx.restore();
  return true;
}
export function drawDayanaSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "dayana" ||
    (p.attack !== "special" && p.attack !== "super") ||
    p.stun ||
    !hasAttackArt(images, "dayana", DAYANA_SPECIAL_POSES)
  )
    return false;
  const pose =
    p.attack === "super" ? "present" : dayanaSpecialPose(p.attackTick);
  if (!pose) return false;
  return drawAttackArt(
    ctx,
    images,
    "dayana",
    pose,
    p.x,
    p.y,
    dayanaPoseHeight(pose, height),
    p.facing,
  );
}

export function runwayPose(tick: number) {
  if (runwayWalking(tick))
    return ["walk-a", "walk-b", "walk-c", "walk-d"][Math.floor(tick / 6) % 4];
  return tick < 60 ? "pose-hip" : "pose-wave";
}
export function drawDayanaRunway(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  field: FieldFinaleState,
) {
  if (!hasAttackArt(images, "dayana", DAYANA_POSES)) return false;
  const range = runwayRange(field),
    frame = ATTACK_ART.dayana.frames.runway,
    width = range.right - range.left;
  const alpha = Math.min(1, field.tick / 8, (field.duration - field.tick) / 12);
  drawAttackArt(
    ctx,
    images,
    "dayana",
    "runway",
    (range.left + range.right) / 2,
    field.y + 18,
    (width * frame.bodyHeight!) / frame.width,
    1,
    alpha,
  );
  return true;
}
/** Her real fighter walks on the temporary runway and remains vulnerable throughout. */
export function drawDayanaRunwayBody(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  state: MatchState,
  player: PlayerState,
  height: number,
) {
  const field = activeRunway(state, player);
  if (!field || !hasAttackArt(images, "dayana", DAYANA_POSES)) return false;
  const pose = runwayPose(field.tick),
    frame = ATTACK_ART.dayana.frames[pose],
    reference = ATTACK_ART.dayana.frames["walk-a"];
  drawAttackArt(
    ctx,
    images,
    "dayana",
    pose,
    player.x,
    player.y,
    (height * frame.bodyHeight!) / reference.bodyHeight!,
    field.direction,
  );
  // A short flourish marks the same local contact area as the simulation pose.
  const at = RUNWAY_POSE_TICKS.find(
    (t) => field.tick >= t && field.tick < t + 10,
  );
  if (at !== undefined) {
    const fade = 1 - (field.tick - at) / 10;
    ribbon(
      ctx,
      images,
      player.x + field.direction * 65,
      player.y - 90,
      48,
      field.direction,
      fade,
    );
  }
  return true;
}
