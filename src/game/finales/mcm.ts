import { fighterById } from "../../../shared/content";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { spriteFrameSource, type SpriteAsset } from "../assets";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const MCM_POSES = [
  "truck",
  "empty",
  "mount",
  "dismount",
  "man-a",
  "man-b",
  "woman-a",
  "woman-b",
  "flag",
] as const;
export const MCM_CONTACT_TICK = 96;
export const MCM_BODY_HEIGHTS: Record<string, number> = {
  mount: 518,
  dismount: 463,
  "man-a": 481,
  "man-b": 480,
  "woman-a": 448,
  "woman-b": 465,
};
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
const pixels = new WeakMap<SpriteAsset, ImageData>();
const truckPixels = new WeakMap<HTMLImageElement, ImageData>();

/** First opaque pixel on the actual canonical battle frame at bumper height.
 * This includes frameFacing, slot offsets and the idle body's scale. */
export function mcmRivalContact(
  sprite: SpriteAsset | undefined,
  height: number,
  aboveFeet: number,
  strict = false,
) {
  if (!sprite) return -height * 0.17;
  const frame = sprite.frames[sprite.battleFrame],
    scale = height / sprite.bodyHeight;
  const facing = -sprite.frameFacing[sprite.battleFrame];
  const left = (frame.x - frame.slotX - sprite.cellWidth / 2) * scale;
  let bitmap = pixels.get(sprite);
  if (!bitmap && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const source = spriteFrameSource(sprite, sprite.battleFrame);
    ctx.drawImage(
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
    bitmap = ctx.getImageData(0, 0, frame.width, frame.height);
    pixels.set(sprite, bitmap);
  }
  if (bitmap) {
    const row = Math.round(frame.height - aboveFeet / scale);
    let contact = Infinity;
    for (
      let y = Math.max(0, row - 2);
      y <= Math.min(frame.height - 1, row + 2);
      y++
    )
      for (let x = 0; x < frame.width; x++)
        if (bitmap.data[(y * frame.width + x) * 4 + 3] >= 40)
          contact = Math.min(contact, (left + x * scale) * facing);
    if (Number.isFinite(contact)) return contact;
    if (strict) return NaN;
  }
  return Math.min(left * facing, (left + frame.width * scale) * facing);
}

/** Visible leading edge of the truck at the opponent's leg/torso height. */
export function mcmTruckFront(
  view: FinaleView,
  height: number,
  aboveFeet: number,
  strict = false,
) {
  const sheet = ATTACK_ART.mcm,
    frame = sheet.frames.truck,
    image = view.images[sheet.file];
  let bitmap = truckPixels.get(image);
  if (!bitmap && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
    bitmap = ctx.getImageData(0, 0, frame.width, frame.height);
    truckPixels.set(image, bitmap);
  }
  const scale = height / frame.bodyHeight!;
  if (bitmap) {
    const row = Math.round(frame.anchorY! - aboveFeet / scale);
    let right = -Infinity;
    for (
      let y = Math.max(0, row - 1);
      y <= Math.min(frame.height - 1, row + 1);
      y++
    )
      for (let x = 0; x < frame.width; x++)
        if (bitmap.data[(y * frame.width + x) * 4 + 3] >= 40)
          right = Math.max(right, (x - frame.anchorX) * scale);
    if (Number.isFinite(right)) return right;
    if (strict) return NaN;
  }
  return (1018 * height) / 500;
}

export function mcmChargeProgress(tick: number) {
  return clamp((tick - 54) / (MCM_CONTACT_TICK - 54)) ** 2;
}

export function drawMcmFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "mcm", MCM_POSES)) return false;
  const { tick, ctx } = view,
    sheet = ATTACK_ART.mcm;
  const source = view.point(410, 516),
    target = view.point(656, 516);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 410 + ((x - source.x) * 246) / span;
  const body = (
    id: typeof view.actor,
    x: number,
    feet: number,
    mode: "stand" | "hurt" = "stand",
  ) =>
    view.body(
      id,
      authored(x),
      516 + feet - view.point(authored(x), 516).y,
      300,
      id === view.actor ? 1 : -1,
      mode,
    );
  // Source crown-to-hidden-sole is approximately500px in the complete truck.
  // Every pose uses300/530 local pixels per source pixel, including crouched bodies.
  const actorHeight = (300 * 500) / 530,
    unit = actorHeight / 500;
  const rivalHeight =
    (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const sprite = view.sprites[view.rival];
  const actualRivalHeight = sprite
    ? (rivalHeight * sprite.frames[sprite.battleFrame].height) /
      sprite.bodyHeight
    : rivalHeight;
  const top = Math.max(source.y - 370 * unit, target.y - actualRivalHeight + 2),
    bottom = Math.min(source.y - 2, target.y - 2);
  let contactY = clamp(target.y - 160 * unit, top, bottom),
    bumperX = NaN,
    contact = NaN;
  // Search a shared opaque scanline, including the front tire for an aerial
  // capture above a short rival. A bounding rectangle is not a contact surface.
  const preferred = contactY;
  outer: for (
    let distance = 0;
    distance <= Math.max(0, bottom - top);
    distance++
  ) {
    for (const y of distance
      ? [preferred - distance, preferred + distance]
      : [preferred]) {
      if (y < top || y > bottom) continue;
      const front = mcmTruckFront(view, actorHeight, source.y - y, true);
      const rival = mcmRivalContact(sprite, rivalHeight, target.y - y, true);
      if (Number.isFinite(front) && Number.isFinite(rival)) {
        contactY = y;
        bumperX = front;
        contact = rival;
        break outer;
      }
    }
  }
  if (!Number.isFinite(bumperX) || !Number.isFinite(contact)) return false;
  const bumperAbove = target.y - contactY;
  const ranges = ["truck", "empty"].map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], actorHeight),
  );
  const minX = Math.max(...ranges.map((r) => r.minX));
  const maxX = Math.min(
    ...ranges.map((r) => r.maxX),
    (view.viewport?.right ?? Infinity) - 155 - bumperX + contact,
  );
  const endX = clamp(
    target.x + contact - bumperX,
    Math.min(maxX, minX + 180),
    maxX,
  );
  const startX = Math.max(minX, endX - 180);
  // The caravan needs a wider presentation than two bodies. These bounded
  // horizontal offsets enter/leave during preparation/recovery; no physics or
  // camera state changes. All feet use the two actual captured platform heights.
  const rivalEnd = endX + bumperX - contact;
  const settle = Math.min(clamp(tick / 24), clamp((180 - tick) / 16));
  const rivalX = lerp(target.x, rivalEnd, settle);
  const charge = mcmChargeProgress(tick);
  const exit = clamp((tick - 132) / 24);
  const truckX =
    tick < 132 ? lerp(startX, endX, charge) : lerp(endX, startX, exit);
  // The tires and accompanying feet retain the origin platform height.
  // A rival on a higher ledge meets the visible hood/grille instead of causing
  // the entire convoy to float up to their feet.
  const truckFeet = source.y;
  const occupied = tick >= 36 && tick < 148;
  const flagFrame = sheet.frames.flag;
  const flagUp = flagFrame.anchorY! / flagFrame.bodyHeight!;
  const flagHeight = Math.min(
    942 * 0.23 * unit,
    Math.max(
      30,
      (source.y - 678 * unit - (view.viewport?.top ?? -Infinity) - 12) / flagUp,
    ),
  );
  const alpha = Math.min(clamp((tick - 4) / 12), clamp((176 - tick) / 12));
  const recoil =
    tick > 96 && tick < 132
      ? Math.sin(clamp((tick - 96) / 36) * Math.PI) * 28
      : 0;
  body(
    view.rival,
    rivalX + recoil,
    target.y,
    tick >= 100 && tick < 148 ? "hurt" : "stand",
  );
  if (alpha > 0) {
    const gait =
      view.motion && tick >= 54 && tick < 132 ? Math.floor(tick / 7) % 2 : 0;
    // Both companions run along the visible side; their faces remain clear.
    const far = gait ? "woman-b" : "woman-a";
    if (occupied)
      drawAttackArt(
        ctx,
        view.images,
        "mcm",
        "flag",
        truckX + 190 * unit,
        truckFeet - 678 * unit,
        flagHeight,
        -1,
        alpha,
      );
    drawAttackArt(
      ctx,
      view.images,
      "mcm",
      occupied ? "truck" : "empty",
      truckX,
      truckFeet,
      actorHeight,
      1,
      alpha,
    );
    const walkers =
      alpha * Math.min(clamp((tick - 30) / 6), clamp((154 - tick) / 6));
    drawAttackArt(
      ctx,
      view.images,
      "mcm",
      far,
      truckX - 115,
      truckFeet + 10,
      MCM_BODY_HEIGHTS[far] * unit,
      tick >= 132 ? -1 : 1,
      walkers,
    );
    const near = gait ? "man-b" : "man-a";
    drawAttackArt(
      ctx,
      view.images,
      "mcm",
      near,
      truckX + 190,
      truckFeet + 10,
      MCM_BODY_HEIGHTS[near] * unit,
      tick >= 132 ? -1 : 1,
      walkers,
    );
  }
  if (tick < 36) {
    if (tick < 16)
      body(view.actor, lerp(source.x, startX - 105, tick / 16), source.y);
    else {
      const up = clamp((tick - 16) / 20);
      drawAttackArt(
        ctx,
        view.images,
        "mcm",
        "mount",
        lerp(startX - 105, startX, up),
        source.y - 190 * up - 50 * Math.sin(up * Math.PI),
        MCM_BODY_HEIGHTS.mount * unit,
      );
    }
  } else if (tick >= 148) {
    if (tick < 168) {
      const down = clamp((tick - 148) / 20);
      drawAttackArt(
        ctx,
        view.images,
        "mcm",
        "dismount",
        lerp(truckX, source.x, down),
        lerp(truckFeet - 190, source.y, down) - 35 * Math.sin(down * Math.PI),
        MCM_BODY_HEIGHTS.dismount * unit,
      );
    } else body(view.actor, source.x, source.y);
  }
  if (tick >= 96 && tick < 106) {
    const x = endX + bumperX,
      y = target.y - bumperAbove;
    ctx.save();
    ctx.globalAlpha *= (106 - tick) / 10;
    ctx.strokeStyle = "#ffe4a2";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.lineTo(x + Math.cos(a) * 33, y + Math.sin(a) * 33);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (view.pulse) {
    ctx.save();
    ctx.globalAlpha *= view.pulse;
    view.text(
      `−${Math.round(view.state.finale!.damage)} VIDA`,
      rivalX,
      target.y - rivalHeight - 42,
      29,
      "#ffb4a2",
    );
    ctx.restore();
  }
  return true;
}
