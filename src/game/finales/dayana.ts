import {
  activeRunway,
  runwayRange,
  runwayWalking,
  type FieldFinaleState,
} from "../../../shared/field-finales";
import type { MatchState } from "../../../shared/engine";
import type { PlayerState } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

export const DAYANA_SPECIAL_POSES = [
  "present",
  "spin-front",
  "spin-side",
  "spin-back",
  "spin-finish",
] as const;
export const DAYANA_POSES = [
  ...DAYANA_SPECIAL_POSES,
  "walk-a",
  "walk-b",
  "walk-c",
  "walk-d",
  "pose-hip",
  "pose-wave",
  "pose-shoulder",
  "pose-front",
  "runway",
] as const;
/** A raised hand or flared hem must not change the size of her head. */
export const dayanaPoseHeight = (pose: string, height: number) =>
  (height * ATTACK_ART.dayana.frames[pose].bodyHeight!) /
  ATTACK_ART.dayana.frames.present.bodyHeight!;
export function dayanaSpecialPose(tick: number) {
  if (tick < 10) return "spin-front";
  if (tick < 19) return "spin-side";
  if (tick < 27) return "spin-back";
  if (tick < 42) return "spin-finish";
  return tick < 54 ? "present" : undefined;
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
  if (tick < 60) return "pose-hip";
  if (tick < 108) return "pose-shoulder";
  return tick < 158 ? "pose-front" : "pose-wave";
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
  return true;
}
