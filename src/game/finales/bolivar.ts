import { fighterById } from "../../../shared/content";
import { WORLD, type PlayerState } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { spriteFrameSource, type SpriteAsset } from "../assets";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const BOLIVAR_SPECIAL_POSES = [
  "draw",
  "slash",
  "cut",
  "thrust",
] as const;
export const BOLIVAR_POSES = [
  ...BOLIVAR_SPECIAL_POSES,
  "ready",
  "gallop-a",
  "gallop-b",
  "horse",
  ...Array.from({ length: 6 }, (_, i) => `llanero-${i + 1}`),
];
export const BOLIVAR_CONTACT_TICK = 96;
// Source core heights with one shared source pixel scale per generated sheet.
export const BOLIVAR_BODY_HEIGHTS: Record<string, number> = {
  draw: 494,
  slash: 493,
  cut: 502,
  thrust: 468,
  ready: 525,
  "gallop-a": 516,
  "gallop-b": 476,
  horse: 413,
};
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export function bolivarSpecialPose(tick: number) {
  return tick < 10
    ? "draw"
    : tick < 22
      ? "slash"
      : tick < 34
        ? "cut"
        : tick < 46
          ? "thrust"
          : tick < 52
            ? "draw"
            : undefined;
}
export function drawBolivarSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "bolivar" ||
    p.attack !== "special" ||
    p.stun ||
    !images ||
    !hasAttackArt(images, "bolivar", BOLIVAR_SPECIAL_POSES)
  )
    return false;
  const pose = bolivarSpecialPose(p.attackTick);
  if (!pose) return false;
  return drawAttackArt(
    ctx,
    images,
    "bolivar",
    pose,
    p.x,
    p.y,
    (height * BOLIVAR_BODY_HEIGHTS[pose]) / 494,
    p.facing,
  );
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
export function bolivarRivalFront(
  sprite: SpriteAsset | undefined,
  height: number,
  drop: number,
) {
  if (!sprite) return -height * 0.17;
  const f = sprite.frames[sprite.battleFrame],
    s = spriteFrameSource(sprite, sprite.battleFrame),
    m = bitmap(sprite, "battle", s.image, s.x, s.y, f.width, f.height),
    scale = height / sprite.bodyHeight,
    flip = -sprite.frameFacing[sprite.battleFrame],
    left = (f.x - f.slotX - sprite.cellWidth / 2) * scale;
  if (!m) return -height * 0.17;
  const row = Math.round(f.height - drop / scale);
  let edge = Infinity;
  for (let y = Math.max(0, row - 2); y <= Math.min(f.height - 1, row + 2); y++)
    for (let x = 0; x < f.width; x++)
      if (m.data[(y * f.width + x) * 4 + 3] >= 100)
        edge = Math.min(edge, (left + x * scale) * flip);
  return Number.isFinite(edge) ? edge : NaN;
}
/** Horse-only mask: below the boots, plus the leading muzzle/neck beyond 70%
 * of the painted width. Rider hands, head and sword are outside this region. */
export function bolivarHorseFront(
  view: FinaleView,
  pose: string,
  height: number,
  drop: number,
) {
  if (drop > height * 0.7 || drop < 10) return NaN;
  const sheet = ATTACK_ART.bolivar,
    f = sheet.frames[pose],
    image = view.images[sheet.file],
    m = bitmap(image, pose, image, f.x, f.y, f.width, f.height),
    scale = height / f.bodyHeight!;
  if (!m) return height * 0.55;
  const row = Math.round(f.anchorY! - drop / scale);
  let edge = -Infinity;
  for (let y = Math.max(0, row - 2); y <= Math.min(f.height - 1, row + 2); y++)
    for (
      let x = drop > height * 0.4 ? Math.ceil(f.width * 0.7) : 0;
      x < f.width;
      x++
    )
      if (m.data[(y * f.width + x) * 4 + 3] >= 100)
        edge = Math.max(edge, (x - f.anchorX) * scale);
  return Number.isFinite(edge) ? edge : NaN;
}
export function drawBolivarFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "bolivar", BOLIVAR_POSES)) return false;
  const { tick, ctx } = view,
    finale = view.state.finale!,
    sheet = ATTACK_ART.bolivar,
    source = view.point(306, 514),
    target = view.point(782, 514),
    span = Math.max(1, target.x - source.x);
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
  // A short visual descent brings an elevated opponent to the cavalry's ground lane;
  // both complete canonical figures return to their exact captured surface on release.
  const enter = Math.min(smooth(tick / 30), smooth((180 - tick) / 20));
  const rivalFeet = mix(target.y, ground, enter),
    rivalHeight = (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177,
    sprite = view.sprites[view.rival];
  const visible = sprite
    ? (rivalHeight * sprite.frames[sprite.battleFrame].height) /
      sprite.bodyHeight
    : rivalHeight;
  const pose =
    tick >= 54 && tick < 122
      ? Math.floor(tick / 6) % 2
        ? "gallop-b"
        : "gallop-a"
      : "ready";
  // All commander poses use the same source pixel multiplier: no head-scale pumping.
  const scale = 0.94,
    height = BOLIVAR_BODY_HEIGHTS[pose] * scale;
  const contactHeight = BOLIVAR_BODY_HEIGHTS["gallop-a"] * scale;
  let drop = 0,
    front = NaN,
    edge = NaN,
    envelope = -Infinity;
  // Earliest opaque contact over every shared scanline. A hoof cannot already
  // penetrate the rival while a conveniently chosen chest row still shows a gap.
  for (let y = 10; y <= Math.min(contactHeight * 0.7, visible - 8); y++) {
    const a = bolivarHorseFront(view, "gallop-a", contactHeight, y),
      b = bolivarRivalFront(sprite, rivalHeight, y);
    if (Number.isFinite(a) && Number.isFinite(b) && a - b > envelope) {
      drop = y;
      front = a;
      edge = b;
      envelope = a - b;
    }
  }
  if (!Number.isFinite(front) || !Number.isFinite(edge)) return false;
  // Six distinct riders in two staggered ground lanes; the rear rank has a
  // bounded 24px perspective depth, independent of captured platform heights.
  const supportHeights = [486, 491, 501, 510, 798 * 0.62, 788 * 0.62].map(
      (h) => (h * 400) / 486,
    ),
    offsets = [-350, -550, -750, -450, -650, -850];
  const ranges = offsets.map((offset, i) => {
    const r = finaleArtXRange(
      view.viewport,
      sheet.frames[`llanero-${i + 1}`],
      supportHeights[i],
      1,
    );
    return { minX: r.minX - offset, maxX: r.maxX - offset };
  });
  const mainRanges = ["ready", "gallop-a", "gallop-b", "horse"].map((p) =>
    finaleArtXRange(
      view.viewport,
      sheet.frames[p],
      BOLIVAR_BODY_HEIGHTS[p] * scale,
      1,
    ),
  );
  const minX = Math.max(
    ...ranges.map((r) => r.minX),
    ...mainRanges.map((r) => r.minX),
  );
  const rivalPad = sprite
    ? ((sprite.frames[sprite.battleFrame].width * rivalHeight) /
        sprite.bodyHeight) *
      0.65
    : 130;
  const maxX = Math.min(
    ...ranges.map((r) => r.maxX),
    ...mainRanges.map((r) => r.maxX),
    (view.viewport?.right ?? Infinity) - rivalPad - 12 - front + edge,
  );
  // Common stop independent of gait. Contact uses the actual gait's opaque contour.
  const travel = Math.min(90, Math.max(0, maxX - minX));
  const endX = clamp(target.x + edge - front, minX + travel, maxX),
    startX = Math.max(minX, endX - 90);
  const charge = clamp((tick - 54) / 42) ** 2,
    retreat = smooth((tick - 122) / 24),
    horseX =
      tick < 122 ? mix(startX, endX, charge) : mix(endX, startX, retreat);
  const rivalEnd = endX + front - edge,
    rivalX = mix(target.x, rivalEnd, enter);
  const alpha = Math.min(smooth((tick - 2) / 12), smooth((176 - tick) / 12));
  for (let i = 5; i >= 0; i--)
    drawAttackArt(
      ctx,
      view.images,
      "bolivar",
      `llanero-${i + 1}`,
      horseX + offsets[i],
      ground - (i >= 3 ? 24 : 0),
      supportHeights[i],
      1,
      alpha,
    );
  let gaitEnvelope = envelope;
  if (pose === 'gallop-b') {
    for (let y = 10; y <= Math.min(height * .7, visible - 8); y++) {
      const a = bolivarHorseFront(view, pose, height, y), b = bolivarRivalFront(sprite, rivalHeight, y);
      if (Number.isFinite(a) && Number.isFinite(b)) gaitEnvelope = Math.max(gaitEnvelope, a - b);
    }
  }
  // Gathered hooves may project beyond the extended gait's front. A bounded
  // gait offset prevents premature contact without moving either fighter.
  const drawHorseX = horseX - Math.max(0, gaitEnvelope - envelope);
  const occupied = tick >= 36 && tick < 146;
  drawAttackArt(
    ctx,
    view.images,
    "bolivar",
    occupied ? pose : "horse",
    drawHorseX,
    ground,
    occupied ? height : BOLIVAR_BODY_HEIGHTS.horse * scale,
    1,
    alpha,
  );
  const recoil =
    tick > 96 && tick < 122 ? Math.sin(((tick - 96) / 26) * Math.PI) * 28 : 0;
  body(
    view.rival,
    rivalX + recoil,
    rivalFeet,
    tick > 96 && tick < 122 ? "hurt" : "stand",
  );
  const mountX = horseX - 35,
    mountFeet = ground - 145;
  if (tick < 36) {
    const t = smooth((tick - 12) / 24);
    body(
      view.actor,
      mix(source.x, mountX, t),
      mix(source.y, mountFeet, t) - Math.sin(t * Math.PI) * 60,
    );
  } else if (tick >= 146) {
    const t = smooth((tick - 146) / 24);
    body(
      view.actor,
      mix(mountX, source.x, t),
      mix(mountFeet, source.y, t) - Math.sin(t * Math.PI) * 60,
    );
  }
  if (tick >= 96 && tick < 106 && view.motion) {
    ctx.save();
    ctx.globalAlpha *= (106 - tick) / 10;
    view.ring(endX + front, ground - drop, 22, "#ffe4a2", 0.8);
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
      Math.max(
        (view.viewport?.top ?? -Infinity) + 30,
        rivalFeet - visible - 30,
      ),
      27,
      "#ffb4a2",
    );
    ctx.restore();
  }
  view.text(
    "DEFINITIVA",
    clamp(
      horseX,
      (view.viewport?.left ?? -Infinity) + 90,
      (view.viewport?.right ?? Infinity) - 90,
    ),
    Math.max(
      (view.viewport?.top ?? -Infinity) + 30,
      Math.min(ground - 525 * scale, rivalFeet - visible) - 25,
    ),
    25,
    "#ffe5a3",
  );
  return true;
}
