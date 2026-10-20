import type { FighterId } from "../../shared/content";
import {
  ENTRANCE_ACTIONS,
  sampleEntranceAction,
  sampleEntranceBall,
  type ActionFrame,
} from "../../shared/entrance-actions";
import { drawSprite, type EntranceAsset, type SpriteAsset } from "./assets";

function drawFrame(
  ctx: CanvasRenderingContext2D,
  asset: EntranceAsset,
  key: ActionFrame,
  height: number,
  facing: number,
  opacity: number,
) {
  if (opacity <= 0) return;
  const frame = asset.frames[key.frame],
    scale = height / (frame.bodyHeight ?? asset.bodyHeight);
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.scale(facing * (key.mirror ? -1 : 1), 1);
  ctx.drawImage(
    asset.image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    (frame.anchorX !== undefined
      ? -frame.anchorX
      : frame.x - frame.slotX - asset.anchorX) * scale,
    (frame.anchorY !== undefined
      ? -frame.anchorY
      : frame.y - frame.slotY - asset.baseline) * scale,
    frame.width * scale,
    frame.height * scale,
  );
  ctx.restore();
}

/** Play a painted entrance once; endpoints use the actual combat atlas. */
export function drawEntranceAction(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  id: FighterId,
  progress: number,
  height: number,
  facing: number,
): boolean {
  const asset = sprite.entrance;
  if (!asset || !ENTRANCE_ACTIONS[id]) return false;
  const action = sampleEntranceAction(id, progress);
  if (action) {
    const width = asset.image.naturalWidth || asset.image.width,
      bitmapHeight = asset.image.naturalHeight || asset.image.height;
    const complete = ENTRANCE_ACTIONS[id]!.frames.every(({ frame: index }) => {
      const f = asset.frames[index];
      return (
        f &&
        f.x >= 0 &&
        f.y >= 0 &&
        f.width > 0 &&
        f.height > 0 &&
        f.x + f.width <= width &&
        f.y + f.height <= bitmapHeight &&
        (f.bodyHeight ?? asset.bodyHeight) > 0
      );
    });
    const ball = asset.ball;
    if (
      !complete ||
      (ENTRANCE_ACTIONS[id]!.ball &&
        (!ball ||
          ball.x < 0 ||
          ball.y < 0 ||
          ball.width <= 0 ||
          ball.height <= 0 ||
          ball.x + ball.width > width ||
          ball.y + ball.height > bitmapHeight))
    )
      return false;
  }
  if (!action) {
    drawSprite(ctx, sprite, sprite.battleFrame, 0, 0, height, facing);
  }
  if (action) {
    drawFrame(ctx, asset, action.current, height, facing, 1);
    const ball = sampleEntranceBall(id, progress);
    if (ball && asset.ball) {
      const frame = asset.ball,
        diameter = height * 0.115,
        width = (diameter * frame.width) / frame.height;
      ctx.save();
      ctx.globalAlpha *= ball.alpha;
      ctx.drawImage(
        asset.image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        ball.x * height * facing - width / 2,
        ball.y * height - diameter / 2,
        width,
        diameter,
      );
      ctx.restore();
    }
  }
  return true;
}
