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

export const DAYANA_SPECIAL_POSES = [
  "windup",
  "contact",
  "recover",
  "ball",
] as const;
export const DAYANA_POSES = [
  ...DAYANA_SPECIAL_POSES,
  "a-windup",
  "a-contact",
  "a-recover",
  "b-windup",
  "b-contact",
  "b-recover",
] as const;
export const DAYANA_LAUNCH_TICK = 66;
export const DAYANA_CONTACT_TICK = 100;
// Whole-figure source scaling: do not normalize bent poses by their bbox height.
export const DAYANA_BODY_HEIGHTS: Record<string, number> = {
  windup: 516,
  contact: 1309 * 0.4,
  recover: 487 * 1.12,
  "a-windup": 459 * 1.1,
  "a-contact": 459 * 1.1,
  "a-recover": 458 * 1.1,
  "b-windup": 450 * 1.1,
  "b-contact": 452 * 1.1,
  "b-recover": 452 * 1.1,
};
export const dayanaPoseHeight = (pose: string, height: number) =>
  (height * DAYANA_BODY_HEIGHTS[pose]) / 516;
const unit = (n: number) => Math.max(0, Math.min(1, n));
const between = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
const smooth = (n: number) => {
  const t = unit(n);
  return t * t * (3 - 2 * t);
};
export function dayanaSpecialPose(tick: number) {
  return tick < 18
    ? "windup"
    : tick < 29
      ? "contact"
      : tick < 42
        ? "recover"
        : undefined;
}

/** The ball's centre is the engine centre, independent of transparent sheet padding. */
export function drawDayanaBall(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  diameter: number,
  angle = 0,
  alpha = 1,
) {
  if (!hasAttackArt(images, "dayana", ["ball"])) return false;
  const f = ATTACK_ART.dayana.frames.ball;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 0;
  const result = drawAttackArt(
    ctx,
    images,
    "dayana",
    "ball",
    0,
    ((f.anchorY! - f.height / 2) * diameter) / f.bodyHeight!,
    diameter,
    1,
    alpha,
  );
  ctx.restore();
  return result;
}
export function drawDayanaBallProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "corona") return false;
  if (
    drawDayanaBall(
      ctx,
      images,
      0,
      0,
      (shot.radius ?? 13) * 2,
      (shot.age ?? 0) * 0.14,
    )
  )
    return true;
  // Optional sheet failure still exposes the physical round ball, never a crown.
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, shot.radius ?? 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const x = Math.cos(a) * 5,
      y = Math.sin(a) * 5;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return true;
}
export function drawDayanaSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "dayana" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "dayana", DAYANA_SPECIAL_POSES)
  )
    return false;
  const pose = dayanaSpecialPose(p.attackTick);
  if (!pose) return false;
  drawAttackArt(
    ctx,
    images,
    "dayana",
    pose,
    p.x,
    p.y,
    dayanaPoseHeight(pose, height),
    p.facing,
  );
  // Exactly one staged ball before emission. The engine takes over at startup21.
  if (p.attackTick < TECHNIQUES.corona.startup) {
    const shot = TECHNIQUES.corona.projectile!;
    drawDayanaBall(
      ctx,
      images,
      p.x + p.facing * shot.offsetX!,
      p.y - shot.offsetY!,
      26,
    );
  }
  return true;
}
const masks = new WeakMap<
  SpriteAsset,
  { data: Uint8ClampedArray; width: number; height: number }
>();
/** Canonical opaque surface at a chosen body row, keeping rival identity intact. */
function surface(
  sprite: SpriteAsset | undefined,
  height: number,
  drop: number,
) {
  if (!sprite) return { x: -22, y: -drop };
  const frame = sprite.frames[sprite.battleFrame],
    scale = height / sprite.bodyHeight;
  let mask = masks.get(sprite);
  if (!mask && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    if (c) {
      const s = spriteFrameSource(sprite, sprite.battleFrame);
      c.drawImage(
        s.image,
        s.x,
        s.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height,
      );
      mask = {
        data: c.getImageData(0, 0, frame.width, frame.height).data,
        width: frame.width,
        height: frame.height,
      };
      masks.set(sprite, mask);
    }
  }
  let start = frame.width * 0.35,
    end = frame.width * 0.65;
  if (mask) {
    let run = -1,
      best = 0;
    const y = Math.round(
      between(frame.height - drop / scale, 1, frame.height - 2),
    );
    for (let x = 0; x <= frame.width; x++) {
      const solid =
        x < frame.width && mask.data[(y * frame.width + x) * 4 + 3] >= 100;
      if (solid && run < 0) run = x;
      if (!solid && run >= 0) {
        if (x - run > best) {
          best = x - run;
          start = run;
          end = x - 1;
        }
        run = -1;
      }
    }
    if (!best) return { x: NaN, y: -drop };
  }
  const flip = -sprite.frameFacing[sprite.battleFrame],
    pixel = flip < 0 ? end - 4 : start + 4;
  return {
    x: (frame.x - frame.slotX - sprite.cellWidth / 2 + pixel) * scale * flip,
    y: -drop,
  };
}

export function drawDayanaFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "dayana", DAYANA_POSES)) return false;
  const { ctx, tick } = view,
    source = view.point(306, 514),
    target = view.point(782, 514);
  const span = Math.max(1, target.x - source.x),
    authored = (x: number) => 306 + ((x - source.x) * 476) / span;
  const feetAt = (x: number, y: number) =>
    514 + y - view.point(authored(x), 514).y;
  const enter = Math.min(smooth(tick / 12), smooth((180 - tick) / 12));
  const sheet = ATTACK_ART.dayana,
    sprite = view.sprites[view.rival];
  const rivalHeight =
    (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const visible = sprite
    ? (rivalHeight * sprite.frames[sprite.battleFrame].height) /
      sprite.bodyHeight
    : rivalHeight;
  const contacts = [0.32, 0.49, 0.66].map((k) =>
    surface(sprite, rivalHeight, visible * k),
  );
  if (contacts.some((c) => !Number.isFinite(c.x))) return false;
  const roster = [
    { prefix: "b-", offset: -290, feet: -12, launchX: 108 },
    { prefix: "a-", offset: -145, feet: -6, launchX: 95 },
    { prefix: "", offset: 0, feet: 0, launchX: (48 * 300) / 177 },
  ];
  const ranges = roster.flatMap((a) =>
    ["windup", "contact", "recover"].map((p) => {
      const pose = a.prefix + p,
        r = finaleArtXRange(
          view.viewport,
          sheet.frames[pose],
          dayanaPoseHeight(pose, 300),
        );
      return { minX: r.minX - a.offset, maxX: r.maxX - a.offset };
    }),
  );
  const minX = Math.max(...ranges.map((r) => r.minX)),
    maxX = Math.min(...ranges.map((r) => r.maxX));
  const rivalPad = sprite
    ? ((sprite.frames[sprite.battleFrame].width * rivalHeight) /
        sprite.bodyHeight) *
      0.65
    : 110;
  const right = (view.viewport?.right ?? Infinity) - rivalPad - 8,
    left = (view.viewport?.left ?? -Infinity) + rivalPad + 8;
  const endX = between(
    Math.min(source.x, target.x - 320),
    minX,
    Math.min(maxX, right - 320),
  );
  const rivalEnd = between(Math.max(target.x, endX + 320), left, right);
  const ownRanges = DAYANA_SPECIAL_POSES.filter((p) => p !== "ball").map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], dayanaPoseHeight(p, 300)),
  );
  const actorX = between(
      source.x + (endX - source.x) * enter,
      Math.max(...ownRanges.map((r) => r.minX)),
      Math.min(...ownRanges.map((r) => r.maxX)),
    ),
    rivalX = target.x + (rivalEnd - target.x) * enter;
  const teamGround =
    source.y +
    (WORLD.floor - view.state.players[view.state.finale!.owner].y) /
      (177 / 300);
  const feetFor = (a: { prefix: string; feet: number }) =>
    (a.prefix ? teamGround : source.y) + a.feet;
  const phase =
    tick < 42
      ? "recover"
      : tick < 65
        ? "windup"
        : tick < 82
          ? "contact"
          : "recover";
  view.body(
    view.rival,
    authored(rivalX),
    feetAt(rivalX, target.y),
    300,
    -1,
    tick > 100 && tick < 124 ? "hurt" : "stand",
  );
  const teamAlpha = Math.min(
    smooth((tick - 12) / 14),
    smooth((168 - tick) / 18),
  );
  for (const a of roster) {
    const pose = a.prefix + phase;
    drawAttackArt(
      ctx,
      view.images,
      "dayana",
      pose,
      actorX + a.offset,
      feetFor(a),
      dayanaPoseHeight(pose, 300),
      1,
      a.prefix ? teamAlpha : 1,
    );
  }
  if (tick >= 42 && tick <= 110) {
    for (const [index, a] of roster.entries()) {
      const start = {
        x: actorX + a.offset + a.launchX,
        y: feetFor(a) - (a.prefix ? 22 : (16 * 300) / 177),
      };
      const contact = contacts[index],
        end = { x: rivalX + contact.x - 8, y: target.y + contact.y };
      const flight = unit((tick - 66) / 34),
        after = unit((tick - 100) / 10),
        alpha = (a.prefix ? teamAlpha : 1) * (1 - after);
      const x = start.x + (end.x - start.x) * flight,
        y =
          start.y +
          (end.y - start.y) * flight -
          Math.sin(Math.PI * flight) *
            (view.motion ? 180 + index * 18 : 130 + index * 18);
      drawDayanaBall(ctx, view.images, x, y, 44, (tick - 42) * 0.12, alpha);
      if (tick >= 100 && tick < 110) {
        ctx.save();
        ctx.globalAlpha *= 1 - after;
        ctx.strokeStyle = "#fff2c8";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(
            end.x + Math.cos(angle) * 24,
            end.y + Math.sin(angle) * 24,
          );
          ctx.lineTo(
            end.x + Math.cos(angle) * 34,
            end.y + Math.sin(angle) * 34,
          );
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  if (view.pulse) {
    ctx.save();
    ctx.globalAlpha *= view.pulse;
    view.text(
      `−${Math.round(view.state.finale!.damage)} VIDA`,
      between(
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
  return true;
}
