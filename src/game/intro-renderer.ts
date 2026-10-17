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

function panelPath(ctx: CanvasRenderingContext2D, side: number) {
  ctx.beginPath();
  if (side === 0) {
    ctx.moveTo(0, 0);
    ctx.lineTo(579, 0);
    ctx.lineTo(501, 640);
    ctx.lineTo(0, 640);
  } else {
    ctx.moveTo(579, 0);
    ctx.lineTo(1080, 0);
    ctx.lineTo(1080, 640);
    ctx.lineTo(501, 640);
  }
  ctx.closePath();
}

export function drawIntroCinematic(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  sprites: Record<string, SpriteAsset>,
  reducedMotion = false,
) {
  const active = introActor(state.tick);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#070d18";
  ctx.fillRect(0, 0, 1080, 640);
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
    panelPath(ctx, side);
    ctx.clip();
    const glow = ctx.createRadialGradient(
      side === 0 ? 260 : 820,
      250,
      10,
      side === 0 ? 260 : 820,
      280,
      520,
    );
    glow.addColorStop(0, color + (active === side ? "8c" : "50"));
    glow.addColorStop(0.6, "#15263c");
    glow.addColorStop(1, "#080f1c");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 640);
    ctx.globalAlpha = active === side ? 1 : 0.82;
    drawPresentation(
      ctx,
      sprite,
      id,
      progress,
      camera.x,
      camera.feet,
      camera.height,
      camera.facing,
      "intro",
      reducedMotion,
    );
    ctx.globalAlpha = 1;
    const lower = ctx.createLinearGradient(0, 440, 0, 640);
    lower.addColorStop(0, "#070d1800");
    lower.addColorStop(1, "#070d18f5");
    ctx.fillStyle = lower;
    ctx.fillRect(0, 440, 1080, 200);
    ctx.restore();
  });
  ctx.strokeStyle = "#ffdb68";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(579, 0);
  ctx.lineTo(501, 640);
  ctx.stroke();
  ctx.fillStyle = "#ffdb68";
  ctx.font = 'italic 800 53px "Barlow Condensed", sans-serif';
  ctx.textAlign = "center";
  ctx.shadowColor = "#070d18";
  ctx.shadowBlur = 14;
  ctx.fillText("VS", 540, 333);
  ctx.shadowBlur = 0;
  // Letterbox and the tricolor introduce the shot without showing the arena HUD.
  ctx.fillStyle = "#070d18";
  ctx.fillRect(0, 0, 1080, 24);
  ctx.fillRect(0, 616, 1080, 24);
  ["#ffdb68", "#669bff", "#ff8075"].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * 360, 0, 360, 3);
  });
  ctx.restore();
}
