import { finaleById } from "../../../shared/finales";
import type { PlayerState, Projectile } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { finaleArtXRange, finaleViewportBounds } from "../finale-viewport";

export const MAITE_POSES = ["breath", "shout", "sustain", "recover"] as const;
const posture = { breath: 1, shout: 1.04, sustain: 1, recover: 1 };
export function maiteFinalePose(tick: number) {
  return tick < 9
    ? "breath"
    : tick < 27
      ? "shout"
      : tick < 68
        ? "sustain"
        : "recover";
}

/** Normal arena actor; only the outer cape is kept within the existing viewport. */
export function drawMaiteFinaleBody(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  player: PlayerState,
  height: number,
): boolean {
  if (
    player.config.fighter !== "maite" ||
    player.attack !== "super" ||
    player.stun ||
    !hasAttackArt(images, "maite", MAITE_POSES)
  )
    return false;
  const pose = maiteFinalePose(player.attackTick);
  // Raised fingers are above the head: equal head-to-floor scale across poses.
  const viewport = finaleViewportBounds(ctx);
  const ranges = MAITE_POSES.map((name) =>
    finaleArtXRange(
      viewport,
      ATTACK_ART.maite.frames[name],
      height * posture[name],
      player.facing,
    ),
  );
  const left = Math.max(...ranges.map((range) => range.minX));
  const right = Math.min(...ranges.map((range) => range.maxX));
  // A compact cape still crosses an extreme ledge during impact shake. A common
  // interval avoids per-pose sliding; physics, projectile origin and camera stay unchanged.
  const x =
    left <= right ? Math.max(left, Math.min(right, player.x)) : player.x;
  return drawAttackArt(
    ctx,
    images,
    "maite",
    pose,
    x,
    player.y,
    height * posture[pose],
    player.facing,
  );
}

/** Concentric wave fronts are analytic geometry tied directly to the hit radius. */
export function drawSonicProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
  reducedMotion: boolean,
) {
  const radius = shot.radius ?? 20;
  ctx.save();
  ctx.shadowBlur = reducedMotion ? 0 : 12;
  ctx.shadowColor = "#ffe8b0";
  ctx.lineCap = "round";
  for (let ring = 0; ring < 3; ring++) {
    const r = radius * (1 - ring * 0.15);
    ctx.strokeStyle = ["#fff7d6", "#ffc76d", "#ff915f"][ring];
    ctx.lineWidth = 5 - ring;
    ctx.globalAlpha *= ring ? 0.86 : 1;
    ctx.beginPath();
    ctx.ellipse(
      -ring * radius * 0.42,
      0,
      r * 0.55,
      r,
      0,
      -Math.PI * 0.62,
      Math.PI * 0.62,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Separate spoken caption; the standard overhead combat label remains Definitiva. */
export function drawMaiteGreeting(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
) {
  if (
    player.config.fighter !== "maite" ||
    player.attack !== "super" ||
    player.stun ||
    player.attackTick < 9 ||
    player.attackTick >= 68
  )
    return;
  const bounds = finaleViewportBounds(ctx);
  const width = 310,
    half = width / 2;
  const x = bounds
    ? Math.max(
        bounds.left + half + 12,
        Math.min(bounds.right - half - 12, player.x),
      )
    : player.x;
  const y = bounds
    ? Math.max(bounds.top + 45, Math.min(bounds.bottom - 36, player.y - 305))
    : player.y - 305;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff4db";
  ctx.strokeStyle = "#bd4a25";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - half, y - 33, width, 57, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6e2c1b";
  ctx.textAlign = "center";
  ctx.font = '800 18px "Barlow Condensed", sans-serif';
  const caption = finaleById("maite")!.caption;
  const split = caption.indexOf(",") + 1;
  ctx.fillText(caption.slice(0, split), x, y - 9);
  ctx.fillText(caption.slice(split).trim(), x, y + 13);
  ctx.restore();
}
