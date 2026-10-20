import { fighterById } from "../../../shared/content";
import {
  WORLD,
  type PlayerState,
  type Projectile,
} from "../../../shared/engine";
import { TECHNIQUES } from "../../../shared/techniques";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { spriteFrameSource, type SpriteAsset } from "../assets";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const LORENZO_SPECIAL_POSES = [
  "windup",
  "throw",
  "recover",
  "bag",
] as const;
export const LORENZO_POSES = [
  ...LORENZO_SPECIAL_POSES,
  "ride-right",
  "ride-left",
  "truck-right",
  "truck-left",
  "front-right",
  "front-left",
] as const;
export const LORENZO_CONTACT_TICK = 96;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export const LORENZO_BODY_HEIGHTS: Record<string, number> = {
  windup: 559,
  throw: 1068 * 0.52,
  recover: 582,
};
export function lorenzoSpecialPose(tick: number) {
  return tick < 11
    ? "windup"
    : tick < 23
      ? "throw"
      : tick < 43
        ? "recover"
        : undefined;
}
export const lorenzoPoseHeight = (pose: string, height: number) =>
  (height * LORENZO_BODY_HEIGHTS[pose]) / 559;

/** The package remains upright in screen space, including a reflected projectile. */
export function drawLorenzoBag(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  height: number,
) {
  if (!hasAttackArt(images, "lorenzo", ["bag"])) return false;
  const f = ATTACK_ART.lorenzo.frames.bag;
  const mirror =
    typeof ctx.getTransform === "function" && ctx.getTransform().a < 0 ? -1 : 1;
  return drawAttackArt(
    ctx,
    images,
    "lorenzo",
    "bag",
    x,
    y + ((f.anchorY! - f.height / 2) * height) / f.bodyHeight!,
    height,
    mirror,
  );
}
export function drawLorenzoProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "polar") return false;
  ctx.save();
  ctx.shadowBlur = 0;
  if (!drawLorenzoBag(ctx, images, 0, 0, (shot.radius ?? 16) * 2.6)) {
    // An absent optional sheet keeps the hit location visible without the obsolete stars.
    ctx.fillStyle = "#e9c348";
    ctx.strokeStyle = "#203356";
    ctx.fillRect(-10, -16, 20, 32);
    ctx.strokeRect(-10, -16, 20, 32);
  }
  ctx.restore();
  return true;
}
export function drawLorenzoSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "lorenzo" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "lorenzo", LORENZO_SPECIAL_POSES)
  )
    return false;
  const pose = lorenzoSpecialPose(p.attackTick);
  if (!pose) return false;
  drawAttackArt(
    ctx,
    images,
    "lorenzo",
    pose,
    p.x,
    p.y,
    lorenzoPoseHeight(pose, height),
    p.facing,
  );
  if (p.attackTick < TECHNIQUES.polar.startup) {
    const unit = height / 177;
    const x = pose === "windup" ? -10 : TECHNIQUES.polar.projectile!.offsetX!;
    const y = pose === "windup" ? 66 : TECHNIQUES.polar.projectile!.offsetY!;
    for (let n = -1; n <= 1; n++)
      drawLorenzoBag(
        ctx,
        images,
        p.x + p.facing * (x + n * 7) * unit,
        p.y - (y + n * 9) * unit,
        38 * unit,
      );
  }
  return true;
}

const masks = new WeakMap<object, Map<string, ImageData>>();
function bitmap(
  key: object,
  name: string,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  let all = masks.get(key);
  if (!all) {
    all = new Map();
    masks.set(key, all);
  }
  let mask = all.get(name);
  if (!mask && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
    mask = ctx.getImageData(0, 0, width, height);
    all.set(name, mask);
  }
  return mask;
}
function rivalFront(
  sprite: SpriteAsset | undefined,
  height: number,
  drop: number,
) {
  if (!sprite) return -height * 0.17;
  const f = sprite.frames[sprite.battleFrame],
    s = spriteFrameSource(sprite, sprite.battleFrame);
  const m = bitmap(sprite, "battle", s.image, s.x, s.y, f.width, f.height);
  const scale = height / sprite.bodyHeight,
    flip = -sprite.frameFacing[sprite.battleFrame];
  const left = (f.x - f.slotX - sprite.cellWidth / 2) * scale;
  if (!m) return -height * 0.17;
  const row = Math.round(f.height - drop / scale);
  let edge = Infinity;
  for (let y = Math.max(0, row - 2); y <= Math.min(f.height - 1, row + 2); y++)
    for (let x = 0; x < f.width; x++)
      if (m.data[(y * f.width + x) * 4 + 3] >= 100)
        edge = Math.min(edge, (left + x * scale) * flip);
  return Number.isFinite(edge) ? edge : NaN;
}
function truckFront(
  view: FinaleView,
  pose: string,
  height: number,
  drop: number,
  facing: number,
) {
  const sheet = ATTACK_ART.lorenzo,
    f = sheet.frames[pose],
    image = view.images[sheet.file];
  const m = bitmap(image, pose, image, f.x, f.y, f.width, f.height);
  const scale = height / f.bodyHeight!;
  if (!m) return f.width * scale * 0.49;
  const row = Math.round(f.anchorY! - drop / scale);
  let edge = -Infinity;
  for (let y = Math.max(0, row - 2); y <= Math.min(f.height - 1, row + 2); y++)
    for (let x = 0; x < f.width; x++)
      if (m.data[(y * f.width + x) * 4 + 3] >= 100)
        edge = Math.max(edge, (x - f.anchorX) * scale * facing);
  return Number.isFinite(edge) ? edge : NaN;
}

export function drawLorenzoFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "lorenzo", LORENZO_POSES)) return false;
  const { tick, ctx } = view,
    finale = view.state.finale!,
    sheet = ATTACK_ART.lorenzo;
  const direction = finale.direction < 0 ? -1 : 1;
  const side = direction < 0 ? "left" : "right";
  // Repainted left-facing trucks, then cancel the scene mirror: POLAR stays readable.
  const ride = "ride-" + side,
    empty = "truck-" + side;
  const source = view.point(306, 514),
    target = view.point(782, 514);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 306 + ((x - source.x) * 476) / span;
  const body = (
    id: typeof view.actor,
    x: number,
    feet: number,
    mode: "stand" | "hurt" = "stand",
  ) =>
    view.body(
      id,
      authored(x),
      514 + feet - view.point(authored(x), 514).y,
      300,
      id === view.actor ? 1 : -1,
      mode,
    );
  const ground =
    source.y + (WORLD.floor - view.state.players[finale.owner].y) / (177 / 300);
  // Rider head has the same visual scale as the canonical actor; trucks never rise to platforms.
  const truckHeight = 500;
  const rivalHeight =
    (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const sprite = view.sprites[view.rival];
  const visible = sprite
    ? (rivalHeight * sprite.frames[sprite.battleFrame].height) /
      sprite.bodyHeight
    : rivalHeight;
  const top = Math.max(ground - truckHeight + 8, target.y - visible + 16),
    bottom = Math.min(ground - 20, target.y - 4);
  // An elevated rival meets the cab at the leading boot. A torso scanline
  // could place the rear boot through the rider even with an empty-truck mask.
  const preferred = clamp(
    target.y - (ground - target.y > 100 ? 8 : visible * 0.45),
    top,
    bottom,
  );
  let contactY = preferred,
    bumper = NaN,
    contact = NaN;
  outer: for (let d = 0; d <= Math.max(0, bottom - top); d++) {
    for (const y of d ? [preferred - d, preferred + d] : [preferred]) {
      if (y < top || y > bottom) continue;
      const a = truckFront(view, empty, truckHeight, ground - y, direction);
      const b = rivalFront(sprite, rivalHeight, target.y - y);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        contactY = y;
        bumper = a;
        contact = b;
        break outer;
      }
    }
  }
  if (!Number.isFinite(bumper) || !Number.isFinite(contact)) return false;
  const lanes = [
    { offset: -810, depth: 0, height: 450 },
    { offset: -510, depth: 0, height: 450 },
    { offset: 0, depth: 0, height: truckHeight },
  ];
  const ranges = lanes.flatMap((l, i) =>
    (i === 2 ? [empty, ride] : ["front-" + side]).map((p) => {
      const r = finaleArtXRange(
        view.viewport,
        sheet.frames[p],
        l.height,
        direction,
      );
      return { minX: r.minX - l.offset, maxX: r.maxX - l.offset };
    }),
  );
  const minX = Math.max(...ranges.map((r) => r.minX));
  const rivalPad = sprite
    ? ((sprite.frames[sprite.battleFrame].width * rivalHeight) /
        sprite.bodyHeight) *
      0.65
    : 130;
  const maxX = Math.min(
    ...ranges.map((r) => r.maxX),
    (view.viewport?.right ?? Infinity) - rivalPad - 12 - bumper + contact,
  );
  const endX = clamp(target.x + contact - bumper, minX + 110, maxX);
  const startX = Math.max(minX, endX - 110);
  const enter = Math.min(smooth(tick / 24), smooth((180 - tick) / 16));
  const rivalEnd = endX + bumper - contact;
  const rivalX = mix(target.x, rivalEnd, enter);
  const charge = clamp((tick - 54) / (LORENZO_CONTACT_TICK - 54)) ** 2;
  const retreat = smooth((tick - 122) / 24);
  const truckX =
    tick < 122 ? mix(startX, endX, charge) : mix(endX, startX, retreat);
  const occupied = tick >= 36 && tick < 146;
  const alpha = Math.min(smooth((tick - 2) / 12), smooth((176 - tick) / 12));
  const recoil =
    tick > 96 && tick < 122 ? Math.sin(((tick - 96) / 26) * Math.PI) * 24 : 0;
  // Rival drawn in front after vehicles; silhouette remains readable at contact.
  for (const index of [2, 1, 0]) {
    const lane = lanes[index];
    drawAttackArt(
      ctx,
      view.images,
      "lorenzo",
      index === 2 ? (occupied ? ride : empty) : "front-" + side,
      truckX + lane.offset,
      ground + lane.depth,
      lane.height,
      direction,
      alpha,
    );
  }
  body(
    view.rival,
    rivalX + recoil,
    target.y,
    tick >= 97 && tick < 122 ? "hurt" : "stand",
  );
  // Whole canonical figure travels to/from the running board. No clipped body or duplicate rider.
  const mountX = truckX + (direction > 0 ? 48 : 137),
    mountFeet = ground - 83;
  if (tick < 36) {
    const t = smooth((tick - 12) / 24);
    body(
      view.actor,
      mix(source.x, mountX, t),
      mix(source.y, mountFeet, t) - Math.sin(t * Math.PI) * 75,
    );
  } else if (tick >= 146) {
    const t = smooth((tick - 146) / 24);
    body(
      view.actor,
      mix(mountX, source.x, t),
      mix(mountFeet, source.y, t) - Math.sin(t * Math.PI) * 60,
    );
  }
  if (tick >= 96 && tick < 106) {
    ctx.save();
    ctx.globalAlpha *= (106 - tick) / 10;
    ctx.strokeStyle = "#ffe4a2";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(endX + bumper + Math.cos(a) * 10, contactY + Math.sin(a) * 10);
      ctx.lineTo(endX + bumper + Math.cos(a) * 28, contactY + Math.sin(a) * 28);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (view.pulse) {
    ctx.save();
    ctx.globalAlpha *= view.pulse;
    view.text(
      `−${Math.round(finale.damage)} VIDA`,
      clamp(
        rivalX,
        (view.viewport?.left ?? -Infinity) + 70,
        (view.viewport?.right ?? Infinity) - 70,
      ),
      Math.max((view.viewport?.top ?? -Infinity) + 30, target.y - visible - 30),
      27,
      "#ffb4a2",
    );
    ctx.restore();
  }
  view.text(
    "DEFINITIVA",
    clamp(
      truckX,
      (view.viewport?.left ?? -Infinity) + 90,
      (view.viewport?.right ?? Infinity) - 90,
    ),
    Math.max(
      (view.viewport?.top ?? -Infinity) + 30,
      Math.min(ground - truckHeight, target.y - visible) - 25,
    ),
    25,
    "#ffe5a3",
  );
  return true;
}
