import { fighterById, type FighterId } from "../../../../shared/roster/roster";
import { drawSprite } from "../../assets/assets";
import {
  actorManifest,
  finaleActorLayout,
  type FinaleActorFrame,
} from "./actor-frames";
import type { BodyMode } from "./body-warp";
import {
  CAPTURED_DANCE_FRAMES,
  finalePerformerFrame,
  sampleFinaleDance,
} from "./choreography";
import type { Scene } from "./scene";
import {
  DANCE_BASELINE,
  DANCE_CENTER,
  blendDanceFrames,
  danceSource,
  dancedTexture,
  posedTexture,
} from "./textures";

function drawDancingActor(
  scene: Scene,
  id: FighterId,
  x: number,
  feet: number,
  height: number,
) {
  const pose = sampleFinaleDance(scene.tick, !scene.motion);
  const source = danceSource(scene, id, pose.frame);
  if (!source) return false;
  let image = scene.motion ? dancedTexture(source, pose.phase) : source.canvas;
  if (pose.blend > 0) {
    const next = danceSource(scene, id, pose.nextFrame);
    if (next)
      image = blendDanceFrames(
        id,
        image,
        dancedTexture(next, pose.phase),
        pose.blend,
      );
  }
  scene.ctx.save();
  scene.ctx.translate(x, feet);
  scene.ctx.scale(scene.layout.direction, 1);
  scene.ctx.drawImage(
    image,
    (-DANCE_CENTER * height) / 320,
    (-DANCE_BASELINE * height) / 320,
    (image.width * height) / 320,
    (image.height * height) / 320,
  );
  scene.ctx.restore();
  return true;
}
function drawActorFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: FinaleActorFrame,
  x: number,
  feet: number,
  height: number,
  facing: number,
) {
  if (
    frame.bodyHeight <= 0 ||
    frame.frame.width <= 0 ||
    frame.frame.height <= 0
  )
    return false;
  const placement = finaleActorLayout(frame, height);
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(facing, 1);
  const crop = frame.frame;
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  );
  ctx.restore();
  return true;
}
function drawSeatedActor(
  scene: Scene,
  id: FighterId,
  x: number,
  feet: number,
  height: number,
  facing: number,
) {
  const asset = actorManifest.seated[id];
  const image = asset && scene.props[asset.file];
  if (!asset || !image?.width || !image.height) return false;
  const frames = asset.frames,
    index =
      !scene.motion || !frames?.length
        ? 0
        : Math.min(
            frames.length - 1,
            Math.floor((scene.tick * frames.length) / scene.profile.duration),
          ),
    frame = frames?.[index];
  return drawActorFrame(
    scene.ctx,
    image,
    frame
      ? {
          frame,
          bodyHeight: frame.bodyHeight,
          anchorX: frame.anchorX,
        }
      : asset,
    x,
    feet,
    height,
    facing,
  );
}
export function drawCafeActor(
  scene: Scene,
  x: number,
  feet: number,
  height: number,
) {
  const asset = actorManifest.caprilesCafe;
  const image = scene.props[asset.file];
  const { tick } = scene;
  const index =
    tick < 26 ? 0 : tick < 50 ? 1 : tick < 116 ? 2 : tick < 150 ? 3 : 0;
  const frame = asset.frames[index];
  if (!frame || !image?.width || !image.height) return false;
  const position = scene.layout.point(x, feet);
  return drawActorFrame(
    scene.ctx,
    image,
    { frame, bodyHeight: frame.bodyHeight, anchorX: frame.anchorX },
    position.x,
    position.y,
    height,
    1,
  );
}
function drawPerformerActor(
  scene: Scene,
  id: FighterId,
  x: number,
  feet: number,
  height: number,
  facing: number,
) {
  const asset = actorManifest.performers?.[id];
  const image = asset && scene.props[asset.file];
  const frame =
    asset?.frames[finalePerformerFrame(id, scene.tick, !scene.motion)];
  if (!frame || !image?.width || !image.height) return false;
  return drawActorFrame(
    scene.ctx,
    image,
    { frame, bodyHeight: frame.bodyHeight, anchorX: frame.anchorX },
    x,
    feet,
    height,
    facing,
  );
}
/** Painted finale art for this pose, when the scene has it loaded. */
function drawPaintedActor(
  scene: Scene,
  id: FighterId,
  x: number,
  feet: number,
  size: number,
  facing: number,
  mode: BodyMode,
) {
  return (
    (mode === "dance" &&
      scene.actor === "nacho" &&
      drawDancingActor(scene, id, x, feet, size)) ||
    (((mode === "dance" && id === "nacho") ||
      (mode === "type" && id === "giuseppe")) &&
      drawPerformerActor(scene, id, x, feet, size, facing)) ||
    ((mode === "seat" || mode === "talk" || mode === "sip") &&
      drawSeatedActor(scene, id, x, feet, size, facing))
  );
}
/** The fighter's own atlas, bent into the pose when it is not standing. */
function drawSpriteActor(
  scene: Scene,
  id: FighterId,
  x: number,
  feet: number,
  size: number,
  facing: number,
  mode: BodyMode,
  offset: number,
) {
  const { ctx, sprites, tick, motion } = scene;
  const sprite = sprites[id];
  if (!sprite) return;
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(facing, 1);
  if (mode === "hurt") drawSprite(ctx, sprite, 7, 0, 0, size, 1);
  else if (mode === "stand")
    drawSprite(ctx, sprite, sprite.battleFrame, 0, 0, size, 1);
  else {
    // A captured rival follows the same phrase using their own canonical
    // atlas. Its jump frame supplies a real bent-knee kick.
    const sourceFrame =
      mode === "dance" && scene.actor === "nacho"
        ? CAPTURED_DANCE_FRAMES[
            finalePerformerFrame("nacho", tick + offset, !motion)
          ]
        : sprite.battleFrame;
    const image = posedTexture(
      sprite,
      mode,
      motion ? tick + offset : mode === "sip" ? 12 : 0,
      sourceFrame,
    );
    ctx.drawImage(
      image,
      (-180 * size) / 320,
      (-370 * size) / 320,
      (image.width * size) / 320,
      (image.height * size) / 320,
    );
  }
  ctx.restore();
}
export function body(
  scene: Scene,
  id: FighterId,
  x: number,
  feet: number,
  height: number,
  facing: number,
  mode: BodyMode = "stand",
  offset = 0,
  anchored = true,
) {
  if (scene.actor === "nacho") facing *= scene.layout.direction;
  if (anchored) {
    const position = scene.layout.point(x, feet);
    x = position.x;
    feet = position.y;
  }
  const size = height * ((fighterById(id).displayHeight ?? 177) / 177);
  if (drawPaintedActor(scene, id, x, feet, size, facing, mode)) return;
  drawSpriteActor(scene, id, x, feet, size, facing, mode, offset);
}
