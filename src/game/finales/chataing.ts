import type {
  MatchState,
  PlayerState,
  Projectile,
} from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

export const CHATAING_POSES = [
  "windup",
  "cast",
  "reel",
  "recover",
  "microphone",
  "screen",
] as const;
export const CHATAING_SPECIAL_POSES = CHATAING_POSES.slice(0, 5);
// One source-pixel scale: bent knees do not make the head larger.
export const CHATAING_BODY_HEIGHTS: Record<string, number> = {
  windup: 451,
  cast: 433,
  reel: 442,
  recover: 442,
};
const height = (pose: string, standing: number) =>
  (CHATAING_BODY_HEIGHTS[pose] / 451) * standing;

export function chataingSpecialPose(player: PlayerState, shot?: Projectile) {
  if (shot) {
    const reach = (shot.x - player.x) * (shot.direction ?? player.facing);
    return !shot.returning && reach > 140 ? "cast" : "reel";
  }
  return player.attackTick < 11 ? "windup" : "recover";
}

function hand(
  pose: string,
  x: number,
  feet: number,
  standing: number,
  facing = 1,
) {
  const scale = standing / 451;
  // Measured cable tips in the unmodified v2 source, relative to body anchor/sole.
  return pose === "cast"
    ? { x: x + facing * 247.5 * scale, y: feet - 289 * scale }
    : { x: x + facing * 141.5 * scale, y: feet - 240 * scale };
}

export function drawMicrophoneCable(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  slack: number,
  width = 3,
) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineCap = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(
      (from.x + to.x) / 2,
      Math.max(from.y, to.y) + slack,
      to.x,
      to.y,
    );
  };
  ctx.lineWidth = width + 1.2;
  ctx.strokeStyle = "#d0d5d5";
  path();
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = "#17191d";
  path();
  ctx.stroke();
  ctx.restore();
}

/** The physics point is the grille, not the centre of the long handle. */
export function drawWiredMicrophone(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  grille: { x: number; y: number },
  direction: number,
  angle = 0,
  length = 40,
  artwork = true,
) {
  ctx.save();
  ctx.translate(grille.x, grille.y);
  ctx.rotate(angle);
  ctx.scale(direction, 1);
  ctx.shadowBlur = 0;
  let painted = false;
  if (artwork && hasAttackArt(images, "chataing", ["microphone"])) {
    // Source width510, core height172. Grille centre is at89% of source width.
    const h = (length * 172) / 510;
    const frame = ATTACK_ART.chataing.frames.microphone;
    const scale = h / (frame.bodyHeight ?? frame.height);
    const feet = ((frame.anchorY ?? frame.height) - frame.height / 2) * scale;
    painted = drawAttackArt(
      ctx,
      images,
      "chataing",
      "microphone",
      -length * 0.39,
      feet,
      h,
    );
  }
  if (!painted) {
    ctx.fillStyle = "#22252a";
    ctx.strokeStyle = "#aab0b4";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-length * 0.86, -3.5, length * 0.7, 7, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#747d84";
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "#242a2f";
    ctx.lineWidth = 0.8;
    for (let n = -8; n <= 8; n += 3) {
      ctx.beginPath();
      ctx.moveTo(n, -8);
      ctx.lineTo(n, 8);
      ctx.moveTo(-8, n);
      ctx.lineTo(8, n);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  return {
    x: grille.x - direction * length * 0.89 * Math.cos(angle),
    y: grille.y - direction * length * 0.89 * Math.sin(angle),
  };
}

/** Draw after the actor so the cable connects visibly to its painted hand. */
export function drawChataingSpecial(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  images: Record<string, HTMLImageElement>,
  player: PlayerState,
  index: number,
  standing: number,
): boolean {
  if (player.config.fighter !== "chataing") return false;
  const shot = state.projectiles.find((p) => p.owner === index && p.tether);
  if (!shot && (player.attack !== "special" || player.stun)) return false;
  if (!hasAttackArt(images, "chataing", CHATAING_SPECIAL_POSES)) return false;
  const pose = chataingSpecialPose(player, shot);
  const facing = shot?.direction ?? player.facing;
  drawAttackArt(
    ctx,
    images,
    "chataing",
    pose,
    player.x,
    player.y,
    height(pose, standing),
    facing,
  );
  if (shot) drawChataingTether(ctx, images, player, shot, pose, standing);
  return true;
}

export function drawChataingTether(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  player: PlayerState,
  shot: Projectile,
  pose: string,
  standing: number,
  artwork = true,
) {
  const facing = shot.direction ?? player.facing;
  const from = hand(pose, player.x, player.y, standing, facing);
  const length = (40 * standing) / 177;
  const to = { x: shot.x - facing * length * 0.89, y: shot.y };
  drawMicrophoneCable(ctx, from, to, shot.returning ? 16 : 7, 2.2);
  drawWiredMicrophone(ctx, images, shot, facing, 0, length, artwork);
}
