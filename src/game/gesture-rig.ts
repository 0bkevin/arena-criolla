import {
  CHOREOGRAPHIES,
  type Choreography,
  type Gesture,
  type Hand,
} from "../../shared/choreography";
import type { FighterId } from "../../shared/content";
import { drawSprite, spriteFrameSource, type SpriteAsset } from "./assets";

export interface RigPoint {
  x: number;
  y: number;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
function turn(point: RigPoint, pivot: RigPoint, angle: number): RigPoint {
  const x = point.x - pivot.x,
    y = point.y - pivot.y;
  return {
    x: pivot.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: pivot.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}
function arm(
  point: RigPoint,
  shoulder: RigPoint,
  hand: Hand,
  angle: number,
  dx: number,
  dy: number,
  neck: number,
) {
  const vx = hand[0] - shoulder.x,
    vy = hand[1] - shoulder.y;
  const along = clamp(
    ((point.x - shoulder.x) * vx + (point.y - shoulder.y) * vy) /
      Math.max(0.002, vx * vx + vy * vy),
  );
  const distance = Math.hypot(
    point.x - shoulder.x - along * vx,
    point.y - shoulder.y - along * vy,
  );
  const influence =
    Math.exp((-distance * distance) / 0.014) *
    smooth((point.y - neck + 0.01) / 0.09) *
    (0.18 + along * 0.82);
  const rotated = turn(point, shoulder, angle);
  // A broad skinning field keeps sleeve and wrist attached without cutting the bitmap.
  // Translation is bounded to avoid folding a limb when an atlas pose has a low hand.
  return {
    x:
      (rotated.x - point.x + Math.max(-0.055, Math.min(0.055, dx))) * influence,
    y:
      (rotated.y - point.y + Math.max(-0.075, Math.min(0.075, dy))) * influence,
  };
}

/** Deform a point in an upright, right-facing body, measured in body-height units. */
function rigStep(
  point: RigPoint,
  rig: Choreography,
  gesture: Gesture,
  frame: number,
): RigPoint {
  const hands =
    frame === 0
      ? rig.hands
      : frame === 1
        ? (rig.raisedHands ??
          ([
            [-0.055, rig.shoulders + 0.04],
            [0.14, rig.shoulders - 0.005],
          ] as const))
        : ([
            [-0.11, rig.shoulders + 0.06],
            [0.13, rig.shoulders + 0.04],
          ] as const);
  const back = arm(
    point,
    { x: -0.085, y: rig.shoulders },
    hands[0],
    gesture.back,
    gesture.backX,
    gesture.backY,
    rig.neck,
  );
  const front = arm(
    point,
    { x: 0.07, y: rig.shoulders },
    hands[1],
    gesture.front,
    gesture.frontX,
    gesture.frontY,
    rig.neck,
  );
  let result = { x: point.x + back.x + front.x, y: point.y + back.y + front.y };
  const headWeight = 1 - smooth((point.y - rig.neck + 0.02) / 0.065);
  result = turn(result, { x: 0, y: rig.neck }, gesture.head * headWeight);
  result = turn(
    result,
    { x: 0, y: 0.61 },
    gesture.lean * (1 - smooth((point.y - 0.58) / 0.25)),
  );
  const hem =
    smooth((point.y - 0.38) / 0.4) * (1 - smooth((point.y - 0.94) / 0.06));
  result.x += gesture.cloth * 0.019 * hem * Math.sin(point.y * Math.PI * 3.2);
  return result;
}

export function deformRigPoint(
  point: RigPoint,
  rig: Choreography,
  gesture: Gesture,
  frame: number,
): RigPoint {
  if (!(
    gesture.head ||
    gesture.lean ||
    gesture.back ||
    gesture.front ||
    gesture.backX ||
    gesture.backY ||
    gesture.frontX ||
    gesture.frontY ||
    gesture.cloth
  ))
    return point;
  // Integrate the skinning field in small steps. A single large displacement can
  // invert triangles near a raised wrist or neck; the flow preserves the silhouette.
  const steps = 8;
  const increment = { ...gesture };
  for (const key of Object.keys(increment) as (keyof Gesture)[]) {
    if (key === "at") continue;
    const bound = key.endsWith("X")
      ? 0.055
      : key.endsWith("Y")
        ? 0.075
        : Infinity;
    increment[key] = Math.max(-bound, Math.min(bound, gesture[key])) / steps;
  }
  let moved = point;
  for (let step = 0; step < steps; step++)
    moved = rigStep(moved, rig, increment, frame);
  for (const part of rig.rigidParts ?? []) {
    if (part.frames && !part.frames.includes(frame)) continue;
    let weight = 0;
    for (const zone of part.zones) {
      const dx = zone.to[0] - zone.from[0],
        dy = zone.to[1] - zone.from[1];
      const along = clamp(
        ((point.x - zone.from[0]) * dx + (point.y - zone.from[1]) * dy) /
          Math.max(0.00001, dx * dx + dy * dy),
      );
      const distance = Math.hypot(
        point.x - zone.from[0] - along * dx,
        point.y - zone.from[1] - along * dy,
      );
      weight = Math.max(weight, 1 - smooth((distance - zone.radius) / 0.16));
    }
    if (weight <= 0) continue;
    const pivot = { x: part.pivot[0], y: part.pivot[1] };
    let anchor = pivot;
    if (part.bind === "back" || part.bind === "front")
      for (let step = 0; step < steps; step++)
        anchor = rigStep(anchor, rig, increment, frame);
    const rotation =
      gesture.lean +
      (part.bind === "body"
        ? gesture.back * (part.rock ?? 0)
        : gesture[part.bind] * 0.35);
    const rigid =
      part.bind === "head"
        ? turn(
            turn(point, { x: 0, y: rig.neck }, gesture.head),
            { x: 0, y: 0.61 },
            gesture.lean,
          )
        : part.bind === "body"
          ? turn(point, { x: 0, y: 0.61 }, rotation)
          : turn(point, pivot, rotation);
    rigid.x += anchor.x - pivot.x;
    rigid.y += anchor.y - pivot.y;
    moved = {
      x: moved.x + (rigid.x - moved.x) * weight,
      y: moved.y + (rigid.y - moved.y) * weight,
    };
  }
  // Face, glasses, cap and ears share one rigid head transform. A wrist field
  // must never stretch the likeness, even when a hand moves near the cheek.
  const faceWidth = rig.neck > 0.25 ? 0.125 : 0.1;
  const headWidth =
    faceWidth +
    ((rig.headWidth ?? faceWidth) - faceWidth) *
      (1 - smooth((point.y - rig.neck * 0.5) / (rig.neck * 0.4)));
  const headWeight =
    (1 - smooth((point.y - rig.neck) / 0.12)) *
    (1 - smooth((Math.abs(point.x) - headWidth) / 0.09));
  const head = turn(
    turn(point, { x: 0, y: rig.neck }, gesture.head),
    { x: 0, y: 0.61 },
    gesture.lean,
  );
  moved = {
    x: moved.x + (head.x - moved.x) * headWeight,
    y: moved.y + (head.y - moved.y) * headWeight,
  };
  return moved;
}

export function handAnchors(
  sprite: SpriteAsset,
  id: FighterId,
  frame: number,
  gesture: Gesture,
): [RigPoint, RigPoint] {
  const rig = CHOREOGRAPHIES[id],
    source = sprite.frames[frame];
  const hands =
    frame === 0
      ? rig.hands
      : (rig.raisedHands ??
        ([
          [-0.055, rig.shoulders + 0.04],
          [0.14, rig.shoulders - 0.005],
        ] as const));
  const headX = sprite.portraitCenters[frame] - source.x + source.slotX;
  const direction = sprite.frameFacing[frame];
  return hands.map((hand) => {
    const moved = deformRigPoint(
      { x: hand[0], y: hand[1] },
      rig,
      gesture,
      frame,
    );
    return {
      x:
        ((source.x - source.slotX - sprite.cellWidth / 2 + headX) * direction +
          moved.x * source.height) /
        sprite.bodyHeight,
      y:
        ((frame === 4 ? -sprite.bodyHeight : -source.height) +
          moved.y * source.height) /
        sprite.bodyHeight,
    };
  }) as [RigPoint, RigPoint];
}

const frames = new WeakMap<SpriteAsset, Map<number, HTMLCanvasElement>>();
function isolatedFrame(sprite: SpriteAsset, frame: number): HTMLCanvasElement {
  let cache = frames.get(sprite);
  if (!cache) {
    cache = new Map();
    frames.set(sprite, cache);
  }
  let canvas = cache.get(frame);
  if (!canvas) {
    const source = sprite.frames[frame];
    canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const texture = spriteFrameSource(sprite, frame);
    canvas
      .getContext("2d")!
      .drawImage(
        texture.image,
        texture.x,
        texture.y,
        source.width,
        source.height,
        0,
        0,
        source.width,
        source.height,
      );
    cache.set(frame, canvas);
  }
  return canvas;
}

function triangle(
  ctx: CanvasRenderingContext2D,
  texture: HTMLCanvasElement,
  a: RigPoint,
  b: RigPoint,
  c: RigPoint,
  p: RigPoint,
  q: RigPoint,
  r: RigPoint,
) {
  const dx1 = b.x - a.x,
    dy1 = b.y - a.y,
    dx2 = c.x - a.x,
    dy2 = c.y - a.y;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 0.001) return;
  const m11 = ((q.x - p.x) * dy2 - (r.x - p.x) * dy1) / det;
  const m21 = ((q.y - p.y) * dy2 - (r.y - p.y) * dy1) / det;
  const m12 = ((r.x - p.x) * dx1 - (q.x - p.x) * dx2) / det;
  const m22 = ((r.y - p.y) * dx1 - (q.y - p.y) * dx2) / det;
  ctx.save();
  ctx.beginPath();
  // Half a destination pixel of overlap prevents bright cracks at triangle edges.
  const cx = (p.x + q.x + r.x) / 3,
    cy = (p.y + q.y + r.y) / 3;
  const expand = (v: RigPoint) => {
    const length = Math.hypot(v.x - cx, v.y - cy) || 1;
    return {
      x: v.x + ((v.x - cx) / length) * 0.45,
      y: v.y + ((v.y - cy) / length) * 0.45,
    };
  };
  const v1 = expand(p),
    v2 = expand(q),
    v3 = expand(r);
  ctx.moveTo(v1.x, v1.y);
  ctx.lineTo(v2.x, v2.y);
  ctx.lineTo(v3.x, v3.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    m11,
    m21,
    m12,
    m22,
    p.x - m11 * a.x - m12 * a.y,
    p.y - m21 * a.x - m22 * a.y,
  );
  ctx.drawImage(texture, 0, 0);
  ctx.restore();
}

export function drawArticulatedSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  id: FighterId,
  frame: number,
  height: number,
  facing: number,
  gesture: Gesture,
) {
  const moving = Object.entries(gesture).some(
    ([key, value]) => key !== "at" && Math.abs(value) > 0.0001,
  );
  if (!moving) {
    drawSprite(ctx, sprite, frame, 0, 0, height, facing);
    return;
  }
  const source = sprite.frames[frame];
  const texture = isolatedFrame(sprite, frame);
  const scale = height / sprite.bodyHeight;
  const headX = sprite.portraitCenters[frame] - source.x + source.slotX;
  const direction = sprite.frameFacing[frame];
  const offsetX = (source.x - source.slotX - sprite.cellWidth / 2) * scale;
  const offsetY = frame === 4 ? -height : -source.height * scale;
  // Only cinematic/selection actors use the rig. Combat keeps the original atlas.
  const cols = 10,
    rows = 18;
  const points: RigPoint[] = [],
    targets: RigPoint[] = [];
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= cols; col++) {
      const point = {
        x: (source.width * col) / cols,
        y: (source.height * row) / rows,
      };
      const moved = deformRigPoint(
        {
          x: ((point.x - headX) / source.height) * direction,
          y: point.y / source.height,
        },
        CHOREOGRAPHIES[id],
        gesture,
        frame,
      );
      points.push(point);
      targets.push({
        x: offsetX + (headX + moved.x * source.height * direction) * scale,
        y: offsetY + moved.y * source.height * scale,
      });
    }
  ctx.save();
  ctx.scale(facing * direction, 1);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const a = row * (cols + 1) + col,
        b = a + 1,
        c = a + cols + 1,
        d = c + 1;
      triangle(
        ctx,
        texture,
        points[a],
        points[b],
        points[d],
        targets[a],
        targets[b],
        targets[d],
      );
      triangle(
        ctx,
        texture,
        points[a],
        points[d],
        points[c],
        targets[a],
        targets[d],
        targets[c],
      );
    }
  ctx.restore();
}
