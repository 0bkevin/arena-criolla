import type { PlayerState, Projectile } from "../../../shared/engine";
import { TECHNIQUES } from "../../../shared/techniques";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

type Images = Record<string, HTMLImageElement>;

export function cocoSpecialPose(tick: number) {
  const release = tick - TECHNIQUES.remittance.startup;
  if (tick < 7) return "draw";
  if (release < 0) return "tap";
  if (release >= 22) return "recover";
  return release % 14 < 8 ? "send" : "tap";
}

/** The phone gesture replaces the canonical body, without moving the fighter. */
export function drawCocoSpecial(
  ctx: CanvasRenderingContext2D,
  images: Images,
  player: PlayerState,
  height: number,
) {
  if (
    player.config.fighter !== "kevin" ||
    player.attack !== "special" ||
    player.stun
  )
    return false;
  return drawAttackArt(
    ctx,
    images,
    "kevin",
    cocoSpecialPose(player.attackTick),
    player.x,
    player.y,
    height,
    player.facing,
  );
}

/** Local projectile coordinates match the physical circle, including reflection. */
export function drawCocoProjectile(
  ctx: CanvasRenderingContext2D,
  images: Images,
  shot: Projectile,
) {
  if (shot.kind !== "remittance") return false;
  const pose = shot.finaleArt?.pose ?? "token",
    height = (shot.radius ?? 15) * 2;
  ctx.save();
  ctx.shadowBlur = 0;
  const frame = ATTACK_ART.kevin?.frames[pose];
  if (frame && hasAttackArt(images, "kevin", [pose])) {
    const scale = height / (frame.bodyHeight ?? frame.height);
    drawAttackArt(
      ctx,
      images,
      "kevin",
      pose,
      (frame.anchorX - frame.width / 2) * scale,
      ((frame.anchorY ?? frame.height) - frame.height / 2) * scale,
      height,
    );
  } else {
    // A failed optional bitmap must not make a damaging payment invisible.
    const radius = height / 2;
    ctx.fillStyle = "#00dc8e";
    ctx.strokeStyle = "#073e2f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  return true;
}
