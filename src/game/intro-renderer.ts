import { fighterById, type FighterId } from "../../shared/content";
import { CHOREOGRAPHIES } from "../../shared/choreography";
import type { MatchState } from "../../shared/engine";
import {
  entranceProgress,
  introActor,
  INTRO_COUNTDOWN_START,
  presentationById,
  samplePose,
} from "../../shared/presentation";
import type { SpriteAsset } from "./assets";
import { drawPresentation } from "./presentation-renderer";

/** Frame-aware head tracking keeps every atlas facing and pose in its shot. */
export function introCamera(
  sprite: SpriteAsset,
  frame: number,
  side: 0 | 1,
  tick: number,
  reducedMotion = false,
  id?: FighterId,
) {
  const facing = side === 0 ? 1 : -1;
  const push = reducedMotion ? 0 : Math.min(1, tick / INTRO_COUNTDOWN_START);
  const framing = id ? CHOREOGRAPHIES[id].camera : undefined;
  const height = (framing?.height ?? 760) + push * (sprite.entrance ? 15 : 35);
  const targetX = (side === 0 ? 282 : 798) + (framing?.shift ?? 0) * facing;
  const scale = height / sprite.bodyHeight;
  const source = sprite.frames[frame];
  const headX =
    (sprite.portraitCenters[frame] - sprite.cellWidth / 2) *
    scale *
    facing *
    sprite.frameFacing[frame];
  // Jump frames keep their tucked-leg baseline in drawSprite.
  const top = frame === 4 ? height : source.height * scale;
  return {
    x: targetX - headX,
    targetX,
    feet: sprite.entrance
      ? 120 + height
      : 170 + top - source.height * scale * 0.14,
    height,
    facing,
  };
}

function panelPath(
  ctx: CanvasRenderingContext2D,
  side: number,
  width: number,
  height: number,
) {
  const top = (width * 579) / 1080,
    bottom = (width * 501) / 1080;
  ctx.beginPath();
  if (side === 0) {
    ctx.moveTo(0, 0);
    ctx.lineTo(top, 0);
    ctx.lineTo(bottom, height);
    ctx.lineTo(0, height);
  } else {
    ctx.moveTo(top, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(bottom, height);
  }
  ctx.closePath();
}

export function drawIntroCinematic(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  sprites: Record<string, SpriteAsset>,
  reducedMotion = false,
  viewport = { width: 1080, height: 640 },
) {
  const { width, height } = viewport;
  const scale = height / 640;
  const active = introActor(state.tick);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#070d18";
  ctx.fillRect(0, 0, width, height);
  state.players.forEach((player, index) => {
    const side = index as 0 | 1;
    const id = player.config.fighter;
    const profile = presentationById(id);
    const sprite = sprites[id];
    const progress =
      active === side ? entranceProgress(id, state.tick, side) : 1;
    const pose = samplePose(profile.introBeats, progress);
    const frame = reducedMotion ? profile.battleFrame : pose.frame;
    const camera = introCamera(
      sprite,
      frame,
      side,
      state.tick,
      reducedMotion,
      id,
    );
    const color = fighterById(id).color;
    ctx.save();
    panelPath(ctx, side, width, height);
    ctx.clip();
    const glow = ctx.createRadialGradient(
      (width * (side === 0 ? 260 : 820)) / 1080,
      250 * scale,
      10 * scale,
      (width * (side === 0 ? 260 : 820)) / 1080,
      280 * scale,
      Math.max(520 * scale, width / 2),
    );
    glow.addColorStop(0, color + (active === side ? "8c" : "50"));
    glow.addColorStop(0.6, "#15263c");
    glow.addColorStop(1, "#080f1c");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = active === side ? 1 : 0.82;
    drawPresentation(
      ctx,
      sprite,
      id,
      progress,
      (camera.targetX * width) / 1080 + (camera.x - camera.targetX) * scale,
      camera.feet * scale,
      camera.height * scale,
      camera.facing,
      "intro",
      reducedMotion,
    );
    ctx.globalAlpha = 1;
    const lower = ctx.createLinearGradient(0, 440 * scale, 0, height);
    lower.addColorStop(0, "#070d1800");
    lower.addColorStop(1, "#070d18f5");
    ctx.fillStyle = lower;
    ctx.fillRect(0, 440 * scale, width, 200 * scale);
    ctx.restore();
  });
  ctx.strokeStyle = "#ffdb68";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((width * 579) / 1080, 0);
  ctx.lineTo((width * 501) / 1080, height);
  ctx.stroke();
  ctx.fillStyle = "#ffdb68";
  ctx.font = `italic 800 ${53 * scale}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "#070d18";
  ctx.shadowBlur = 14;
  ctx.fillText("VS", width / 2, 333 * scale);
  ctx.shadowBlur = 0;
  // Letterbox and the tricolor introduce the shot without showing the arena HUD.
  ctx.fillStyle = "#070d18";
  ctx.fillRect(0, 0, width, 24 * scale);
  ctx.fillRect(0, height - 24 * scale, width, 24 * scale);
  ["#ffdb68", "#669bff", "#ff8075"].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect((i * width) / 3, 0, width / 3, 3 * scale);
  });
  ctx.restore();
}
