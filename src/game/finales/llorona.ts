import type {
  Effect,
  MatchState,
  PlayerState,
  Projectile,
} from "../../../shared/engine";
import { drawAttackArt, hasAttackArt } from "../attack-art";

export const LLORONA_POSES = [
  "lure",
  "cast",
  "reveal",
  "embrace-high",
  "embrace-low",
  "recover",
  "portal",
  "wave",
] as const;
const heights: Record<string, number> = {
  lure: 495,
  cast: 452,
  reveal: 437,
  "embrace-high": 475,
  "embrace-low": 399,
  recover: 493,
};
/** One source-pixel scale across all six poses: a crouch never enlarges a head. */
export const lloronaHeight = (pose: string, body = 300) =>
  (heights[pose] * body) / 495;
export const lloronaSpecialPose = (tick: number) =>
  tick < 9
    ? "lure"
    : tick < 14
      ? "cast"
      : tick < 29
        ? "embrace-low"
        : "recover";
export function drawLloronaSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "llorona" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "llorona", LLORONA_POSES)
  )
    return false;
  const pose = lloronaSpecialPose(p.attackTick);
  return drawAttackArt(
    ctx,
    images,
    "llorona",
    pose,
    p.x,
    p.y,
    lloronaHeight(pose, height),
    p.facing,
  );
}
/** Called inside the production projectile translation/facing transform. */
export function drawLloronaProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "undertow" || !hasAttackArt(images, "llorona", ["wave"]))
    return false;
  ctx.shadowBlur = 0;
  return drawAttackArt(ctx, images, "llorona", "wave", 0, 29, 58);
}

/** Preserve the wave on the exact contact frame, including immediate close hits. */
export function drawLloronaImpact(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  images: Record<string, HTMLImageElement>,
  effect: Effect,
) {
  if (
    effect.owner === undefined ||
    state.players[effect.owner].config.fighter !== "llorona" ||
    effect.impact !== "special" ||
    (effect.kind !== "hit" && effect.kind !== "block") ||
    !hasAttackArt(images, "llorona", ["wave"])
  )
    return;
  const age = effect.duration - effect.life;
  if (age > 8) return;
  ctx.save();
  ctx.shadowBlur = 0;
  drawAttackArt(
    ctx,
    images,
    "llorona",
    "wave",
    effect.x,
    effect.y + 29,
    58,
    effect.direction ?? 1,
    1 - age / 9,
  );
  ctx.restore();
}
