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
import { victoryActorLayout } from "./victory-framing";

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
  shade.addColorStop(0, "#091524e8");
  shade.addColorStop(0.48, "#09152470");
  shade.addColorStop(1, "#091524e8");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  const feet = height * 0.88;
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

  if (winner !== null) {
    // The same diagonal as the result screen, mirrored with the winning side.
    const arrival = reducedMotion
      ? 1
      : 1 - (1 - Math.min(1, progress / 0.18)) ** 3;
    ctx.save();
    if (winner === 1) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.globalAlpha = arrival;
    ctx.translate(-width * 0.06 * (1 - arrival), 0);
    const ribbon = ctx.createLinearGradient(0, 0, width * 0.5, height);
    ribbon.addColorStop(0, "#ffd45a66");
    ribbon.addColorStop(1, "#ffd45a0a");
    ctx.fillStyle = ribbon;
    ctx.beginPath();
    ctx.moveTo(width * 0.16, 0);
    ctx.lineTo(width * 0.52, 0);
    ctx.lineTo(width * 0.4, height);
    ctx.lineTo(width * 0.04, height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffd45a80";
    ctx.lineWidth = Math.max(1, unit * 0.002);
    ctx.beginPath();
    ctx.moveTo(width * 0.52, 0);
    ctx.lineTo(width * 0.4, height);
    ctx.stroke();
    ctx.restore();
  }

  // All particles are one deterministic burst, with no flashing or replay.
  if (winner !== null && !reducedMotion && progress > 0.09 && progress < 0.92) {
    const flight = (progress - 0.09) / 0.83;
    ctx.globalAlpha = Math.min(1, flight * 8) * (1 - flight);
    for (let n = 0; n < 32; n++) {
      const direction = (n / 31 - 0.5) * 2;
      const x = actorX(winner) + direction * unit * flight * 0.36;
      const y =
        feet -
        unit * (0.48 + Math.sin(flight * Math.PI) * (0.23 + (n % 3) * 0.03));
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
    const { bodyHeight, facing, x } = victoryActorLayout(
      state,
      sprite,
      side,
      width,
      height,
    );
    ctx.save();
    ctx.fillStyle = "#030a1270";
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
    } else if (winner === null) {
      ctx.translate(x, feet);
      drawSprite(ctx, sprite, sprite.battleFrame, 0, 0, bodyHeight, facing);
    } else {
      const pose = sampleDefeat(elapsedMs, reducedMotion);
      ctx.globalAlpha = 0.48;
      ctx.translate(
        x + pose.dx * bodyHeight * facing,
        feet + pose.dy * bodyHeight,
      );
      ctx.rotate(pose.rotate * facing);
      drawSprite(ctx, sprite, 7, 0, 0, bodyHeight, facing);
    }
    ctx.restore();
  }

  // A restrained frame ties the celebration to the game's yellow arcade trim.
  ctx.fillStyle = "#091524";
  ctx.fillRect(0, 0, width, height * 0.018);
  ctx.fillRect(0, height * 0.982, width, height * 0.018);
  ctx.fillStyle = "#ffd45a";
  ctx.fillRect(
    width * 0.045,
    height * 0.955,
    width * 0.09,
    Math.max(2, unit * 0.004),
  );
  ctx.fillRect(
    width * 0.865,
    height * 0.955,
    width * 0.09,
    Math.max(2, unit * 0.004),
  );
  ctx.restore();
}
