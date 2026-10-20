import {
  SQUAD_COUNT,
  SQUAD_LAUNCH_TICK,
  squadMember,
  type FieldFinaleState,
} from "../../../shared/field-finales";
import { type PlayerState, type Projectile } from "../../../shared/engine";
import { TECHNIQUES } from "../../../shared/techniques";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

export const DEYNA_SPECIAL_POSES = [
  "windup",
  "contact",
  "recover",
  "ball",
] as const;
export const DEYNA_POSES = [
  ...DEYNA_SPECIAL_POSES,
  ...Array.from({ length: SQUAD_COUNT }, (_, i) =>
    ["windup", "contact", "recover"].map((pose) => `squad-${i}-${pose}`),
  ).flat(),
];
// Whole-figure source scaling: do not normalize bent poses by their bbox height.
export const DEYNA_BODY_HEIGHTS: Record<string, number> = {
  windup: 516,
  contact: 489.44645340751043,
  recover: 518.1529902642559,
};
export const deynaPoseHeight = (pose: string, height: number) =>
  (height * DEYNA_BODY_HEIGHTS[pose]) / 516;
export function deynaSpecialPose(tick: number) {
  return tick < 18
    ? "windup"
    : tick < 29
      ? "contact"
      : tick < 42
        ? "recover"
        : undefined;
}

/** The ball's centre is the engine centre, independent of transparent sheet padding. */
export function drawDeynaBall(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  diameter: number,
  angle = 0,
  alpha = 1,
) {
  if (!hasAttackArt(images, "deyna", ["ball"])) return false;
  const f = ATTACK_ART.deyna.frames.ball;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 0;
  const result = drawAttackArt(
    ctx,
    images,
    "deyna",
    "ball",
    0,
    ((f.anchorY! - f.height / 2) * diameter) / f.bodyHeight!,
    diameter,
    1,
    alpha,
  );
  ctx.restore();
  return result;
}
export function drawDeynaBallProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "football") return false;
  if (
    drawDeynaBall(
      ctx,
      images,
      0,
      0,
      (shot.radius ?? 13) * 2,
      (shot.age ?? 0) * 0.14,
    )
  )
    return true;
  // Optional sheet failure still exposes the physical round ball, never a crown.
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, shot.radius ?? 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const x = Math.cos(a) * 5,
      y = Math.sin(a) * 5;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return true;
}
export function drawDeynaSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "deyna" ||
    (p.attack !== "special" && p.attack !== "super") ||
    p.stun ||
    !hasAttackArt(images, "deyna", DEYNA_SPECIAL_POSES)
  )
    return false;
  const pose =
    p.attack === "super" ? "recover" : deynaSpecialPose(p.attackTick);
  if (!pose) return false;
  drawAttackArt(
    ctx,
    images,
    "deyna",
    pose,
    p.x,
    p.y,
    deynaPoseHeight(pose, height),
    p.facing,
  );
  // Exactly one staged ball before emission. The engine takes over at startup21.
  if (p.attack === "special" && p.attackTick < TECHNIQUES.football.startup) {
    const shot = TECHNIQUES.football.projectile!;
    drawDeynaBall(
      ctx,
      images,
      p.x + p.facing * shot.offsetX!,
      p.y - shot.offsetY!,
      26,
    );
  }
  return true;
}

/** Five independently painted teammates stay in world space while combat continues. */
export function drawDeynaSquad(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  field: FieldFinaleState,
  layer?: "back" | "front",
) {
  if (!hasAttackArt(images, "deyna", DEYNA_POSES)) return false;
  const pose =
    field.tick < SQUAD_LAUNCH_TICK
      ? "windup"
      : field.tick < SQUAD_LAUNCH_TICK + 12
        ? "contact"
        : "recover";
  const alpha = Math.min(1, field.tick / 8, (field.duration - field.tick) / 12);
  for (let i = 0; i < SQUAD_COUNT; i++) {
    const member = squadMember(field, i);
    if (layer && member.layer !== layer) continue;
    drawAttackArt(
      ctx,
      images,
      "deyna",
      `squad-${i}-${pose}`,
      member.x,
      member.y,
      member.height * (pose === "contact" ? 0.95 : 1),
      field.direction,
      alpha,
    );
    if (field.tick < SQUAD_LAUNCH_TICK)
      drawDeynaBall(
        ctx,
        images,
        member.x + field.direction * 48,
        member.y - 16,
        26,
        0,
        alpha,
      );
  }
  return true;
}
