import {
  type Effect,
  type MatchState,
  type PlayerState,
  type Projectile,
} from "../../../shared/engine";
import { drawAttackArt, hasAttackArt } from "../attack-art";

export const DUDAMEL_POSES = [
  "ready",
  "upbeat",
  "downbeat",
  "fortissimo",
  "orchestra",
] as const;
// Same source-pixel scale in every pose. The raised baton is not body height.
const sourceHeights: Record<string, number> = {
  ready: 528,
  upbeat: 593,
  downbeat: 507,
  fortissimo: 564,
};
export const dudamelHeight = (pose: string, body = 305) =>
  (sourceHeights[pose] * body) / 528;
export function dudamelSpecialPose(tick: number) {
  return tick < 7
    ? "ready"
    : tick < 18
      ? "upbeat"
      : tick < 29
        ? "downbeat"
        : "ready";
}

/** Abstract musical effect. Its radius is the physical projectile radius. */
export function drawDudamelWave(
  ctx: CanvasRenderingContext2D,
  radius: number,
  age = 0,
) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#c6c4ff";
  ctx.strokeStyle = "#eee8ff";
  ctx.lineWidth = 2.5;
  ctx.globalAlpha *= 0.24;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.24;
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.stroke();
  ctx.globalAlpha *= 0.72;
  ctx.beginPath();
  ctx.arc(-radius * 0.22, 0, radius * 0.7, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * radius * 0.4,
      y = Math.sin(i * 2 + age * 0.08) * radius * 0.3;
    const size = Math.max(3, radius * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.7, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.8, y);
    ctx.lineTo(x + size * 0.8, y - size * 3);
    ctx.lineTo(x + size * 2, y - size * 2.6);
    ctx.stroke();
  }
  ctx.restore();
}
export function drawDudamelProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
) {
  if (shot.kind !== "cadenza") return false;
  drawDudamelWave(ctx, shot.radius ?? 24, shot.age ?? 0);
  return true;
}

/** A consumed close-range shot still shows its musical burst on the hit frame. */
export function drawDudamelImpact(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  e: Effect,
) {
  if (
    e.owner === undefined ||
    state.players[e.owner].config.fighter !== "dudamel" ||
    e.impact !== "special" ||
    (e.kind !== "hit" && e.kind !== "block")
  )
    return;
  const age = e.duration - e.life;
  if (age > 9) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.direction ?? 1, 1);
  ctx.globalAlpha *= 1 - age / 10;
  drawDudamelWave(ctx, 24 + age * 2, age);
  ctx.restore();
}
export function drawDudamelSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "dudamel" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "dudamel", DUDAMEL_POSES.slice(0, 4))
  )
    return false;
  const pose = dudamelSpecialPose(p.attackTick);
  return drawAttackArt(
    ctx,
    images,
    "dudamel",
    pose,
    p.x,
    p.y,
    dudamelHeight(pose, height),
    p.facing,
  );
}
