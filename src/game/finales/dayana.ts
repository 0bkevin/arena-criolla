import { fighterById } from "../../../shared/content";
import type { PlayerState, Projectile } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const DAYANA_SPECIAL_POSES = ["present", "turn", "sash-wave"] as const;
export const DAYANA_POSES = [
  ...DAYANA_SPECIAL_POSES,
  "crowned",
  "salute",
  "crown",
] as const;
export const DAYANA_CONTACT_TICKS = [60, 96, 132] as const;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
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
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "dayana", DAYANA_SPECIAL_POSES)
  )
    return false;
  const pose = dayanaSpecialPose(p.attackTick);
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

/** Gown, coronation and three golden flourishes stay inside the existing arena. */
export function drawDayanaFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "dayana", DAYANA_POSES)) return false;
  const { ctx, tick } = view,
    source = view.point(306, 514),
    target = view.point(782, 514);
  const poses = ["present", "turn", "crowned", "salute"];
  const ranges = poses.map((p) =>
    finaleArtXRange(
      view.viewport,
      ATTACK_ART.dayana.frames[p],
      dayanaPoseHeight(p, 300),
    ),
  );
  const minX = Math.max(...ranges.map((r) => r.minX)),
    maxX = Math.min(...ranges.map((r) => r.maxX));
  const endX = clamp(source.x, minX, maxX),
    blend = Math.min(smooth(tick / 12), smooth((180 - tick) / 12));
  const x = source.x + (endX - source.x) * blend;
  const pose =
    tick < 18
      ? "present"
      : tick < 60
        ? "turn"
        : tick < 96
          ? "crowned"
          : "salute";
  const h = (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  view.body(view.rival, 782, 514, 300, -1, view.pulse ? "hurt" : "stand");
  drawAttackArt(
    ctx,
    view.images,
    "dayana",
    pose,
    x,
    source.y,
    dayanaPoseHeight(pose, 300),
  );
  if (tick >= 40 && tick < 60) {
    const settle = smooth((tick - 40) / 20);
    drawAttackArt(
      ctx,
      view.images,
      "dayana",
      "crown",
      x + 4,
      source.y - 290 - (1 - settle) * (view.motion ? 45 : 12),
      35,
      1,
      settle,
    );
  }
  for (const [i, at] of DAYANA_CONTACT_TICKS.entries()) {
    const start = at - 22;
    if (tick < start || tick >= at + 12) continue;
    const travel = clamp((tick - start) / 22),
      fade = 1 - clamp((tick - at) / 12);
    const toY = target.y - h * (0.43 + i * 0.12);
    const px = x + 65 + (target.x - 18 - x - 65) * travel;
    const py =
      source.y -
      140 +
      (toY - source.y + 140) * travel -
      Math.sin(travel * Math.PI) * (view.motion ? 28 : 0);
    ribbon(ctx, view.images, px, py, 66, 1, fade);
    if (tick >= at) {
      ctx.save();
      ctx.globalAlpha *= fade;
      ctx.strokeStyle = "#fff1a3";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x - 18, toY, 22 + (tick - at) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  view.damage(115);
  return true;
}
