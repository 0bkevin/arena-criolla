import { fighterById, type FighterId } from "../../shared/content";
import type { MatchState } from "../../shared/engine";
import actorAssets from "../../shared/finale-actor-assets.json";
import cafeFurniture from "../../shared/finale-cafe-assets.json";
import hackerDesk from "../../shared/finale-desk-assets.json";
import {
  CANONICAL_FINALE_FIGHTERS,
  finaleAsset,
  finaleById,
  type FinaleDefinition,
} from "../../shared/finales";
import perroAssets from "../../shared/perro-mujeriego-assets.json";
import perroChoreography from "../../shared/perro-mujeriego-choreography.json";
import { drawSprite, type SpriteAsset } from "./assets";
import { finaleArenaLayout, type FinaleArenaLayout } from "./finale-layout";
import type { FinalePose } from "./finales/types";

type BodyMode = FinalePose;
interface Point {
  x: number;
  y: number;
}
interface ActorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface FinaleActorFrame {
  frame: ActorBounds;
  bodyHeight: number;
  anchorX: number;
}
interface CafeActorFrame extends ActorBounds {
  bodyHeight: number;
  anchorX: number;
}
const actorManifest = actorAssets as unknown as {
  seated: Record<
    string,
    FinaleActorFrame & { file: string; frames?: CafeActorFrame[] }
  >;
  caprilesCafe: { file: string; frames: CafeActorFrame[] };
  performers?: Partial<
    Record<FighterId, { file: string; frames: CafeActorFrame[] }>
  >;
  dancers?: Partial<Record<FighterId, FinaleActorFrame & { file: string }>>;
};
const perroManifest = perroAssets as unknown as {
  dancers: Partial<
    Record<FighterId, { file: string; frames: CafeActorFrame[] }>
  >;
};
const DANCE_BLEND_TICKS = 6;
const DANCE_SOURCE_WIDTH = 512;
const DANCE_SOURCE_HEIGHT = 560;
const DANCE_CENTER = 256;
const DANCE_BASELINE = 500;
const DANCE_HEAD_TOP = 180;

/** The continuous 34–40 second reference phrase, with one clock for both roles. */
export function sampleFinaleDance(tick: number, reducedMotion = false) {
  if (reducedMotion)
    return {
      phase: 0,
      frame: 0,
      nextFrame: 0,
      blend: 0,
      dx: 0,
      dy: 0,
      rotate: 0,
    };
  const at = Number.isFinite(tick)
    ? Math.max(0, Math.min(perroChoreography.durationTicks - 1, tick))
    : 0;
  let frame = 0;
  for (let index = 1; index < perroChoreography.poses.length; index++) {
    if (at < perroChoreography.poses[index].tick) break;
    frame = index;
  }
  const next = perroChoreography.poses[frame + 1];
  const blend = next
    ? smooth((at - next.tick + DANCE_BLEND_TICKS) / DANCE_BLEND_TICKS)
    : 0;
  const phase = (at % 42) / 42;
  const angle = phase * Math.PI * 2;
  return {
    phase,
    frame,
    nextFrame: blend > 0 ? frame + 1 : frame,
    blend,
    dx: Math.sin(angle) * 3,
    dy: -(Math.sin(angle * 2) ** 2) * 4,
    rotate: 0,
  };
}

/** Painted hands, arms and faces are untouched; only the lower support leg flexes. */
export function finaleDancePoint(point: Point, phase: number): Point {
  if (point.y <= 0.64) return point;
  const angle = phase * Math.PI * 2;
  const side = point.x < 0 ? -1 : 1;
  const support = Math.max(0, Math.sin(angle + (side < 0 ? Math.PI : 0)));
  const foot = smooth((point.y - 0.78) / 0.22);
  const rotation = -side * support * 0.055 * foot;
  const pivotX = side * 0.13,
    pivotY = 0.78;
  const dx = point.x - pivotX,
    dy = point.y - pivotY;
  return {
    x: pivotX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
    y:
      pivotY +
      dx * Math.sin(rotation) +
      dy * Math.cos(rotation) -
      support * 0.003 * foot,
  };
}
/** One authored dance phrase; keyboard taps repeat only inside the typing section. */
export function finalePerformerFrame(
  id: FighterId,
  tick: number,
  reducedMotion = false,
) {
  if (reducedMotion) return 0;
  if (id === "giuseppe") {
    if (tick < 18) return 0;
    if (tick >= 156) return 7;
    return 1 + (Math.floor((tick - 18) / 8) % 6);
  }
  if (tick < 18) return 0;
  if (tick < 42) return 1;
  if (tick < 55) return 2;
  if (tick < 85) return 3;
  if (tick < 105) return 4;
  if (tick < 136) return 5;
  if (tick < 160) return 6;
  return 7;
}
/** The atlas gutter does not affect actor size or the contact point at the feet. */
export function finaleActorLayout(frame: FinaleActorFrame, height: number) {
  const scale = height / frame.bodyHeight;
  return {
    x: -frame.anchorX * scale,
    y: -frame.frame.height * scale,
    width: frame.frame.width * scale,
    height: frame.frame.height * scale,
  };
}
const clamp = (n: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;
const CAPTURED_DANCE_FRAMES = [0, 0, 0, 1, 1, 4, 1, 0] as const;

/** Explicit hip/knee bending preserves the rival's own bitmap, including custom fighters. */
export function finaleBodyPoint(
  point: Point,
  mode: BodyMode,
  phase: number,
): Point {
  let { x, y } = point;
  const seated =
    mode === "seat" || mode === "talk" || mode === "sip" || mode === "type";
  if (seated && y > 0.57) {
    const thigh = clamp((y - 0.57) / 0.22);
    const thickness = Math.sin(thigh * Math.PI);
    const acrossLeg = point.x - (point.x < 0 ? -0.075 : 0.075);
    x += 0.235 * thigh;
    x -= acrossLeg * 0.65 * thickness;
    y = y < 0.79 ? 0.57 + (y - 0.57) * 0.42 : 0.6624 + (y - 0.79) * 1.24;
    y += acrossLeg * 0.9 * thickness;
  }
  const rhythm = Math.sin(phase * TAU);
  const left = point.x < 0 ? -1 : 1;
  if (mode === "dance" && point.y > 0.55) {
    const hip = clamp((point.y - 0.55) / 0.4);
    const foot = smooth((point.y - 0.74) / 0.26);
    x += left * Math.sin(phase * TAU + left * 0.85) * 0.095 * hip;
    y -=
      Math.max(0, Math.sin(phase * TAU + (left < 0 ? Math.PI : 0))) *
      0.09 *
      foot;
    x += rhythm * 0.035 * (1 - foot);
  }
  // Local sleeve/wrist fields move hands without stretching the face or torso.
  if (point.y > 0.22 && point.y < 0.68) {
    const arm =
      smooth((Math.abs(point.x) - 0.07) / 0.11) *
      Math.sin(clamp((point.y - 0.22) / 0.46) * Math.PI);
    const front = point.x > 0;
    if (mode === "sip" && front) {
      x -= arm * 0.06;
      y -= arm * 0.2 * (0.7 + rhythm * 0.3);
    }
    if (mode === "type") {
      x += arm * (front ? 0.17 : 0.24);
      y += arm * (0.02 - Math.max(0, rhythm * left) * 0.025);
    }
    if (mode === "talk") {
      x += arm * (front ? 0.07 : -0.015);
      y -= arm * (0.02 + Math.max(0, rhythm) * 0.065);
    }
    if (mode === "dance") {
      x += arm * rhythm * left * 0.085;
      y -= arm * (0.035 + Math.max(0, -rhythm * left) * 0.08);
    }
    if (mode === "perform") {
      x += arm * rhythm * 0.04;
      y -= arm * Math.max(0, rhythm * left) * 0.075;
    }
  }
  const head = 1 - smooth((point.y - 0.21) / 0.11);
  if (mode === "talk" || mode === "sip" || mode === "type")
    y += head * Math.sin(phase * TAU * 2) * 0.009;
  if (mode === "dance")
    x += Math.sin(phase * TAU) * 0.018 * (1 - smooth((point.y - 0.5) / 0.2));
  if (mode === "recoil") x += Math.sin(phase * Math.PI) * 0.05 * (1 - point.y);
  return { x, y };
}

const textures = new WeakMap<SpriteAsset, Map<number, HTMLCanvasElement>>();
const spriteKeys = new WeakMap<SpriteAsset, number>();
const poses = new Map<string, HTMLCanvasElement>();
let nextSpriteKey = 0;
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
function posedTexture(
  sprite: SpriteAsset,
  mode: BodyMode,
  tick: number,
  sourceFrame = sprite.battleFrame,
) {
  const phase = Math.floor((((tick % 48) + 48) % 48) / 4);
  let spriteKey = spriteKeys.get(sprite);
  if (spriteKey === undefined) {
    spriteKey = nextSpriteKey++;
    spriteKeys.set(sprite, spriteKey);
  }
  const key = `${spriteKey}:${mode}:${sourceFrame}:${phase}`;
  let canvas = poses.get(key);
  if (canvas) {
    poses.delete(key);
    poses.set(key, canvas);
    return canvas;
  }
  canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 420;
  const ctx = canvas.getContext("2d")!,
    source = texture(sprite, mode === "type" ? 0 : sourceFrame);
  const xs = [-0.5625, -0.36, -0.2, -0.1, 0, 0.1, 0.2, 0.36, 0.5625];
  const ys = [
    -0.15625, 0, 0.15, 0.23, 0.34, 0.46, 0.57, 0.68, 0.79, 0.89, 1, 1.15625,
  ];
  for (let row = 0; row < ys.length - 1; row++)
    for (let col = 0; col < xs.length - 1; col++) {
      const raw = [
        { x: xs[col], y: ys[row] },
        { x: xs[col + 1], y: ys[row] },
        { x: xs[col], y: ys[row + 1] },
        { x: xs[col + 1], y: ys[row + 1] },
      ];
      const original = raw.map((p) => ({
        x: 180 + p.x * 320,
        y: 50 + p.y * 320,
      }));
      const moved = raw.map((p) => {
        const q = finaleBodyPoint(p, mode, phase / 12);
        return { x: 180 + q.x * 320, y: 50 + q.y * 320 };
      });
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
  // Bounded cache: a long roster session must not retain every animation phase.
  if (poses.size >= 64) poses.delete(poses.keys().next().value!);
  poses.set(key, canvas);
  return canvas;
}
interface Scene {
  ctx: CanvasRenderingContext2D;
  state: MatchState;
  profile: FinaleDefinition;
  sprites: Record<string, SpriteAsset>;
  props: Record<string, HTMLImageElement>;
  tick: number;
  motion: number;
  pulse: number;
  beat: number;
  actor: FighterId;
  rival: FighterId;
  layout: FinaleArenaLayout;
}
const sceneDirections = new WeakMap<CanvasRenderingContext2D, number>();
const danceSources = new Map<string, HTMLCanvasElement>();
const danceImageKeys = new WeakMap<HTMLImageElement, number>();
let nextDanceImageKey = 0;
function danceSource(scene: Scene, id: FighterId, frameIndex: number) {
  const recorded = perroManifest.dancers[id];
  const recordedFrame = recorded?.frames[frameIndex];
  const recordedImage = recorded && scene.props[recorded.file];
  const performer =
    id === "nacho" ? actorManifest.performers?.nacho : undefined;
  const performerFrame = performer?.frames[frameIndex];
  const performerImage = performer && scene.props[performer.file];
  const dancer = actorManifest.dancers?.[id];
  const dancerImage = dancer && scene.props[dancer.file];
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
  } else if (dancer && dancerImage?.width) {
    frame = dancer;
    image = dancerImage;
  }
  const sprite = scene.sprites[id];
  let key: string;
  if (frame && image) {
    let imageKey = danceImageKeys.get(image);
    if (imageKey === undefined) {
      imageKey = nextDanceImageKey++;
      danceImageKeys.set(image, imageKey);
    }
    const bounds = frame.frame;
    key = `raster:${imageKey}:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
  } else {
    if (!sprite) return undefined;
    let spriteKey = spriteKeys.get(sprite);
    if (spriteKey === undefined) {
      spriteKey = nextSpriteKey++;
      spriteKeys.set(sprite, spriteKey);
    }
    key = `canonical:${spriteKey}:${CAPTURED_DANCE_FRAMES[frameIndex]}`;
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
function dancedTexture(
  source: { key: string; canvas: HTMLCanvasElement },
  phase: number,
) {
  const step = Math.floor(phase * 15 + 1e-6) % 15;
  const key = `perro-v3-support:${source.key}:${step}`;
  let canvas = poses.get(key);
  if (canvas) {
    poses.delete(key);
    poses.set(key, canvas);
    return canvas;
  }
  canvas = document.createElement("canvas");
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
  for (let row = 0; row < ys.length - 1; row++)
    for (let col = 0; col < xs.length - 1; col++) {
      const raw = [
        { x: xs[col], y: ys[row] },
        { x: xs[col + 1], y: ys[row] },
        { x: xs[col], y: ys[row + 1] },
        { x: xs[col + 1], y: ys[row + 1] },
      ];
      const original = raw.map((p) => ({
        x: DANCE_CENTER + p.x * 320,
        y: DANCE_HEAD_TOP + p.y * 320,
      }));
      const moved = raw.map((p) => {
        const q = finaleDancePoint(p, step / 15);
        return { x: DANCE_CENTER + q.x * 320, y: DANCE_HEAD_TOP + q.y * 320 };
      });
      triangle(
        context,
        source.canvas,
        original[0],
        original[1],
        original[3],
        moved[0],
        moved[1],
        moved[3],
      );
      triangle(
        context,
        source.canvas,
        original[0],
        original[3],
        original[2],
        moved[0],
        moved[3],
        moved[2],
      );
    }
  if (poses.size >= 64) poses.delete(poses.keys().next().value!);
  poses.set(key, canvas);
  return canvas;
}
const danceBlends = new Map<FighterId, HTMLCanvasElement>();
function blendDanceFrames(
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
function drawCafeActor(scene: Scene, x: number, feet: number, height: number) {
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
function body(
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
  const { ctx, sprites, tick, motion } = scene;
  if (scene.actor === "nacho") facing *= scene.layout.direction;
  if (anchored) {
    const position = scene.layout.point(x, feet);
    x = position.x;
    feet = position.y;
  }
  const size = height * ((fighterById(id).displayHeight ?? 177) / 177);
  if (
    mode === "dance" &&
    scene.actor === "nacho" &&
    drawDancingActor(scene, id, x, feet, size)
  )
    return;
  if (
    ((mode === "dance" && id === "nacho") ||
      (mode === "type" && id === "giuseppe")) &&
    drawPerformerActor(scene, id, x, feet, size, facing)
  )
    return;
  if (
    (mode === "seat" || mode === "talk" || mode === "sip") &&
    drawSeatedActor(scene, id, x, feet, size, facing)
  )
    return;
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
function prop(
  scene: Scene,
  x: number,
  y: number,
  width: number,
  height = width * 0.72,
  alpha = 1,
  facing = 1,
) {
  // These atlas cells depict entire replacement environments rather than props.
  if (
    [
      "nacho",
      "amanda",
      "chiqui",
      "momoy",
      "lionza",
      "tiotigre",
      "florentino",
    ].includes(scene.actor)
  )
    return;
  const position = finaleAsset(scene.actor),
    { ctx } = scene;
  if (!position) return;
  const image = scene.props[position.file];
  if (!image?.width || !image.height) return;
  const cellW = image.width / 4,
    cellH = image.height / 2;
  const positionOnArena = scene.layout.point(x, y);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(positionOnArena.x, positionOnArena.y);
  ctx.scale(facing, 1);
  ctx.drawImage(
    image,
    position.column * cellW,
    position.row * cellH,
    cellW,
    cellH,
    -width / 2,
    -height / 2,
    width,
    height,
  );
  ctx.restore();
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 20,
  color = "#f8edce",
  align: CanvasTextAlign = "center",
) {
  ctx.font = `700 ${size}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  readableText(ctx, value, x, y);
}
function readableText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth?: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sceneDirections.get(ctx) ?? 1, 1);
  if (maxWidth === undefined) ctx.fillText(value, 0, 0);
  else ctx.fillText(value, 0, 0, maxWidth);
  ctx.restore();
}
function line(
  ctx: CanvasRenderingContext2D,
  points: readonly number[],
  color: string,
  width = 3,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    if (i === 0) ctx.moveTo(points[i], points[i + 1]);
    else ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.stroke();
}
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}
function bubble(
  scene: Scene,
  value: string | readonly string[],
  x: number,
  y: number,
  width = 240,
) {
  const { ctx } = scene;
  const lines = typeof value === "string" ? [value] : value;
  const extraHeight = (lines.length - 1) * 22;
  ctx.fillStyle = "#fbefd5";
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 30, width, 50 + extraHeight, 13);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 18, y + 18 + extraHeight);
  ctx.lineTo(x - 7, y + 33 + extraHeight);
  ctx.lineTo(x + 2, y + 18 + extraHeight);
  ctx.fill();
  ctx.font = '700 20px "Barlow Condensed", sans-serif';
  ctx.fillStyle = "#43311c";
  ctx.textAlign = "center";
  for (const [index, line] of lines.entries())
    readableText(ctx, line, x, y + 2 + index * 22, width - 24);
}
function note(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ellipse(ctx, x, y, size * 0.6, size * 0.4, color);
  line(
    ctx,
    [
      x + size * 0.5,
      y,
      x + size * 0.5,
      y - size * 1.7,
      x + size * 1.2,
      y - size * 1.3,
    ],
    color,
    3,
  );
}
function ring(
  scene: Scene,
  x: number,
  y: number,
  radius: number,
  color = scene.profile.accent,
  squash = 1,
) {
  const { ctx } = scene;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(
    x,
    y,
    Math.max(1, radius),
    Math.max(1, radius * squash),
    0,
    0,
    TAU,
  );
  ctx.stroke();
}
function damage(scene: Scene, y = 205) {
  if (!scene.pulse) return;
  const { ctx, pulse } = scene;
  const position = scene.layout.targetPoint(y);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(
    ctx,
    `−${Math.round(scene.state.finale!.damage / scene.profile.damageBeats.length)} VIDA`,
    position.x,
    position.y - (1 - pulse) * 24 * scene.motion,
    29,
    "#ffb4a2",
  );
  ctx.restore();
}
function chair(scene: Scene, x: number, seat: number, facing: number) {
  const { ctx } = scene;
  const position = scene.layout.point(x, 509);
  ctx.save();
  ctx.translate(position.x - x, position.y - 509);
  ctx.fillStyle = "#74462b";
  ctx.beginPath();
  ctx.roundRect(x - facing * 31 - 19, seat - 112, 38, 116, 7);
  ctx.fill();
  ctx.fillStyle = "#b77942";
  ctx.fillRect(x - 36, seat - 3, 81, 13);
  line(ctx, [x - 27, seat + 8, x - 31, 509], "#815035", 9);
  line(ctx, [x + 35, seat + 8, x + 45, 509], "#815035", 9);
  ctx.restore();
}
function mug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size = 1,
  tilt = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(size, size);
  ctx.strokeStyle = "#f4e4c4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(13, -6, 8, 8, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#f4e4c4";
  ctx.beginPath();
  ctx.roundRect(-12, -17, 25, 25, 4);
  ctx.fill();
  ellipse(ctx, 0, -16, 11, 3, "#5b3725");
  line(ctx, [-3, -22, -5, -29, -1, -36], "#fff3d470", 2);
  ctx.restore();
}
function drawCafeFurniture(
  scene: Scene,
  part: keyof typeof cafeFurniture.frames,
  x: number,
  feet: number,
  width: number,
  height: number,
) {
  const image = scene.props[cafeFurniture.file];
  const crop = cafeFurniture.frames[part];
  if (!image?.width || !image.height || !crop.width || !crop.height)
    return false;
  const position = scene.layout.point(x, feet);
  scene.ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    position.x - width / 2,
    position.y - height,
    width,
    height,
  );
  return true;
}
function coffee(scene: Scene) {
  const { ctx, tick, actor, rival, motion } = scene;
  // Whole isolated props prevent chair fragments crossing the actors' bodies.
  // Chair seats meet the real seated poses; only the table passes in front.
  if (!drawCafeFurniture(scene, "leftChair", 326, 518, 152, 230))
    chair(scene, 344, 400, 1);
  if (!drawCafeFurniture(scene, "rightChair", 754, 518, 149, 230))
    chair(scene, 729, 400, -1);
  const sip = Math.sin(clamp((tick - 30) / 118) * Math.PI * 3) > 0.25;
  body(scene, rival, 729, 518, 290, -1, "seat");
  const cafeActor = drawCafeActor(scene, 344, 518, 310);
  if (!cafeActor) body(scene, actor, 344, 518, 302, 1, sip ? "sip" : "talk");
  if (!drawCafeFurniture(scene, "table", 540, 518, 215, 215)) {
    line(ctx, [540, 420, 540, 504], "#573721", 15);
    line(ctx, [502, 508, 540, 498, 578, 508], "#744a2c", 10);
    ellipse(ctx, 540, 405, 133, 27, "#68432c");
    ellipse(ctx, 540, 398, 133, 25, "#b57c46");
  }
  const tableY = scene.props[cafeFurniture.file] ? 335 : 393;
  ellipse(ctx, 486, tableY + 5, 25, 5, "#e8d4a6");
  if (!drawCafeFurniture(scene, "cup", 595, tableY + 9, 38.5, 48))
    mug(ctx, 595, tableY, 0.82);
  const lift = motion
    ? smooth(sip ? Math.sin(clamp((tick % 48) / 48) * Math.PI) : 0)
    : 0.8;
  const cupX = 443 - lift * 65,
    cupY = tableY - lift * (tableY - 272);
  if (!cafeActor && lift > 0.08)
    line(
      ctx,
      [377, 330, 405 - lift * 2, 354 - lift * 38, cupX - 7, cupY + 1],
      "#dca97b",
      10,
    );
  if (!cafeActor) mug(ctx, cupX, cupY, 0.9, -lift * 0.2);
  bubble(
    scene,
    tick < 57
      ? scene.profile.caption
      : tick < 108
        ? ["Maduro tiene la leche", "acaparada"]
        : ["y yo se la voy a sacar", "de donde sea."],
    524,
    191,
    276,
  );
  if (tick > 50)
    bubble(scene, tick < 108 ? "…" : "¡Se me va la vida!", 825, 209, 165);
  damage(scene, 190);
}
function dance(scene: Scene) {
  const { ctx, actor, rival, tick, motion } = scene;
  const nacho = actor === "nacho",
    salsa = actor === "oscar",
    joropo = actor === "rummy";
  const period = nacho ? 45 : joropo ? 30 : 40;
  const rhythm = Math.sin((tick / period) * TAU) * motion;
  if (actor === "lila") {
    prop(scene, 538, 318, 365, 280);
    for (let n = 0; n < 3; n++)
      ellipse(
        ctx,
        480 + n * 60,
        385 + Math.sin(tick / 25 + n) * 16 * motion,
        10,
        12,
        "#b77b43",
      );
  } else if (joropo) {
    prop(scene, 210, 357, 226, 255);
    for (let n = 0; n < 8; n++) {
      const x = 250 + n * 83;
      const y = 510 + Math.sin(n * 1.4) * 7;
      ellipse(ctx, x, y, 5, 4, n % 2 ? "#eb91a6" : "#f7d37d");
    }
  } else if (salsa) prop(scene, 285, 338, 215, 276);
  else if (!nacho) prop(scene, 540, 305, 290, 190, 0.75);
  const pair = sampleFinaleDance(tick, !motion);
  const walk = nacho ? pair.dx : rhythm * (joropo ? 20 : salsa ? 38 : 29);
  const feet = nacho
    ? 504 + pair.dy
    : 504 - Math.abs(rhythm) * (joropo ? 13 : 5);
  body(scene, actor, 382 + walk, feet, 302, 1, "dance");
  body(scene, rival, 699 + walk, feet, 293, 1, "dance");
  const choreographedSteps = [
    "CARA Y REBOTE",
    "CAMBIA EL APOYO",
    "PATITAS A LA DERECHA",
    "PATITAS A LA IZQUIERDA",
    "PATITAS AL CENTRO",
    "BARRIDO DE BRAZO",
    "BRAZOS ARRIBA",
    "CORAZÓN",
  ];
  const step = nacho
    ? choreographedSteps[pair.frame]
    : tick < 55
      ? "PASO A PASO"
      : tick < 105
        ? "HOMBROS Y CADERA"
        : tick < 150
          ? "GIRO Y REMATE"
          : "¡LOS DOS A TIEMPO!";

  for (let n = 0; n < 5; n++)
    note(
      ctx,
      250 + n * 143,
      251 - Math.sin(tick / 29 + n) * 17 * motion,
      10,
      `${scene.profile.accent}cc`,
    );
  if (motion)
    for (const x of [382 + walk, 699 + walk]) {
      line(ctx, [x - 28, 518, x - 5 + rhythm * 10, 518], "#ffe6b1", 4);
    }
  damage(scene);
}
function hack(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  if (actor === "giuseppe") {
    chair(scene, 315, 405, 1);
    body(scene, actor, 315, 522, 295, 1, "type");
    body(scene, rival, 785, 513, 291, -1, pulse ? "recoil" : "stand");
    const desk = scene.props[hackerDesk.file];
    if (desk?.width && desk.height) {
      const frame = hackerDesk.frame;
      const height = 230;
      const width = (height * frame.width) / frame.height;
      const position = scene.layout.point(448, 522);
      // The keyboard is on Giuseppe's left-facing side of the lid. Preserve
      // the furniture's own aspect ratio and the human scale of the laptop.
      ctx.drawImage(
        desk,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        position.x - width / 2,
        position.y - height,
        width,
        height,
      );
    } else {
      line(ctx, [365, 375, 365, 520, 525, 520, 525, 375], "#593b2b", 10);
      ctx.fillStyle = "#96643e";
      ctx.fillRect(352, 360, 188, 15);
      line(ctx, [372, 357, 427, 357], "#6e7788", 7);
      ctx.fillStyle = "#303747";
      ctx.beginPath();
      ctx.moveTo(426, 357);
      ctx.lineTo(435, 292);
      ctx.lineTo(480, 286);
      ctx.lineTo(469, 350);
      ctx.closePath();
      ctx.fill();
      line(ctx, [426, 357, 435, 292], "#8af3c5", 2);
    }
    line(
      ctx,
      [502, 353, 592, 353, 592, 260, 780, 260, 780, 208],
      "#68e7b87d",
      4,
    );
    for (let n = 0; n < 4; n++) {
      const fraction = (tick * 0.015 + n / 4) % 1;
      ellipse(
        ctx,
        770 - fraction * 200,
        260 + Math.sin(fraction * Math.PI) * 4,
        5,
        5,
        "#bcffe4",
      );
    }

    text(
      ctx,
      tick > 138
        ? "DESCARGA COMPLETA"
        : `${Math.min(99, Math.floor(tick / 1.4))}% · ENERGÍA EN TRANSFERENCIA`,
      605,
      426,
      18,
      "#a4f1d1",
    );
  } else {
    body(
      scene,
      actor,
      302,
      515,
      296,
      1,
      actor === "enrique" ? "type" : "perform",
    );
    body(scene, rival, 785, 515, 290, -1, pulse ? "recoil" : "stand");
    prop(scene, 540, 355, actor === "lele" ? 268 : 330, 280);
    if (actor === "vallenilla") {
      for (let n = 0; n < 3; n++) {
        const y = 340 + n * 54,
          slide = Math.sin((tick - n * 14) / 32) * 20 * scene.motion;
        const card = scene.layout.point(650 + slide, y + 22);
        ctx.fillStyle = ["#ef6c6c", "#78b7e1", "#edc477"][n];
        ctx.beginPath();
        ctx.roundRect(card.x - 44, card.y - 22, 88, 44, 7);
        ctx.fill();
        text(ctx, `${n + 1}/3`, card.x, card.y + 8, 23, "#19253a");
      }
    } else if (actor === "enrique") {
      for (let n = 0; n < 5; n++)
        line(ctx, [460, 293 + n * 25, 603, 293 + n * 25], "#d8e5ba50", 2);
      bubble(
        scene,
        scene.beat < 0
          ? "Vamos a revisar la cuenta"
          : ["DÉBITO", "BALANCE", "CAJA CERRADA"][scene.beat],
        608,
        195,
        235,
      );
    } else if (actor === "jesus") {
      line(ctx, [410, 320, 689, 320], "#8ce6dc", 3);
      for (let n = 0; n < 7; n++) {
        const p = (tick / 65 + n / 7) % 1;
        ellipse(
          ctx,
          690 - p * 280,
          320 - Math.sin(p * Math.PI) * 44,
          10,
          12,
          "#f4cc65",
        );
      }
    } else if (actor === "victor") {
      for (let n = 0; n < 3; n++)
        line(
          ctx,
          [605 + n * 46, 412, 710 + n * 46, 224],
          n <= scene.beat ? "#c6ffe5" : "#8ee8cb40",
          n <= scene.beat ? 7 : 2,
        );
    } else if (actor === "lele") {
      ctx.strokeStyle = "#f7b2d6";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(647, 208, 258, 317, 23);
      ctx.stroke();
      ellipse(ctx, 671, 231, 5, 5, "#ffb6d9");
      text(ctx, "EN DIRECTO", 737, 238, 19, "#ffcee7");
      for (let n = 0; n < 5; n++)
        text(
          ctx,
          ["¡JA!", "+1", "¡JA!", "+1", "¡JA!"][n],
          888 + Math.sin(n) * 17,
          480 - ((tick * scene.motion + n * 35) % 200),
          19,
          "#ffb9dc",
        );
    }
  }
  damage(scene, 195);
}
function transport(scene: Scene) {
  const { ctx, actor, rival, tick, motion, pulse } = scene;
  const progress = clamp((tick - 15) / 140),
    travel = motion ? progress : 0.5;
  if (actor === "zavarce") {
    body(scene, actor, 252, 508, 292, 1, "stand");
    body(scene, rival, 756, 508, 282, -1, pulse ? "recoil" : "stand");
  } else if (actor === "reynaldo") {
    prop(scene, 553 + Math.sin(tick / 25) * 105 * motion, 369, 470, 326);
    body(scene, actor, 385, 503, 275, 1, "perform");
    body(scene, rival, 771, 500, 277, -1, "recoil");
    for (let n = 0; n < 3; n++)
      ring(scene, 773, 391, 62 + n * 23 + pulse * 15, "#f4cb78", 0.58);
  } else if (actor === "mcm") {
    for (let n = 0; n < 3; n++)
      line(
        ctx,
        [172, 239 + n * 15, 540, 270 + n * 10, 900, 235 + n * 16],
        ["#ffe180", "#7db8ed", "#ee9392"][n],
        7,
      );
    prop(scene, 537, 402, 540, 320);
    body(scene, actor, 410, 389, 218, 1, "perform");
    body(scene, rival, 656, 406, 220, -1, "recoil");
  } else if (actor === "juan") {
    for (let n = 0; n < 3; n++) {
      ring(
        scene,
        284 + n * 255,
        478,
        14,
        n <= scene.beat ? "#ffe398" : "#9fb5d155",
      );
      if (n < 2)
        line(ctx, [302 + n * 255, 478, 515 + n * 255, 478], "#9fb5d177", 3);
    }
    // The route moves through the arena; the captured riders stay in view.
    const x = 330 + Math.sin(progress * TAU) * 12 * motion;
    prop(scene, x, 384, 450, 250);
    body(scene, actor, x - 100, 396, 176, 1, "seat");
    body(scene, rival, x + 68, 396, 176, 1, "seat");
  } else {
    const x = 375 + Math.sin(progress * TAU) * 12 * motion;
    prop(scene, x, 413, 485, 263);
    body(scene, actor, x - 80, 442, 188, 1, "seat");
    body(scene, rival, x + 85, 442, 188, 1, "seat");

    for (let n = 0; n < 4; n++)
      line(
        ctx,
        [x - 255 - n * 24, 419 + n * 18, x - 292 - n * 24, 419 + n * 18],
        "#c7daef80",
        3,
      );
  }
  damage(scene, 210);
}
function music(scene: Scene) {
  const { ctx, actor, rival, tick, pulse, motion } = scene;
  const conductor = actor === "dudamel",
    water = actor === "yordano",
    neon = actor === "danny",
    duel = actor === "florentino";
  body(
    scene,
    rival,
    783,
    510,
    290,
    -1,
    duel ? "seat" : pulse ? "recoil" : "stand",
  );
  body(
    scene,
    actor,
    conductor ? 347 : 330,
    510,
    305,
    1,
    duel ? "talk" : "perform",
  );
  prop(
    scene,
    conductor ? 520 : water ? 488 : 455,
    359,
    conductor ? 360 : water ? 420 : 280,
    285,
  );
  if (conductor) {
    // Conducting sweeps hit the music stand, then the opponent, in three accents.
    const angle = Math.sin(tick / 22) * 0.5 * motion;
    line(
      ctx,
      [382, 304, 458 + Math.sin(angle) * 40, 251 - Math.cos(angle) * 32],
      "#fff0cc",
      3,
    );
    for (let n = 0; n < 5; n++) {
      line(ctx, [479, 327 + n * 12, 898, 327 + n * 12], "#c9d5ee35", 1);
      note(
        ctx,
        530 + n * 63,
        350 + Math.sin(n + tick / 20) * 26 * motion,
        12,
        "#fff2bc",
      );
    }
  } else if (water) {
    for (let n = 0; n < 3; n++) {
      ctx.strokeStyle = `#9bd9ef${n === scene.beat ? "bb" : "55"}`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(482, 486 - n * 25);
      ctx.bezierCurveTo(
        580,
        370 - n * 20,
        681,
        555 - n * 15,
        891,
        431 - n * 34,
      );
      ctx.stroke();
    }
  } else if (neon) {
    const p = pulse * 25;
    ctx.strokeStyle = "#f7a5dc";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(638, 310 + p);
    ctx.bezierCurveTo(499, 225 - p, 540, 165, 636, 229);
    ctx.bezierCurveTo(731, 165, 791, 229, 638, 310 + p);
    ctx.stroke();
    for (let n = 0; n < 3; n++)
      ring(scene, 693, 428, 93 + n * 25, "#9fe9ec88", 0.47);
  } else if (duel) {
    bubble(
      scene,
      tick < 75 ? "Te respondo con un verso" : "¡Que conteste la sabana!",
      583,
      191,
      278,
    );
    for (let n = 0; n < 3; n++) {
      ctx.fillStyle = "#edce9670";
      ctx.fillRect(478, 294 + n * 52, 210 + n * 26, 23);
      text(
        ctx,
        ["COPLA", "RESPUESTA", "CONTRAPUNTEO"][n],
        584 + n * 13,
        312 + n * 52,
        18,
        "#2c211b",
      );
    }
  } else {
    const label =
      actor === "puma"
        ? "UNA VOZ LLENA LA ARENA"
        : actor === "gualberto"
          ? "TREMOLO ORIENTAL"
          : "TRES VOCES, UN SOLO ECO";

    for (let n = 0; n < 4; n++) {
      const p = (tick / 90 + n / 4) % 1;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ring(
        scene,
        410 + p * 374,
        326,
        25 + p * 85,
        actor === "ali" ? "#f4dd95" : scene.profile.accent,
        1.25,
      );
      ctx.restore();
    }
  }
  for (let n = 0; n < 4; n++)
    note(
      ctx,
      530 + n * 72,
      223 + Math.sin(tick / 28 + n) * 15 * motion,
      9,
      "#ead6a2aa",
    );
  damage(scene, 204);
}
function broadcast(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  if (actor === "chataing") {
    chair(scene, 341, 402, 1);
    chair(scene, 744, 402, -1);
    body(scene, actor, 341, 516, 291, 1, "talk");
    body(scene, rival, 744, 516, 291, -1, "seat");
    prop(scene, 543, 389, 366, 240);
    ctx.fillStyle = "#2f4256";
    ctx.fillRect(386, 385, 310, 27);
    line(ctx, [412, 410, 402, 518], "#778c9e", 8);
    line(ctx, [670, 410, 683, 518], "#778c9e", 8);
    for (let n = 0; n < 18; n++) {
      ctx.fillStyle = n % 3 ? "#8ee6bd" : "#e7d283";
      ctx.fillRect(
        412 + n * 15,
        436 - Math.abs(Math.sin(n + tick / 10)) * 40,
        9,
        Math.abs(Math.sin(n + tick / 10)) * 40 + 3,
      );
    }
    bubble(
      scene,
      tick < 90 ? "Una última pregunta…" : "Bueno, dos más y terminamos",
      538,
      186,
      277,
    );
  } else if (actor === "sarcos") {
    ctx.fillStyle = "#71501f";
    ctx.fillRect(678, 419, 179, 96);
    text(ctx, "GANADOR", 768, 482, 29);
    body(scene, actor, 295, 515, 303, 1, "perform");
    body(scene, rival, 767, 424, 248, -1, "perform");
    prop(scene, 521, 370, 312, 262);
    for (let n = 0; n < 3; n++) {
      ctx.fillStyle = ["#cd7278", "#7ba6c9", "#d2b563"][n];
      ctx.fillRect(413 + n * 86, 439, 70, 61);
      line(ctx, [446 + n * 86, 440, 446 + n * 86, 500], "#ffe1a3", 6);
      if (n <= scene.beat)
        text(ctx, "¡SORPRESA!", 448 + n * 86, 423 - (n % 2) * 18, 17);
    }
  } else {
    body(scene, actor, 338, 516, 307, 1, "perform");
    body(scene, rival, 737, 516, 294, -1, pulse ? "recoil" : "perform");
    prop(scene, 540, 323, 362, 260);
    for (let n = 0; n < 7; n++) {
      const x = 215 + n * 109,
        y = 224 + Math.sin(n * 1.7 + tick / 50) * 25 * scene.motion;
      line(ctx, [x - 5, y, x + 5, y, x, y - 7, x, y + 7], "#f6d88d", 2);
    }
  }
  damage(scene, 205);
}
function theater(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  if (actor === "george") {
    chair(scene, 766, 411, -1);
    body(scene, rival, 766, 523, 291, -1, "seat");
    body(scene, actor, 333, 518, 308, 1, "talk");
    prop(scene, 489, 367, 272, 282);
    bubble(
      scene,
      tick < 78 ? "Tú, el de primera fila…" : "¡Esa cara es el remate!",
      541,
      184,
      268,
    );
    if (scene.beat >= 0)
      text(
        ctx,
        ["JA", "JA, JA", "JA, JA, JA"][scene.beat],
        750,
        254,
        32,
        "#ffe4a2",
      );
  } else if (actor === "gabriela") {
    for (const x of [331, 664]) {
      ctx.fillStyle = "#7b637c";
      ctx.strokeStyle = "#d4b9ad";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.roundRect(x - 83, 211, 166, 293, 63);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.63;
      body(scene, actor, x, 501, 268, x < 500 ? 1 : -1, "perform", 0, false);
      ctx.restore();
    }
    body(scene, actor, 475, 524, 287, 1, "perform");
    body(scene, rival, 826, 523, 277, -1, pulse ? "recoil" : "stand");
    prop(scene, 540, 402, 194, 160);
    bubble(scene, "¿Cuál de las dos soy?", 540, 181, 236);
  } else if (actor === "chiqui") {
    const move = Math.sin(tick / 45) * 37 * scene.motion;
    body(scene, actor, 393 + move, 515, 301, 1, "dance");
    body(scene, rival, 684 + move, 515, 291, 1, "dance");
    prop(scene, 540, 341, 238, 170, 0.75);

    for (const x of [202, 889]) {
      ctx.strokeStyle = "#d5ddea";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, 352, 38, 25);
      line(
        ctx,
        [x + 19, 379, x + 1, 478, x + 19, 379, x + 39, 478],
        "#a7b7cb",
        3,
      );
      ring(scene, x + 19, 362, 31 + pulse * 24, "#fff1c29c");
    }
  } else {
    body(scene, actor, actor === "amanda" ? 422 : 306, 522, 304, 1, "perform");
    body(scene, rival, 790, 522, 289, -1, pulse ? "recoil" : "stand");
    prop(
      scene,
      actor === "amanda" ? 540 : 520,
      actor === "norkys" ? 370 : 338,
      actor === "emilio" ? 344 : 298,
      273,
    );
    const message =
      actor === "conde"
        ? "¡Que siga la función!"
        : actor === "emilio"
          ? [
              "¡Cambio de personaje!",
              "Otra máscara, otro remate",
              "¡Todos al autobús!",
            ][Math.min(2, Math.floor(tick / 60))]
          : actor === "norkys"
            ? ["Tu escena empieza ahora", "¡Repitamos esa toma!", "¡Corten!"][
                Math.min(2, Math.floor(tick / 60))
              ]
            : "Silencio, empieza la función";
    bubble(scene, message, 542, 182, 281);
    if (actor === "emilio" && tick > 105) {
      const p = clamp((tick - 105) / 65);
      prop(scene, 930 - p * 420 * scene.motion, 466, 231, 142);
    }
    if (actor === "conde")
      for (let n = 0; n < 3; n++)
        text(
          ctx,
          "JA",
          660 + n * 83,
          291 + Math.sin(tick / 20 + n) * 20 * scene.motion,
          24,
          "#f0d597",
        );
    if (actor === "norkys")
      for (let n = 0; n < 3; n++)
        text(
          ctx,
          `${n + 1} · TOMA`,
          629,
          322 + n * 39,
          21,
          n <= scene.beat ? "#ffdf9f" : "#b7c4d277",
        );
  }
  damage(scene, 204);
}
function folklore(scene: Scene) {
  const { ctx, actor, rival, tick, pulse, motion } = scene;
  const river = actor === "llorona" || actor === "momoy";
  body(scene, actor, actor === "tiotigre" ? 344 : 306, 514, 304, 1, "perform");
  body(
    scene,
    rival,
    782,
    actor === "tioconejo" && tick > 90 ? 532 : 514,
    287,
    -1,
    pulse ? "recoil" : "stand",
  );
  prop(
    scene,
    529,
    actor === "lionza" ? 389 : actor === "knoche" ? 405 : 359,
    actor === "lionza" ? 427 : actor === "knoche" ? 254 : 340,
    actor === "knoche" ? 220 : 294,
  );
  if (river) {
    for (let n = 0; n < 5; n++) {
      ctx.strokeStyle = n % 2 ? "#a7d6df66" : "#9dcde9aa";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(211, 479 + n * 10);
      ctx.bezierCurveTo(
        401,
        433 + n * 12 + Math.sin(tick / 30) * 12 * motion,
        602,
        547,
        891,
        466 + n * 10,
      );
      ctx.stroke();
    }
    if (actor === "momoy")
      for (let n = 0; n < 8; n++)
        ring(
          scene,
          700 + Math.sin(n * 3.1) * 120,
          455 + Math.cos(n) * 48,
          8 + (n % 3) * 3,
          "#b6ecd699",
          0.5,
        );
    else
      for (let n = 0; n < 10; n++)
        ellipse(
          ctx,
          650 + n * 21,
          221 + ((tick * motion + n * 37) % 248),
          3,
          7,
          "#bce3ef9c",
        );
  } else if (actor === "sayona") {
    ctx.save();
    ctx.globalAlpha = 0.26;
    body(scene, actor, 648, 517, 290, 1, "stand");
    body(scene, actor, 898, 517, 290, -1, "stand");
    ctx.restore();
    for (let n = 0; n < 5; n++) {
      const x = 635 + n * 69;
      line(ctx, [x, 495, x, 471], "#f1dfb9", 6);
      ellipse(ctx, x, 462, 4, 9, "#e9bd80");
    }
  } else if (actor === "silbon") {
    for (let n = 0; n < 5; n++) {
      const a = (n / 5) * TAU + (tick / 40) * motion,
        x = 771 + Math.cos(a) * (86 + n * 4),
        y = 357 + Math.sin(a) * 105;
      line(ctx, [x - 9, y - 8, x + 9, y + 8], "#e7dec7", 6);
      ellipse(ctx, x - 10, y - 9, 5, 5, "#e7dec7");
      ellipse(ctx, x + 10, y + 9, 5, 5, "#e7dec7");
    }
    for (let n = 0; n < 3; n++)
      ring(scene, 756, 337, 88 + n * 31 + pulse * 13, "#b9ddc65c", 1.14);
  } else if (actor === "diablo") {
    for (let n = 0; n < 13; n++) {
      const x = 586 + n * 28,
        y = 493 - Math.sin(n * 0.8 + tick / 24) * 5 * motion;
      ellipse(ctx, x, y, 9, 23 + pulse * 10, n % 2 ? "#d88452aa" : "#f0bc73aa");
    }
  } else if (actor === "knoche") {
    for (let n = 0; n < 3; n++) {
      ellipse(
        ctx,
        510 + n * 51,
        398,
        15,
        21,
        ["#c1b5df", "#a5d7c3", "#e6c28c"][n],
      );
      const rise = (tick * motion + n * 45) % 160;
      ellipse(
        ctx,
        664 + n * 46,
        416 - rise,
        26 + rise * 0.22,
        22 + rise * 0.17,
        "#c9d5d32b",
      );
    }
  } else if (actor === "tiotigre") {
    for (let n = 0; n < 3; n++) {
      const x = 684 + n * 44;
      line(
        ctx,
        [x, 280, x + 46, 414],
        n <= scene.beat ? "#ffe3aa" : "#dcb99344",
        7,
      );
    }
  } else if (actor === "tioconejo") {
    line(ctx, [424, 411, 607, 500, 816, 500], "#d6c28f", 3);
    if (tick > 90) {
      ellipse(ctx, 792, 515, 89, 22, "#0b1516");
      ring(scene, 792, 500, 74, "#a4b49a", 0.3);
    }
    bubble(
      scene,
      tick < 90 ? "Una ayudita, compadre…" : "¡Cuidado con el caminito!",
      545,
      186,
      276,
    );
  } else {
    for (let n = 0; n < 12; n++) {
      const a = (n / 12) * TAU + (tick / 180) * motion;
      ellipse(
        ctx,
        740 + Math.cos(a) * 147,
        373 + Math.sin(a) * 116,
        11,
        5,
        n % 2 ? "#a2d4b7aa" : "#e7d18caa",
      );
    }
  }
  damage(scene, 205);
}

function iconFinale(scene: Scene) {
  const { ctx, actor, rival, tick, pulse, profile } = scene;
  body(scene, actor, 325, 516, 297, 1, "perform");
  body(scene, rival, 770, 516, 291, -1, pulse ? "recoil" : "stand");
  for (let n = 0; n < 3; n++) {
    const x = 570 + n * 80,
      y = 315 + Math.sin(tick / 24 + n) * 18 * scene.motion,
      color =
        actor === "bolivar"
          ? ["#ffe180", "#7db8ed", "#ee9392"][n]
          : profile.accent;
    if (actor === "lorenzo") {
      line(ctx, [x - 24, y, x + 24, y, x, y - 30, x, y + 30], color, 6);
      line(
        ctx,
        [x - 17, y - 20, x + 17, y + 20, x - 17, y + 20, x + 17, y - 20],
        color,
        3,
      );
    } else if (actor === "carolina" || actor === "bolivar") {
      line(
        ctx,
        [410, y + n * 24, x - 60, y - 55, x, y + 40, 840, y - 30],
        color,
        7,
      );
    } else if (actor === "dayana") {
      line(
        ctx,
        [
          x - 32,
          y + 20,
          x - 37,
          y - 20,
          x - 12,
          y,
          x,
          y - 36,
          x + 12,
          y,
          x + 37,
          y - 20,
          x + 32,
          y + 20,
          x - 32,
          y + 20,
        ],
        color,
        5,
      );
    } else if (actor === "edgar") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 31, y - 25, 62, 50);
      line(
        ctx,
        [
          x - 31,
          y - 12,
          x + 31,
          y - 12,
          x - 31,
          y - 25,
          x - 12,
          y - 12,
          x + 5,
          y - 25,
          x + 23,
          y - 12,
        ],
        color,
        3,
      );
      text(ctx, String(n + 1), x, y + 14, 20, color);
    } else {
      ring(scene, x, y, 22 + pulse * 20 + n * 6, color, 0.8);
      line(
        ctx,
        [370, 360, 405, 360, 405, 405, 370, 405, 370, 360, 386, 360, 386, 435],
        color,
        5,
      );
    }
  }

  damage(scene, 205);
}

/** Draw temporary actors and props inside the arena camera already on the context. */
export function drawFinale(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  sprites: Record<string, SpriteAsset>,
  props: Record<string, HTMLImageElement>,
  reducedMotion = false,
  _viewport = { width: 1080, height: 640 },
) {
  const finale = state.finale,
    profile = finale && finaleById(finale.fighter);
  const layout = finaleArenaLayout(state);
  if (!finale || !profile || profile.mode !== "capture" || !layout) return;
  const tick = clamp(finale.tick, 0, finale.duration);
  let beat = -1,
    pulse = 0;
  for (const [i, at] of profile.damageBeats.entries())
    if (tick >= at) {
      beat = i;
      pulse = Math.max(pulse, clamp(1 - (tick - at) / 20));
    }
  const scene: Scene = {
    ctx,
    state,
    profile,
    sprites,
    props,
    tick,
    motion: reducedMotion ? 0 : 1,
    pulse,
    beat,
    actor: finale.fighter,
    rival: state.players[finale.target].config.fighter,
    layout,
  };
  ctx.save();
  const previousDirection = sceneDirections.get(ctx);
  sceneDirections.set(ctx, layout.direction);
  ctx.translate(layout.originX, layout.originY);
  ctx.scale(layout.scale * layout.direction, layout.scale);
  ctx.translate(-540, -516);
  ctx.imageSmoothingEnabled = true;
  if ((CANONICAL_FINALE_FIGHTERS as readonly string[]).includes(profile.id))
    iconFinale(scene);
  else if (profile.id === "capriles") coffee(scene);
  else if (profile.family === "dance") dance(scene);
  else if (profile.family === "technology") hack(scene);
  else if (profile.family === "transport") transport(scene);
  else if (profile.family === "music") music(scene);
  else if (profile.family === "broadcast") broadcast(scene);
  else if (profile.family === "theater") theater(scene);
  else if (profile.family === "folklore") folklore(scene);
  text(ctx, "DEFINITIVA", 540, 150, 25, "#ffe5a3");
  ctx.restore();
  if (previousDirection === undefined) sceneDirections.delete(ctx);
  else sceneDirections.set(ctx, previousDirection);
}
