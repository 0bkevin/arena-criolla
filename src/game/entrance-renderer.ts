import type { FighterId } from "../../shared/content";
import {
  ENTRANCE_ACTIONS,
  sampleEntranceAction,
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
    scale = height / asset.bodyHeight;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.scale(facing * (key.mirror ? -1 : 1), 1);
  ctx.drawImage(
    asset.image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    (frame.x - frame.slotX - asset.anchorX) * scale,
    (frame.y - frame.slotY - asset.baseline) * scale,
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
  if (!action) {
    drawSprite(ctx, sprite, sprite.battleFrame, 0, 0, height, facing);
  }
  if (action) {
    drawFrame(ctx, asset, action.current, height, facing, 1);
  }
  return true;
}
