import type { FighterId } from "../../shared/content";
import { drawAttackArt } from "./attack-art";
import { drawSprite } from "./assets";
import { drawArticulatedSprite } from "./gesture-rig";
import type { Assets } from "./renderer";
import { sampleVictory, victoryById } from "./victory";

/** Paint the same winner, including authored artwork, in the arena and handoff. */
export function drawVictoryPose(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  id: FighterId,
  elapsedMs: number,
  bodyHeight: number,
  facing: number,
  reducedMotion = false,
) {
  const sprite = assets.sprites[id];
  const pose = sampleVictory(id, elapsedMs, reducedMotion);
  ctx.save();
  ctx.translate(pose.dx * bodyHeight * facing, pose.dy * bodyHeight);
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
  ctx.restore();
}
