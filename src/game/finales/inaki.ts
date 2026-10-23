import { SUPER_CHARGE_TICKS } from "../../../shared/content";
import type { PlayerState, Projectile } from "../../../shared/engine";
import { FINALE_CAPTURE_TICK } from "../../../shared/finales";
import { INAKI_FINALE } from "../../../shared/inaki";
import { TECHNIQUES } from "../../../shared/techniques";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";

type Images = Record<string, HTMLImageElement>;
export const INAKI_BODY_POSES = [
  "special-ready",
  "special-release",
  "charge-start",
  "charge-cup",
  "blast-release",
  "blast-sustain",
  "recover",
  "victory",
] as const;
export const INAKI_PROP_POSES = [
  "note-flat",
  "note-curl",
  "note-tilt",
  "stack-small",
  "bundle",
  "bundle-burst",
] as const;
const unit = (n: number) => Math.max(0, Math.min(1, n));

/** Native anatomy stays at one scale as the knees bend into the blast stance. */
export function inakiPoseHeight(pose: string, height: number) {
  const frames = ATTACK_ART.inaki?.frames;
  const reference = frames?.["special-ready"],
    frame = frames?.[pose];
  return reference?.bodyHeight && frame?.bodyHeight
    ? (height * frame.bodyHeight) / reference.bodyHeight
    : height;
}

export function inakiFinalePose(tick: number, reduced = false) {
  if (tick < INAKI_FINALE.cues[0]) return "charge-cup";
  if (tick >= 54) return "recover";
  return reduced || tick % 6 >= 3 ? "blast-sustain" : "blast-release";
}

/** Positions of the cupped hands in standard 177px body coordinates. */
export function inakiHands(pose: string, player: PlayerState, height = 177) {
  const [dx, dy] =
    pose === "charge-start"
      ? [25, 91]
      : pose === "charge-cup"
        ? [43, 99]
        : pose === "special-ready"
          ? [-27, 147]
          : pose === "special-release"
            ? [72, 131]
            : [65, 126];
  return {
    x: player.x + (player.facing * dx * height) / 177,
    y: player.y - (dy * height) / 177,
  };
}

function centered(
  ctx: CanvasRenderingContext2D,
  images: Images,
  pose: string,
  x: number,
  y: number,
  height: number,
  facing = 1,
  alpha = 1,
) {
  const frame = ATTACK_ART.inaki?.frames[pose];
  if (!frame) return false;
  const scale = height / (frame.bodyHeight ?? frame.height);
  return drawAttackArt(
    ctx,
    images,
    "inaki",
    pose,
    x + facing * (frame.anchorX - frame.width / 2) * scale,
    y + ((frame.anchorY ?? frame.height) - frame.height / 2) * scale,
    height,
    facing,
    alpha,
  );
}

/** Individual notes converge before the complete bundle appears between the palms. */
export function drawInakiFormation(
  ctx: CanvasRenderingContext2D,
  images: Images,
  player: PlayerState,
  progress: number,
  pose: string,
  height = 177,
  reduced = false,
) {
  if (!hasAttackArt(images, "inaki", INAKI_PROP_POSES)) return false;
  const p = unit(progress),
    hand = inakiHands(pose, player, height),
    scale = height / 177;
  const count = Math.min(10, Math.ceil(p * 10));
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963229728653;
    const gather = unit((p - i * 0.035) / (1 - i * 0.035));
    const distance = (1 - gather) * (48 + i * 3) * scale;
    const x = hand.x + player.facing * (Math.cos(angle) * distance);
    const y =
      hand.y + Math.sin(angle) * distance * 0.7 - (1 - gather) * 16 * scale;
    ctx.save();
    ctx.translate(x, y);
    if (!reduced)
      ctx.rotate(player.facing * Math.sin(angle + p * 3) * (1 - gather) * 0.5);
    centered(
      ctx,
      images,
      INAKI_PROP_POSES[i % 3],
      0,
      0,
      (13 + gather * 3) * scale,
      player.facing,
      Math.min(1, gather * 5 + 0.2) * (1 - unit((p - 0.85) / 0.15)),
    );
    ctx.restore();
  }
  if (p >= 0.3)
    centered(
      ctx,
      images,
      p < 0.7 ? "stack-small" : "bundle",
      hand.x,
      hand.y,
      (13 + p * 17) * scale,
      player.facing,
      unit((p - 0.3) * 6),
    );
  return true;
}

/** Charge, special and field preparation replace the same real fighter's body. */
export function drawInakiAction(
  ctx: CanvasRenderingContext2D,
  images: Images,
  player: PlayerState,
  height: number,
  reduced = false,
) {
  if (player.config.fighter !== "inaki" || player.stun) return false;
  let pose: string, progress: number | undefined;
  if (player.superChargeTicks > 0) {
    progress = unit(player.superChargeTicks / SUPER_CHARGE_TICKS);
    pose = progress < 0.42 ? "charge-start" : "charge-cup";
  } else if (
    player.attack === "super" &&
    player.attackTick < FINALE_CAPTURE_TICK
  ) {
    progress = 1;
    pose = "charge-cup";
  } else if (player.attack === "special") {
    const release = player.attackTick - TECHNIQUES.banknotes.startup;
    pose =
      release < 0
        ? "special-ready"
        : release < 13
          ? "special-release"
          : "recover";
  } else return false;
  if (!hasAttackArt(images, "inaki", [pose])) return false;
  const painted = drawAttackArt(
    ctx,
    images,
    "inaki",
    pose,
    player.x,
    player.y,
    inakiPoseHeight(pose, height),
    player.facing,
  );
  if (progress !== undefined)
    drawInakiFormation(ctx, images, player, progress, pose, height, reduced);
  else if (pose === "special-ready") {
    const hand = inakiHands(pose, player, height);
    centered(
      ctx,
      images,
      "stack-small",
      hand.x,
      hand.y,
      (16 * height) / 177,
      player.facing,
    );
  }
  return painted;
}

export function drawInakiFinaleHands(
  ctx: CanvasRenderingContext2D,
  images: Images,
  player: PlayerState,
  tick: number,
  height: number,
  reduced = false,
) {
  if (tick < INAKI_FINALE.cues[0])
    drawInakiFormation(ctx, images, player, 1, "charge-cup", height, reduced);
  else if (tick <= INAKI_FINALE.cues.at(-1)!) {
    const hand = inakiHands(inakiFinalePose(tick, reduced), player, height);
    centered(
      ctx,
      images,
      "bundle",
      hand.x,
      hand.y,
      (26 * height) / 177,
      player.facing,
    );
  }
}

/** The banknote head stays centered on the physical hit circle after a reflection. */
export function drawInakiProjectile(
  ctx: CanvasRenderingContext2D,
  images: Images,
  shot: Projectile,
  reduced = false,
) {
  if (shot.kind !== "banknotes") return false;
  const pose = shot.impact === "super" ? "bundle-burst" : "bundle";
  const height = (shot.radius ?? 15) * 2;
  ctx.save();
  ctx.shadowBlur = 0;
  if (
    shot.impact === "super" &&
    hasAttackArt(images, "inaki", INAKI_PROP_POSES)
  )
    for (let i = 0; i < 3; i++)
      centered(
        ctx,
        images,
        INAKI_PROP_POSES[i],
        -22 - i * 15,
        reduced ? (i - 1) * 4 : Math.sin((shot.age ?? 0) / 4 + i) * 5,
        16 - i * 2,
        1,
        0.75 - i * 0.16,
      );
  if (!centered(ctx, images, pose, 0, 0, height)) {
    // The physical bundle remains visible while an optional texture retries.
    ctx.fillStyle = "#d9e5b4";
    ctx.strokeStyle = "#42583b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-height * 0.7, -height / 2, height * 1.4, height, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d7bc89";
    ctx.fillRect(-height * 0.12, -height / 2, height * 0.24, height);
  }
  ctx.restore();
  return true;
}
