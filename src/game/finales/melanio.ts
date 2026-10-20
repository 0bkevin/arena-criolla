import { fighterById } from "../../../shared/content";
import type { PlayerState, Projectile } from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { spriteFrameSource, type SpriteAsset } from "../assets";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const MELANIO_FINAL_POSES = [
  "record",
  "windup",
  "strike-high",
  "strike-low",
  "recover",
] as const;
export const MELANIO_SPECIAL_POSES = [
  "signal-windup",
  "signal-release",
  "signal",
] as const;
export const MELANIO_POSES = [...MELANIO_FINAL_POSES, ...MELANIO_SPECIAL_POSES];
export const MELANIO_FLASH_TICK = 66;
export const MELANIO_CONTACT_TICK = 114;
// Effective crown-to-sole source dimensions, calibrated to the same 424px body.
// Separate generations receive a uniform whole-figure scale, never a head patch.
export const MELANIO_BODY_HEIGHTS: Record<string, number> = {
  record: 424,
  windup: 424,
  "strike-high": 958 * 0.44,
  "strike-low": 334,
  recover: 433,
  "signal-windup": 667 * 0.65,
  "signal-release": 1142 * 0.378,
};
export const melanioPoseHeight = (pose: string, height: number) =>
  (height * MELANIO_BODY_HEIGHTS[pose]) / 424;
const unit = (n: number) => Math.max(0, Math.min(1, n));
const between = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
const smooth = (n: number) => {
  const t = unit(n);
  return t * t * (3 - 2 * t);
};
// The only painted phone is part of each whole-body image. These are its exposed
// leading edge/upper lens, measured relative to the packed body anchor and sole.
export const MELANIO_PHONE: Record<string, { x: number; y: number }> = {
  record: { x: 84, y: -263 },
  windup: { x: -31, y: -266 },
  "strike-high": { x: 152, y: -239 },
  "strike-low": { x: 138, y: -156 },
  recover: { x: -10, y: -160 },
};
export function melanioApproach(tick: number, airborne = false) {
  return tick <= MELANIO_CONTACT_TICK
    ? smooth((tick - 90) / 24)
    : 1 - smooth((tick - (airborne ? 114 : 128)) / (airborne ? 54 : 40));
}

export function melanioSpecialPose(tick: number) {
  return tick < 21 ? "signal-windup" : tick < 29 ? "signal-release" : undefined;
}
export function drawMelanioSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "melanio" ||
    p.attack !== "special" ||
    p.stun ||
    !images ||
    !hasAttackArt(images, "melanio", MELANIO_SPECIAL_POSES)
  )
    return false;
  const pose = melanioSpecialPose(p.attackTick);
  if (!pose) return false;
  return drawAttackArt(
    ctx,
    images,
    "melanio",
    pose,
    p.x,
    p.y,
    melanioPoseHeight(pose, height),
    p.facing,
  );
}

/** Painted gathering light; no stale square/arc effect remains after release. */
export function drawMelanioSignalCharge(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "melanio" ||
    !images ||
    !hasAttackArt(images, "melanio", MELANIO_SPECIAL_POSES)
  )
    return false;
  if (!p.stun && p.attack === "special" && p.attackTick < 21) {
    const amount = unit(p.attackTick / 21),
      h = ((7 + amount * 10) * height) / 177;
    const frame = ATTACK_ART.melanio.frames.signal;
    ctx.save();
    ctx.shadowBlur = 0;
    drawAttackArt(
      ctx,
      images,
      "melanio",
      "signal",
      p.x + (p.facing * 20 * height) / 177,
      p.y -
        (98 * height) / 177 +
        ((frame.anchorY! - frame.height / 2) * h) / frame.bodyHeight!,
      h,
      p.facing,
      0.35 + amount * 0.5,
    );
    ctx.restore();
  }
  return true;
}

/** The pulse is centred on the real hitbox and follows velocity on return/reflection. */
export function drawMelanioSignal(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (
    shot.kind !== "signal" ||
    !images ||
    !hasAttackArt(images, "melanio", MELANIO_SPECIAL_POSES)
  )
    return false;
  const frame = ATTACK_ART.melanio.frames.signal;
  const h = 34;
  ctx.save();
  ctx.shadowBlur = 0;
  // A single warm halo distinguishes the return without tinting source artwork.
  if (!!shot.returnAfter && (shot.age ?? 0) >= shot.returnAfter) {
    ctx.strokeStyle = "#ffd788";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const result = drawAttackArt(
    ctx,
    images,
    "melanio",
    "signal",
    0,
    ((frame.anchorY! - frame.height / 2) * h) / frame.bodyHeight!,
    h,
  );
  ctx.restore();
  return result;
}

const masks = new WeakMap<
  SpriteAsset,
  { data: Uint8ClampedArray; width: number; height: number }
>();
/** Measure a visible canonical row, without altering the rival texture or identity. */
export function melanioRivalContact(
  sprite: SpriteAsset | undefined,
  height: number,
  drop: number,
) {
  if (!sprite) return { x: -20, y: -drop };
  const frame = sprite.frames[sprite.battleFrame],
    scale = height / sprite.bodyHeight;
  const flip = -sprite.frameFacing[sprite.battleFrame];
  const row = Math.round(
    between(frame.height - drop / scale, 1, frame.height - 2),
  );
  let mask = masks.get(sprite);
  if (!mask && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      const source = spriteFrameSource(sprite, sprite.battleFrame);
      context.drawImage(
        source.image,
        source.x,
        source.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height,
      );
      mask = {
        data: context.getImageData(0, 0, frame.width, frame.height).data,
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
    for (let x = 0; x <= frame.width; x++) {
      const opaque =
        x < frame.width && mask.data[(row * frame.width + x) * 4 + 3] >= 100;
      if (opaque && run < 0) run = x;
      if (!opaque && run >= 0) {
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
  // Six source pixels inside the first solid torso/face surface, so the exposed
  // phone edge visibly overlaps real opaque pixels at the single damage tick.
  const pixel = flip < 0 ? Math.max(start, end - 6) : Math.min(end, start + 6);
  return {
    x: (frame.x - frame.slotX - sprite.cellWidth / 2 + pixel) * scale * flip,
    y: -drop,
  };
}

export function drawMelanioFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "melanio", MELANIO_FINAL_POSES)) return false;
  const { ctx, tick, profile } = view;
  const source = view.point(306, 514),
    target = view.point(782, 514);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 306 + ((x - source.x) * 476) / span;
  const feetAt = (x: number, y: number) =>
    514 + y - view.point(authored(x), 514).y;
  const enter = Math.min(smooth(tick / 12), smooth((180 - tick) / 12));
  const sheet = ATTACK_ART.melanio;
  const rivalHeight =
    (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const sprite = view.sprites[view.rival];
  const visibleHeight = sprite
    ? (rivalHeight * sprite.frames[sprite.battleFrame].height) /
      sprite.bodyHeight
    : rivalHeight;
  const strike =
    visibleHeight >= -MELANIO_PHONE["strike-high"].y + 35
      ? "strike-high"
      : "strike-low";
  const phone = MELANIO_PHONE[strike];
  const contact = melanioRivalContact(sprite, rivalHeight, -phone.y);
  if (!Number.isFinite(contact.x)) return false;
  const actorRanges = MELANIO_FINAL_POSES.map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], melanioPoseHeight(p, 300)),
  );
  const actorMin = Math.max(...actorRanges.map((r) => r.minX)),
    actorMax = Math.min(...actorRanges.map((r) => r.maxX));
  const rivalPad = sprite
    ? ((sprite.frames[sprite.battleFrame].width * rivalHeight) /
        sprite.bodyHeight) *
      0.65
    : 110;
  const rivalMin = Math.max(
    (view.viewport?.left ?? -Infinity) + rivalPad + 8,
    actorMin + phone.x - contact.x,
  );
  const rivalMax = Math.min(
    (view.viewport?.right ?? Infinity) - rivalPad - 8,
    actorMax + phone.x - contact.x,
  );
  let rivalEnd = between(target.x, rivalMin, rivalMax);
  const actorEnd = between(
    Math.min(source.x, rivalEnd - 335),
    actorMin,
    actorMax,
  );
  rivalEnd = between(Math.max(rivalEnd, actorEnd + 335), rivalMin, rivalMax);
  const baseX = source.x + (actorEnd - source.x) * enter;
  const rivalX = target.x + (rivalEnd - target.x) * enter;
  const reach = melanioApproach(tick, Math.abs(target.y - source.y) > 12);
  const hitX = rivalX + contact.x,
    hitY = target.y + contact.y;
  const actorX = baseX + (hitX - phone.x - baseX) * reach;
  // Whole-body step/hop reaches the rival's platform and returns before release.
  // Feet at record/flash/recovery stay at source.y; physics and camera stay frozen.
  const arc =
    Math.abs(target.y - source.y) > 12 && reach > 0 && reach < 1
      ? Math.sin(Math.PI * reach) * 38
      : 0;
  const actorFeet = source.y + (target.y - source.y) * reach - arc;
  const pose =
    tick < 12
      ? "recover"
      : tick < 78
        ? "record"
        : tick < 104
          ? "windup"
          : tick < 132
            ? strike
            : "recover";
  if (Math.abs(target.y - source.y) > 12 && reach > 0) {
    ctx.save();
    ctx.globalAlpha *= 0.22;
    ctx.fillStyle = "#080b13";
    ctx.beginPath();
    ctx.ellipse(baseX, source.y + 3, 45 - reach * 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  view.body(
    view.rival,
    authored(rivalX),
    feetAt(rivalX, target.y),
    300,
    -1,
    tick >= 118 && tick < 154 ? "hurt" : "stand",
  );
  drawAttackArt(
    ctx,
    view.images,
    "melanio",
    pose,
    actorX,
    actorFeet,
    melanioPoseHeight(pose, 300),
  );
  const camera = {
    x: actorX + MELANIO_PHONE.record.x,
    y: actorFeet + MELANIO_PHONE.record.y,
  };
  const faceY = target.y - visibleHeight * 0.84;
  if (tick >= 18 && tick < 66) {
    const half = Math.min(54, visibleHeight * 0.17),
      cy = faceY + 18;
    ctx.save();
    ctx.strokeStyle = "#e9eee9";
    ctx.lineWidth = 2;
    ctx.globalAlpha *= 0.8;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const x = rivalX + sx * half,
          y = cy + sy * half;
        ctx.beginPath();
        ctx.moveTo(x - sx * 14, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y - sy * 14);
        ctx.stroke();
      }
    ctx.fillStyle = "#ff625a";
    ctx.beginPath();
    ctx.arc(camera.x + 13, camera.y - 13, 4, 0, Math.PI * 2);
    ctx.fill();
    view.text("REC", camera.x + 33, camera.y - 8, 13, "#ff625a");
    ctx.restore();
  }
  if (tick >= 66 && tick < 76) {
    const fade = 1 - (tick - 66) / 10;
    ctx.save();
    ctx.globalAlpha *= fade * (view.motion ? 0.24 : 0.07);
    ctx.fillStyle = "#fff7d0";
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(rivalX + 44, faceY - 46);
    ctx.lineTo(rivalX + 44, faceY + 53);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha *= 0.9;
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, view.motion ? 25 : 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (tick >= 66 && tick < 114) {
    ctx.save();
    ctx.fillStyle = "#ffe7a3";
    for (let i = 0; i < 3; i++) {
      const angle =
        (i * Math.PI * 2) / 3 + (view.motion ? (tick - 66) * 0.05 : 0);
      const x = rivalX + Math.cos(angle) * 30,
        y = target.y - visibleHeight - 15 + Math.sin(angle) * 7;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 2, y - 1);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x + 2, y + 2);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 2, y + 2);
      ctx.lineTo(x - 6, y);
      ctx.lineTo(x - 2, y - 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if (tick >= 114 && tick < 124) {
    ctx.save();
    ctx.globalAlpha *= (124 - tick) / 10;
    ctx.strokeStyle = "#fff4dc";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(hitX + Math.cos(a) * 9, hitY + Math.sin(a) * 9);
      ctx.lineTo(
        hitX + Math.cos(a) * (view.motion ? 26 : 15),
        hitY + Math.sin(a) * (view.motion ? 26 : 15),
      );
      ctx.stroke();
    }
    ctx.restore();
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
      Math.max(
        (view.viewport?.top ?? -Infinity) + 30,
        target.y - visibleHeight - 34,
      ),
      27,
      "#ffb4a2",
    );
    ctx.restore();
  }
  return true;
}
