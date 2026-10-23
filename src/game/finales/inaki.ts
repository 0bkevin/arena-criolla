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
  "cash-cloud-small",
  "cash-orb",
  "cash-orb-release",
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
  if (tick > INAKI_FINALE.cues.at(-1)!) return "recover";
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

function tumble(
  ctx: CanvasRenderingContext2D,
  images: Images,
  pose: string,
  x: number,
  y: number,
  height: number,
  facing: number,
  angle: number,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * facing);
  const painted = centered(ctx, images, pose, 0, 0, height, facing, alpha);
  ctx.restore();
  return painted;
}

/** Loose, curled notes gather into an irregular paper ball between the palms. */
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
  const count = Math.min(12, Math.ceil(p * 12));
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963229728653 + (reduced ? 0 : p * 2.7);
    const gather = unit((p - i * 0.035) / (1 - i * 0.035));
    const distance =
      ((1 - gather) * (48 + i * 3) + gather * (6 + (i % 4) * 2)) * scale;
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
      Math.min(1, gather * 5 + 0.2) * (1 - unit((p - 0.8) / 0.2) * 0.55),
    );
    ctx.restore();
  }
  if (p >= 0.3)
    tumble(
      ctx,
      images,
      p < 0.65 ? "cash-cloud-small" : "cash-orb",
      hand.x,
      hand.y,
      (12 + p * 26) * scale,
      player.facing,
      reduced ? 0 : Math.sin(p * 7) * 0.16,
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
  // Once fired, the money is drawn only at its physical projectile position.
  if (tick < INAKI_FINALE.cues[0])
    drawInakiFormation(ctx, images, player, 1, "charge-cup", height, reduced);
}

/** The tumbling paper ball stays centered on its physical circle after a reflection. */
export function drawInakiProjectile(
  ctx: CanvasRenderingContext2D,
  images: Images,
  shot: Projectile,
  reduced = false,
) {
  if (shot.kind !== "banknotes") return false;
  const superShot = shot.impact === "super";
  const pose = superShot ? "cash-orb-release" : "bundle";
  const height = (shot.radius ?? 15) * 2;
  ctx.save();
  ctx.shadowBlur = 0;
  if (superShot && hasAttackArt(images, "inaki", INAKI_PROP_POSES))
    for (let i = 0; i < 4; i++) {
      const angle = i * 2.4 + (reduced ? 0 : (shot.age ?? 0) * 0.1);
      ctx.save();
      ctx.translate(-12 + Math.cos(angle) * 16, Math.sin(angle) * 20);
      if (!reduced) ctx.rotate(angle * 0.35);
      centered(
        ctx,
        images,
        INAKI_PROP_POSES[i % 3],
        0,
        0,
        14 - i,
        1,
        0.75 - i * 0.16,
      );
      ctx.restore();
    }
  const painted = superShot
    ? tumble(
        ctx,
        images,
        pose,
        0,
        0,
        height,
        1,
        reduced ? 0 : (shot.age ?? 0) * 0.07,
      )
    : centered(ctx, images, pose, 0, 0, height);
  if (!painted && superShot) {
    // Keep the actual hit circle readable even when the optional sheet fails.
    ctx.strokeStyle = "#42583b";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4;
      ctx.save();
      ctx.translate(
        Math.cos(angle) * height * 0.2,
        Math.sin(angle) * height * 0.2,
      );
      ctx.rotate(angle);
      ctx.fillStyle = i % 2 ? "#d9e5b4" : "#bbc99b";
      ctx.beginPath();
      ctx.roundRect(
        -height * 0.23,
        -height * 0.16,
        height * 0.46,
        height * 0.32,
        2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (!painted) {
    // The special still throws one compact fajo.
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
