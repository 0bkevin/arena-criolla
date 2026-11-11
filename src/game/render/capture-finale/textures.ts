import type { FighterId } from "../../../../shared/roster/roster";
import { drawSprite, type SpriteAsset } from "../../assets/assets";
import {
  actorManifest,
  finaleActorLayout,
  perroManifest,
  type FinaleActorFrame,
} from "./actor-frames";
import {
  finaleBodyPoint,
  finaleDancePoint,
  type BodyMode,
  type Point,
} from "./body-warp";
import { CAPTURED_DANCE_FRAMES } from "./choreography";
import type { Scene } from "./scene";

const DANCE_SOURCE_WIDTH = 512;
const DANCE_SOURCE_HEIGHT = 560;
export const DANCE_CENTER = 256;
export const DANCE_BASELINE = 500;
const DANCE_HEAD_TOP = 180;
const textures = new WeakMap<SpriteAsset, Map<number, HTMLCanvasElement>>();
const spriteKeys = new WeakMap<SpriteAsset, number>();
const poses = new Map<string, HTMLCanvasElement>();
let nextSpriteKey = 0;
const danceSources = new Map<string, HTMLCanvasElement>();
const danceImageKeys = new WeakMap<HTMLImageElement, number>();
let nextDanceImageKey = 0;
const danceBlends = new Map<FighterId, HTMLCanvasElement>();

/** A stable per-sprite number shared by the posed and danced cache keys. */
function spriteKeyOf(sprite: SpriteAsset) {
  let spriteKey = spriteKeys.get(sprite);
  if (spriteKey === undefined) {
    spriteKey = nextSpriteKey++;
    spriteKeys.set(sprite, spriteKey);
  }
  return spriteKey;
}
function danceImageKeyOf(image: HTMLImageElement) {
  let imageKey = danceImageKeys.get(image);
  if (imageKey === undefined) {
    imageKey = nextDanceImageKey++;
    danceImageKeys.set(image, imageKey);
  }
  return imageKey;
}
/** Return a cached pose and mark it as the most recently used one. */
function recallPose(key: string) {
  const canvas = poses.get(key);
  if (canvas) {
    poses.delete(key);
    poses.set(key, canvas);
  }
  return canvas;
}
function rememberPose(key: string, canvas: HTMLCanvasElement) {
  if (poses.size >= 64) poses.delete(poses.keys().next().value!);
  poses.set(key, canvas);
}
function texture(sprite: SpriteAsset, frame: number) {
  let frames = textures.get(sprite);
  if (!frames) {
    frames = new Map();
    textures.set(sprite, frames);
  }
  let canvas = frames.get(frame);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 420;
    drawSprite(canvas.getContext("2d")!, sprite, frame, 180, 370, 320, 1);
    frames.set(frame, canvas);
  }
  return canvas;
}
function triangle(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  a: Point,
  b: Point,
  c: Point,
  p: Point,
  q: Point,
  r: Point,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    ex = c.x - a.x,
    ey = c.y - a.y;
  const det = dx * ey - dy * ex;
  if (Math.abs(det) < 0.001) return;
  const aa = ((q.x - p.x) * ey - (r.x - p.x) * dy) / det;
  const bb = ((q.y - p.y) * ey - (r.y - p.y) * dy) / det;
  const cc = ((r.x - p.x) * dx - (q.x - p.x) * ex) / det;
  const dd = ((r.y - p.y) * dx - (q.y - p.y) * ex) / det;
  ctx.save();
  ctx.beginPath();
  const center = { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
  for (const [i, v] of [p, q, r].entries()) {
    const length = Math.hypot(v.x - center.x, v.y - center.y) || 1;
    const x = v.x + ((v.x - center.x) / length) * 0.35,
      y = v.y + ((v.y - center.y) / length) * 0.35;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    aa,
    bb,
    cc,
    dd,
    p.x - aa * a.x - cc * a.y,
    p.y - bb * a.x - dd * a.y,
  );
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}
/**
 * Paint `source` through a grid of normalised body coordinates, two triangles
 * per cell, moving each vertex from `place(p)` to `place(warp(p))`.
 */
function warpMesh(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  xs: readonly number[],
  ys: readonly number[],
  place: (p: Point) => Point,
  warp: (p: Point) => Point,
) {
  for (let row = 0; row < ys.length - 1; row++)
    for (let col = 0; col < xs.length - 1; col++) {
      const raw = [
        { x: xs[col], y: ys[row] },
        { x: xs[col + 1], y: ys[row] },
        { x: xs[col], y: ys[row + 1] },
        { x: xs[col + 1], y: ys[row + 1] },
      ];
      const original = raw.map(place);
      const moved = raw.map((p) => place(warp(p)));
      triangle(
        ctx,
        source,
        original[0],
        original[1],
        original[3],
        moved[0],
        moved[1],
        moved[3],
      );
      triangle(
        ctx,
        source,
        original[0],
        original[3],
        original[2],
        moved[0],
        moved[3],
        moved[2],
      );
    }
}
export function posedTexture(
  sprite: SpriteAsset,
  mode: BodyMode,
  tick: number,
  sourceFrame = sprite.battleFrame,
) {
  const phase = Math.floor((((tick % 48) + 48) % 48) / 4);
  const key = `${spriteKeyOf(sprite)}:${mode}:${sourceFrame}:${phase}`;
  const cached = recallPose(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 420;
  const ctx = canvas.getContext("2d")!,
    source = texture(sprite, mode === "type" ? 0 : sourceFrame);
  const xs = [-0.5625, -0.36, -0.2, -0.1, 0, 0.1, 0.2, 0.36, 0.5625];
  const ys = [
    -0.15625, 0, 0.15, 0.23, 0.34, 0.46, 0.57, 0.68, 0.79, 0.89, 1, 1.15625,
  ];
  warpMesh(
    ctx,
    source,
    xs,
    ys,
    (p) => ({ x: 180 + p.x * 320, y: 50 + p.y * 320 }),
    (p) => finaleBodyPoint(p, mode, phase / 12),
  );
  // Bounded cache: a long roster session must not retain every animation phase.
  rememberPose(key, canvas);
  return canvas;
}
/** The painted dance frame for a fighter, or their canonical atlas fallback. */
function danceFrameArt(scene: Scene, id: FighterId, frameIndex: number) {
  const recorded = perroManifest.dancers[id];
  const recordedFrame = recorded?.frames[frameIndex];
  const recordedImage = recorded && scene.props[recorded.file];
  const performer =
    id === "nacho" ? actorManifest.performers?.nacho : undefined;
  const performerFrame = performer?.frames[frameIndex];
  const performerImage = performer && scene.props[performer.file];
  let frame: FinaleActorFrame | undefined;
  let image: HTMLImageElement | undefined;
  if (recordedFrame && recordedImage?.width) {
    frame = {
      frame: recordedFrame,
      bodyHeight: recordedFrame.bodyHeight,
      anchorX: recordedFrame.anchorX,
    };
    image = recordedImage;
  } else if (performerFrame && performerImage?.width) {
    frame = {
      frame: performerFrame,
      bodyHeight: performerFrame.bodyHeight,
      anchorX: performerFrame.anchorX,
    };
    image = performerImage;
  }
  return { frame, image };
}
export function danceSource(scene: Scene, id: FighterId, frameIndex: number) {
  const { frame, image } = danceFrameArt(scene, id, frameIndex);
  const sprite = scene.sprites[id];
  let key: string;
  if (frame && image) {
    const imageKey = danceImageKeyOf(image);
    const bounds = frame.frame;
    key = `raster:${imageKey}:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
  } else {
    if (!sprite) return undefined;
    key = `canonical:${spriteKeyOf(sprite)}:${CAPTURED_DANCE_FRAMES[frameIndex]}`;
  }
  let canvas = danceSources.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = DANCE_SOURCE_WIDTH;
    canvas.height = DANCE_SOURCE_HEIGHT;
    const context = canvas.getContext("2d")!;
    if (frame && image) {
      const placement = finaleActorLayout(frame, 320),
        crop = frame.frame;
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        DANCE_CENTER + placement.x,
        DANCE_BASELINE + placement.y,
        placement.width,
        placement.height,
      );
    } else
      drawSprite(
        context,
        sprite,
        CAPTURED_DANCE_FRAMES[frameIndex],
        DANCE_CENTER,
        DANCE_BASELINE,
        320,
        1,
      );
    if (danceSources.size >= 24)
      danceSources.delete(danceSources.keys().next().value!);
    danceSources.set(key, canvas);
  }
  return { key, canvas };
}
export function dancedTexture(
  source: { key: string; canvas: HTMLCanvasElement },
  phase: number,
) {
  const step = Math.floor(phase * 15 + 1e-6) % 15;
  const key = `perro-v3-support:${source.key}:${step}`;
  const cached = recallPose(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = DANCE_SOURCE_WIDTH;
  canvas.height = DANCE_SOURCE_HEIGHT;
  const context = canvas.getContext("2d")!;
  const upper = DANCE_HEAD_TOP + 0.64 * 320;
  context.drawImage(
    source.canvas,
    0,
    0,
    DANCE_SOURCE_WIDTH,
    upper,
    0,
    0,
    DANCE_SOURCE_WIDTH,
    upper,
  );
  const xs = [-0.8, -0.5, -0.28, -0.15, 0, 0.15, 0.28, 0.5, 0.8];
  const ys = [0.64, 0.72, 0.78, 0.86, 0.94, 1, 1.1875];
  warpMesh(
    context,
    source.canvas,
    xs,
    ys,
    (p) => ({ x: DANCE_CENTER + p.x * 320, y: DANCE_HEAD_TOP + p.y * 320 }),
    (p) => finaleDancePoint(p, step / 15),
  );
  rememberPose(key, canvas);
  return canvas;
}
export function blendDanceFrames(
  id: FighterId,
  first: HTMLCanvasElement,
  second: HTMLCanvasElement,
  blend: number,
) {
  let canvas = danceBlends.get(id);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = DANCE_SOURCE_WIDTH;
    canvas.height = DANCE_SOURCE_HEIGHT;
    if (danceBlends.size >= 4)
      danceBlends.delete(danceBlends.keys().next().value!);
    danceBlends.set(id, canvas);
  }
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 1 - blend;
  context.drawImage(first, 0, 0);
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = blend;
  context.drawImage(second, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  return canvas;
}
