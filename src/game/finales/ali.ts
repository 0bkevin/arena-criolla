import { type PlayerState } from "../../../shared/engine";
import { TECHNIQUES } from "../../../shared/techniques";
import { drawAttackArt, hasAttackArt } from "../attack-art";

export const ALI_ACTOR_POSES = [
  "ready",
  "upstroke",
  "downstroke",
  "accent",
] as const;
export const ALI_CHOIR_POSES = [
  "choir-a",
  "choir-b",
  "choir-c",
  "choir-d",
  "choir-e",
  "choir-f",
] as const;
export const ALI_POSES = [...ALI_ACTOR_POSES, ...ALI_CHOIR_POSES];
// Crown-to-sole measurements in raw-v1. Undo each atlas cell's packing scale
// so leaning into the final strum lowers the head without enlarging the face.
export const ALI_BODY_HEIGHTS: Record<string, number> = {
  ready: 601,
  upstroke: 599,
  downstroke: 597,
  accent: 589,
};
export const aliPoseHeight = (pose: string, height: number) =>
  (height * ALI_BODY_HEIGHTS[pose]) / 601;

/** The downstroke is the actual emission: startup12 plus offsets0/12/24. */
export function aliSpecialPose(tick: number) {
  const beats = TECHNIQUES.strum.pulses!.map(
    (offset) => TECHNIQUES.strum.startup + offset,
  );
  for (const [i, beat] of beats.entries()) {
    if (tick >= beat && tick < beat + 6)
      return i === beats.length - 1 ? "accent" : "downstroke";
    if (tick >= beat - 6 && tick < beat) return "upstroke";
  }
  return "ready";
}
export function drawAliSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "ali" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "ali", ALI_ACTOR_POSES)
  )
    return false;
  const pose = aliSpecialPose(p.attackTick);
  return drawAttackArt(
    ctx,
    images,
    "ali",
    pose,
    p.x,
    p.y,
    aliPoseHeight(pose, height),
    p.facing,
  );
}
