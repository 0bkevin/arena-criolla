import type { FighterId } from "../../../shared/roster/roster";
import {
  ENTRANCE_ACTIONS,
  sampleEntranceAction,
  sampleEntranceBall,
  type ActionFrame,
} from "../choreography/entrance-actions";
import {
  drawSprite,
  type EntranceAsset,
  type SpriteAsset,
} from "../assets/assets";
import { unmirrorLettering } from "../assets/readable-text";

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
  const destination = {
    x:
      (frame.anchorX !== undefined
        ? -frame.anchorX
        : frame.x - frame.slotX - asset.anchorX) * scale,
    y:
      (frame.anchorY !== undefined
        ? -frame.anchorY
        : frame.y - frame.slotY - asset.baseline) * scale,
    width: frame.width * scale,
    height: frame.height * scale,
  };
  ctx.drawImage(
    asset.image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  );
  unmirrorLettering(
    ctx,
    asset.image,
    frame,
    { image: asset.image, x: frame.x, y: frame.y },
    destination,
  );
  ctx.restore();
}

/** Painted frames give way to the combat stance at this progress. */
const ENTRANCE_END = 0.9;
/** Share of the entrance spent dissolving from and back to the stance. */
const ENTRANCE_FADE = 0.04;

/** Opacity of the painted entrance over the combat stance at `progress`. */
export function entranceWeight(progress: number): number {
  if (progress <= 0 || progress >= ENTRANCE_END + ENTRANCE_FADE / 2) return 0;
  if (progress < ENTRANCE_FADE) return progress / ENTRANCE_FADE;
  const out = (progress - (ENTRANCE_END - ENTRANCE_FADE / 2)) / ENTRANCE_FADE;
  return Math.max(0, Math.min(1, 1 - out));
}

/** One-shot entrances use the combat atlas at their endpoints; loops keep the painted poses. */
export function drawEntranceAction(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  id: FighterId,
  progress: number,
  height: number,
  facing: number,
  repeat = false,
): boolean {
  const asset = sprite.entrance;
  if (!asset || !ENTRANCE_ACTIONS[id]) return false;
  // How much of the painted entrance shows; the rest is the combat stance.
  // Repeated portraits stay fully painted across the loop boundary.
  const painted = repeat ? 1 : entranceWeight(progress);
  const action =
    painted > 0
      ? sampleEntranceAction(
          id,
          repeat
            ? progress
            : Math.min(Math.max(progress, 1e-4), ENTRANCE_END - 1e-4),
          repeat,
        )
      : null;
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
  const stance = (alpha: number) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    drawSprite(ctx, sprite, sprite.battleFrame, 0, 0, height, facing);
    ctx.restore();
  };
  if (!action) {
    stance(1);
    return true;
  }
  // Dissolve between the stance and the painted entrance at both ends instead
  // of cutting. The outgoing pose stays opaque under the incoming one until the
  // midpoint, so the figure never turns see-through while they overlap.
  const fadingIn = progress < ENTRANCE_FADE;
  const incoming = fadingIn ? painted : 1 - painted;
  const under = Math.min(1, 2 * (1 - incoming)),
    over = Math.min(1, 2 * incoming);
  const entranceAlpha = fadingIn ? over : under;
  if (fadingIn) stance(under);
  {
    drawFrame(ctx, asset, action.current, height, facing, entranceAlpha);
    const ball = sampleEntranceBall(id, progress);
    if (ball && asset.ball) {
      const frame = asset.ball,
        diameter = height * 0.115,
        width = (diameter * frame.width) / frame.height;
      ctx.save();
      ctx.globalAlpha *= ball.alpha * entranceAlpha;
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
  if (!fadingIn) stance(over);
  return true;
}
