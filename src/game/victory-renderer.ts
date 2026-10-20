import { fighterById } from "../../shared/content";
import type { MatchState } from "../../shared/engine";
import { drawSprite } from "./assets";
import { drawArticulatedSprite } from "./gesture-rig";
import type { Assets } from "./renderer";
import {
  sampleDefeat,
  sampleVictory,
  victoryById,
  VICTORY_DURATION_MS,
} from "./victory";
import { drawAttackArt } from "./attack-art";

/** Screen-space staging keeps even a ringed-out loser visible for the curtain call. */
export function drawVictory(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  elapsedMs: number,
  reducedMotion: boolean,
) {
  const { width, height } = ctx.canvas;
  const progress = Math.max(0, Math.min(1, elapsedMs / VICTORY_DURATION_MS));
  const winner = typeof state.winner === "number" ? state.winner : null;
  const color =
    winner === null
      ? "#dce5f4"
      : fighterById(state.players[winner].config.fighter).color;
  ctx.save();
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "#070d1ce8");
  shade.addColorStop(0.5, "#070d1c80");
  shade.addColorStop(1, "#070d1ce8");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  const feet = height * 0.85;
  const unit = Math.min(height, width / 1.45);
  const actorX = (side: number) =>
    width *
    (winner === null
      ? side === 0
        ? 0.34
        : 0.66
      : side === winner
        ? side === 0
          ? 0.35
          : 0.65
        : side === 0
          ? 0.17
          : 0.83);

  // All particles are one deterministic burst, with no flashing or replay.
  if (winner !== null && !reducedMotion && progress > 0.09 && progress < 0.92) {
    const flight = (progress - 0.09) / 0.83;
    ctx.globalAlpha = Math.min(1, flight * 8) * (1 - flight);
    for (let n = 0; n < 26; n++) {
      const direction = (n / 25 - 0.5) * 2;
      const x = actorX(winner) + direction * unit * flight * 0.55;
      const y =
        feet -
        unit * (0.32 + Math.sin(flight * Math.PI) * (0.3 + (n % 3) * 0.045));
      ctx.fillStyle = n % 3 === 0 ? "#ffe29a" : n % 3 === 1 ? color : "#f4f7ff";
      ctx.fillRect(
        Math.round(x),
        Math.round(y + (n % 5) * 7),
        4,
        n % 2 ? 7 : 4,
      );
    }
    ctx.globalAlpha = 1;
  }

  // Draw the smaller defeated fighter first, then the winner in the spotlight.
  const order = winner === 0 ? [1, 0] : [0, 1];
  for (const side of order) {
    const player = state.players[side];
    const id = player.config.fighter;
    const sprite = assets.sprites[id];
    const won = side === winner;
    const bodyHeight =
      unit *
      (won ? 0.43 : 0.31) *
      ((fighterById(id).displayHeight ?? 177) / 177);
    const facing = side === 0 ? 1 : -1;
    const x = actorX(side);
    ctx.save();
    ctx.fillStyle = won ? `${color}40` : "#03071180";
    ctx.beginPath();
    ctx.ellipse(
      x,
      feet + 5,
      bodyHeight * 0.32,
      unit * 0.018,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (won) {
      const pose = sampleVictory(id, elapsedMs, reducedMotion);
      ctx.translate(
        x + pose.dx * bodyHeight * facing,
        feet + pose.dy * bodyHeight,
      );
      ctx.rotate(pose.rotate * facing);
      const paintedPose = victoryById(id).paintedPose;
      const painted =
        paintedPose &&
        drawAttackArt(
          ctx,
          assets.finaleProps,
          id,
          paintedPose,
          0,
          0,
          bodyHeight,
          facing,
        );
      if (!painted && reducedMotion)
        drawSprite(ctx, sprite, sprite.battleFrame, 0, 0, bodyHeight, facing);
      else if (!painted)
        drawArticulatedSprite(
          ctx,
          sprite,
          id,
          pose.frame,
          bodyHeight,
          facing,
          pose.gesture,
        );
    } else {
      const pose = sampleDefeat(elapsedMs, reducedMotion);
      ctx.globalAlpha = 0.72;
      ctx.translate(
        x + pose.dx * bodyHeight * facing,
        feet + pose.dy * bodyHeight,
      );
      ctx.rotate(pose.rotate * facing);
      drawSprite(ctx, sprite, 7, 0, 0, bodyHeight, facing);
    }
    ctx.restore();
  }

  ctx.fillStyle = "#ffffff24";
  ctx.fillRect(width * 0.35, height * 0.95, width * 0.3, 3);
  ctx.fillStyle = color;
  ctx.fillRect(width * 0.35, height * 0.95, width * 0.3 * progress, 3);
  ctx.restore();
}
