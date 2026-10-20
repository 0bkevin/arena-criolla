import {
  WORLD,
  type Effect,
  type MatchState,
  type PlayerState,
  type Projectile,
} from "../../../shared/engine";
import { fighterById } from "../../../shared/content";
import { spriteFrameSource, type SpriteAsset } from "../assets";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { clampFinaleArtX, finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const DUDAMEL_POSES = [
  "ready",
  "upbeat",
  "downbeat",
  "fortissimo",
  "orchestra",
] as const;
export const DUDAMEL_TRAVEL = 24;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
// Same source-pixel scale in every pose. The raised baton is not body height.
const sourceHeights: Record<string, number> = {
  ready: 528,
  upbeat: 593,
  downbeat: 507,
  fortissimo: 564,
};
export const dudamelHeight = (pose: string, body = 305) =>
  (sourceHeights[pose] * body) / 528;
export function dudamelSpecialPose(tick: number) {
  return tick < 7
    ? "ready"
    : tick < 18
      ? "upbeat"
      : tick < 29
        ? "downbeat"
        : "ready";
}

/** Abstract musical effect. Its radius is the physical projectile radius. */
export function drawDudamelWave(
  ctx: CanvasRenderingContext2D,
  radius: number,
  age = 0,
) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#c6c4ff";
  ctx.strokeStyle = "#eee8ff";
  ctx.lineWidth = 2.5;
  ctx.globalAlpha *= 0.24;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.24;
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.stroke();
  ctx.globalAlpha *= 0.72;
  ctx.beginPath();
  ctx.arc(-radius * 0.22, 0, radius * 0.7, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * radius * 0.4,
      y = Math.sin(i * 2 + age * 0.08) * radius * 0.3;
    const size = Math.max(3, radius * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.7, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.8, y);
    ctx.lineTo(x + size * 0.8, y - size * 3);
    ctx.lineTo(x + size * 2, y - size * 2.6);
    ctx.stroke();
  }
  ctx.restore();
}
export function drawDudamelProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
) {
  if (shot.kind !== "cadenza") return false;
  drawDudamelWave(ctx, shot.radius ?? 24, shot.age ?? 0);
  return true;
}

/** A consumed close-range shot still shows its musical burst on the hit frame. */
export function drawDudamelImpact(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  e: Effect,
) {
  if (
    e.owner === undefined ||
    state.players[e.owner].config.fighter !== "dudamel" ||
    e.impact !== "special" ||
    (e.kind !== "hit" && e.kind !== "block")
  )
    return;
  const age = e.duration - e.life;
  if (age > 9) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.direction ?? 1, 1);
  ctx.globalAlpha *= 1 - age / 10;
  drawDudamelWave(ctx, 24 + age * 2, age);
  ctx.restore();
}
export function drawDudamelSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "dudamel" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "dudamel", DUDAMEL_POSES.slice(0, 4))
  )
    return false;
  const pose = dudamelSpecialPose(p.attackTick);
  return drawAttackArt(
    ctx,
    images,
    "dudamel",
    pose,
    p.x,
    p.y,
    dudamelHeight(pose, height),
    p.facing,
  );
}

const masks = new WeakMap<SpriteAsset, ImageData>();
/** Exact first circle/opaque-pixel contact against the canonical battle pose.
 * The whole opaque contour counts, including arms and props; alpha-0 padding
 * never changes contact. The same mask is used for every radius and both slots. */
export function dudamelRivalContact(
  sprite: SpriteAsset | undefined,
  height: number,
  drop: number,
  radius: number,
) {
  if (!sprite) return -height * 0.18 - radius;
  const index = sprite.battleFrame,
    f = sprite.frames[index],
    scale = height / sprite.bodyHeight;
  let mask = masks.get(sprite);
  if (!mask && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = f.width;
    canvas.height = f.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const s = spriteFrameSource(sprite, index);
    ctx.drawImage(
      s.image,
      s.x,
      s.y,
      f.width,
      f.height,
      0,
      0,
      f.width,
      f.height,
    );
    mask = ctx.getImageData(0, 0, f.width, f.height);
    masks.set(sprite, mask);
  }
  if (!mask) return -height * 0.18 - radius;
  let edge = Infinity;
  const flip = -sprite.frameFacing[index];
  for (let y = 0; y < f.height; y++) {
    const dy = (y - f.height) * scale + drop;
    if (Math.abs(dy) > radius) continue;
    const chord = Math.sqrt(radius * radius - dy * dy);
    for (let x = 0; x < f.width; x++)
      if (mask.data[(y * f.width + x) * 4 + 3] >= 100) {
        const px = (f.x - f.slotX - sprite.cellWidth / 2 + x) * scale * flip;
        edge = Math.min(edge, px - chord);
      }
  }
  return Number.isFinite(edge) ? edge : -height * 0.18 - radius;
}

/** Same arena/camera/physical feet. Orchestra is scenery behind the conductor. */
export function drawDudamelFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "dudamel", DUDAMEL_POSES)) return false;
  const { tick, profile, ctx } = view;
  const source = view.point(347, 510),
    target = view.point(783, 510);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 347 + ((x - source.x) * 436) / span;
  const atFeet = (x: number, feet: number) =>
    510 + feet - view.point(authored(x), 510).y;
  // Move only the illustrated actor back at most the deficit to 310 local px,
  // easing to the exact captured feet again before release; never move physics.
  const spacing =
    Math.max(0, 310 - span) *
    Math.min(clamp(tick / 12), clamp((profile.duration - tick) / 12));
  const sheet = ATTACK_ART.dudamel;
  const ranges = DUDAMEL_POSES.slice(0, 4).map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], dudamelHeight(p)),
  );
  const min = Math.max(...ranges.map((r) => r.minX)),
    max = Math.min(...ranges.map((r) => r.maxX));
  const actorX = Math.max(min, Math.min(max, source.x - spacing));
  const sprite = view.sprites[view.rival];
  const rivalHeight =
    (290 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const rivalFrame = sprite?.frames[sprite.battleFrame];
  const rivalScale = sprite ? rivalHeight / sprite.bodyHeight : 1;
  const flip = -(sprite?.frameFacing[sprite.battleFrame] ?? 1);
  const left =
    rivalFrame && sprite
      ? (rivalFrame.x - rivalFrame.slotX - sprite.cellWidth / 2) *
        rivalScale *
        flip
      : -70;
  const right = rivalFrame ? left + rivalFrame.width * rivalScale * flip : 70;
  const maxRival =
    (view.viewport?.right ?? Infinity) - Math.max(left, right) - 12;
  const minRival =
    (view.viewport?.left ?? -Infinity) - Math.min(left, right) + 12;
  const rivalEnd = Math.max(
    minRival,
    Math.min(maxRival, Math.max(target.x, actorX + 310)),
  );
  const transition = Math.min(
    clamp(tick / 12),
    clamp((profile.duration - tick) / 12),
  );
  // At the inward edge the actor cannot step back: the rival takes the remaining
  // bounded presentation spacing and returns to captured feet before release.
  const rivalX = target.x + (rivalEnd - target.x) * transition;
  const ensembleHeight = 470;
  const ensembleX = clampFinaleArtX(
    view.viewport,
    sheet.frames.orchestra,
    ensembleHeight,
    1,
    actorX - 100,
  );
  const opacity = Math.min(clamp(tick / 10), clamp((180 - tick) / 14));
  const ground =
    source.y +
    (WORLD.floor - view.state.players[view.state.finale!.owner].y) /
      (177 / 300);
  view.art(
    "orchestra",
    authored(ensembleX),
    atFeet(ensembleX, ground),
    ensembleHeight,
    1,
    opacity,
  );
  let pose = "ready";
  for (const [i, beat] of profile.damageBeats.entries()) {
    const release = beat - DUDAMEL_TRAVEL;
    if (tick >= release - 9 && tick < release) pose = "upbeat";
    if (tick >= release && tick <= beat)
      pose = i === 2 ? "fortissimo" : "downbeat";
  }
  view.art(
    pose,
    authored(actorX),
    atFeet(actorX, source.y),
    dudamelHeight(pose),
  );
  const recoiling = profile.damageBeats.some(
    (beat) => tick > beat && tick < beat + 9,
  );
  view.body(
    view.rival,
    authored(rivalX),
    atFeet(rivalX, target.y),
    290,
    -1,
    recoiling ? "hurt" : "stand",
  );
  const visibleHeight = sprite
    ? (sprite.frames[sprite.battleFrame].height * rivalHeight) /
      sprite.bodyHeight
    : rivalHeight;
  const drop = visibleHeight * 0.52;
  for (const beat of profile.damageBeats) {
    const delta = tick - beat;
    if (delta < -DUDAMEL_TRAVEL || delta > 8) continue;
    const flight = clamp((delta + DUDAMEL_TRAVEL) / DUDAMEL_TRAVEL);
    const radius = 24 + 46 * flight;
    const y = source.y - 215 + (target.y - drop - source.y + 215) * flight;
    const contact =
      rivalX +
      dudamelRivalContact(sprite, rivalHeight, target.y - y, radius + 1.25);
    const start = Math.min(actorX + 85, contact - 90);
    const x = start + (contact - start) * flight;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= delta <= 0 ? 1 : clamp(1 - delta / 8);
    drawDudamelWave(ctx, radius, tick);
    ctx.restore();
  }
  view.damage(115);
  // The generic fixed heading crossed the back-row musicians' faces. Anchor
  // this one above every full bitmap and both fighter crowns instead.
  const orchestraTop =
    ground -
    (sheet.frames.orchestra.anchorY! * ensembleHeight) /
      sheet.frames.orchestra.bodyHeight!;
  const actorTop =
    source.y -
    (sheet.frames[pose].anchorY! * dudamelHeight(pose)) /
      sheet.frames[pose].bodyHeight!;
  view.text(
    "DEFINITIVA",
    Math.max(
      (view.viewport?.left ?? -Infinity) + 90,
      Math.min((view.viewport?.right ?? Infinity) - 90, actorX),
    ),
    Math.max(
      (view.viewport?.top ?? -Infinity) + 30,
      Math.min(orchestraTop, actorTop, target.y - visibleHeight) - 25,
    ),
    25,
    "#ffe5a3",
  );
  return true;
}
