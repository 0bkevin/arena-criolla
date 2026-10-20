import { fighterById } from "../../../shared/content";
import { WORLD, type PlayerState } from "../../../shared/engine";
import { TECHNIQUES } from "../../../shared/techniques";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const ALI_ACTOR_POSES = [
  "ready",
  "upstroke",
  "downstroke",
  "accent",
] as const;
export const ALI_CHOIR_POSES = [
  "choir-a",
  "choir-b",
  "choir-c",
  "choir-d",
  "choir-e",
  "choir-f",
] as const;
export const ALI_POSES = [...ALI_ACTOR_POSES, ...ALI_CHOIR_POSES];
// Crown-to-sole measurements in raw-v1. Undo each atlas cell's packing scale
// so leaning into the final strum lowers the head without enlarging the face.
export const ALI_BODY_HEIGHTS: Record<string, number> = {
  ready: 601,
  upstroke: 599,
  downstroke: 597,
  accent: 589,
};
const unit = (n: number) => Math.max(0, Math.min(1, n));
const between = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const aliPoseHeight = (pose: string, height: number) =>
  (height * ALI_BODY_HEIGHTS[pose]) / 601;

/** The downstroke is the actual emission: startup12 plus offsets0/12/24. */
export function aliSpecialPose(tick: number) {
  const beats = TECHNIQUES.strum.pulses!.map(
    (offset) => TECHNIQUES.strum.startup + offset,
  );
  for (const [i, beat] of beats.entries()) {
    if (tick >= beat && tick < beat + 6)
      return i === beats.length - 1 ? "accent" : "downstroke";
    if (tick >= beat - 6 && tick < beat) return "upstroke";
  }
  return "ready";
}
export function drawAliSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "ali" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "ali", ALI_ACTOR_POSES)
  )
    return false;
  const pose = aliSpecialPose(p.attackTick);
  return drawAttackArt(
    ctx,
    images,
    "ali",
    pose,
    p.x,
    p.y,
    aliPoseHeight(pose, height),
    p.facing,
  );
}

export function aliFinalePose(tick: number) {
  if (tick < 12 || tick >= 158) return "ready";
  if (tick >= 132 && tick < 148) return "accent";
  return (tick - 12) % 16 < 7 ? "downstroke" : "upstroke";
}
export function aliLift(tick: number) {
  if (tick < 42) return 0;
  if (tick < 90) return 70 * unit((tick - 42) / 26);
  if (tick < 138) return 70 + 40 * unit((tick - 90) / 24);
  return 110 * (1 - unit((tick - 148) / 26));
}

/** Four strings start a rising wave; six original adults add their voices. */
export function drawAliFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "ali", ALI_POSES)) return false;
  const { ctx, tick, profile, motion } = view;
  const source = view.point(330, 510),
    target = view.point(783, 510);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 330 + ((x - source.x) * 453) / span;
  const feetAt = (x: number, feet: number) =>
    510 + feet - view.point(authored(x), 510).y;
  const transition = Math.min(
    unit(tick / 12),
    unit((profile.duration - tick) / 12),
  );
  const sheet = ATTACK_ART.ali;
  const ranges = ALI_ACTOR_POSES.map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], aliPoseHeight(p, 305)),
  );
  const minActor = Math.max(...ranges.map((r) => r.minX)),
    maxActor = Math.min(...ranges.map((r) => r.maxX));
  // The quartet of complete actor poses stays inside the real transformed
  // viewport. A bounded presentation step creates a readable close capture.
  const actorEnd = between(
    source.x - Math.max(0, 340 - span),
    Math.max(minActor, (view.viewport?.left ?? -Infinity) + 510),
    Math.min(maxActor, (view.viewport?.right ?? Infinity) - 430),
  );
  const actorX = source.x + (actorEnd - source.x) * transition;
  const sprite = view.sprites[view.rival];
  const baseHeight =
    (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const activeFrame = tick >= 42 && tick < 156 ? 7 : (sprite?.battleFrame ?? 0);
  const frame = sprite?.frames[activeFrame];
  const scale = sprite ? baseHeight / sprite.bodyHeight : 1;
  const visibleHeight = frame ? frame.height * scale : baseHeight;
  // Canonical battle/hurt geometry determines the crown and torso, including
  // very short Momoy and very tall Silbón. No posedTexture or rescaled heads.
  const maxHeight = sprite
    ? Math.max(
        sprite.frames[7].height,
        sprite.frames[sprite.battleFrame].height,
      ) * scale
    : baseHeight;
  const lift = Math.min(
    aliLift(tick),
    Math.max(0, target.y - maxHeight - (view.viewport?.top ?? -Infinity) - 14),
  );
  const feet = target.y - lift;
  const leftOffset =
    frame && sprite
      ? (frame.x - frame.slotX - sprite.cellWidth / 2) *
        scale *
        -(sprite.frameFacing[activeFrame] ?? 1)
      : -80;
  const rightOffset = frame
    ? leftOffset - frame.width * scale * (sprite?.frameFacing[activeFrame] ?? 1)
    : 80;
  const minRival =
    (view.viewport?.left ?? -Infinity) + 10 - Math.min(leftOffset, rightOffset);
  const maxRival =
    (view.viewport?.right ?? Infinity) - 10 - Math.max(leftOffset, rightOffset);
  const rivalEnd = between(
    Math.max(target.x, actorEnd + 340),
    minRival,
    maxRival,
  );
  const rivalX = target.x + (rivalEnd - target.x) * transition;

  // Two staggered rows behind the performer. Each different adult is drawn
  // once, whole; no duplicated heads, miniature crowds or replacement stage.
  const choirAlpha = Math.min(unit((tick - 48) / 20), unit((174 - tick) / 16));
  // Extras stand on the arena floor, even when Alí performs on a platform.
  // The scene's established177/300 scale maps world feet into local paint.
  const choirGround =
    source.y +
    (WORLD.floor - view.state.players[view.state.finale!.owner].y) /
      (177 / 300);
  if (choirAlpha > 0)
    for (let i = 0; i < ALI_CHOIR_POSES.length; i++) {
      const row = i < 3 ? 0 : 1,
        col = i % 3;
      const x = actorX + (row ? -390 + col * 130 : -420 + col * 140);
      const choirFeet = choirGround - (row ? 8 : 115);
      const height = row ? 225 : 235;
      const pose = ALI_CHOIR_POSES[i];
      drawAttackArt(
        ctx,
        view.images,
        "ali",
        pose,
        x,
        choirFeet,
        height,
        1,
        choirAlpha,
      );
      if (motion && tick >= 72 && tick < 145) {
        const mouthX = x + 21,
          mouthY = choirFeet - height * 0.85;
        const phase = ((tick + i * 4) % 24) / 24;
        ctx.save();
        ctx.globalAlpha *= choirAlpha * (1 - phase) * 0.5;
        ctx.strokeStyle = "#ffd88d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouthX + phase * 22, mouthY, 5 + phase * 10, -0.7, 0.7);
        ctx.stroke();
        ctx.restore();
      }
    }
  // A continuous wave carries the opponent upward after the first contact.
  // Each authored damage beat adds a larger envelope at the same torso point.
  const torso = { x: rivalX, y: feet - visibleHeight * 0.52 };
  const origin = { x: actorX + 18, y: source.y - 178 };
  if (tick >= 18 && tick < 164) {
    const active = unit((tick - 18) / 24);
    const endX = origin.x + (torso.x - origin.x) * active;
    const endY = origin.y + (torso.y - origin.y) * active;
    const swell = tick < 90 ? 1 : tick < 138 ? 1.45 : 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.globalAlpha *=
      Math.min(unit((tick - 18) / 8), unit((164 - tick) / 16)) * 0.7;
    ctx.strokeStyle = "#ffcf72";
    for (let string = 0; string < 4; string++) {
      ctx.lineWidth = 2 + (tick >= 90 ? 1 : 0);
      ctx.beginPath();
      for (let n = 0; n <= 48; n++) {
        const t = n / 48;
        const x = origin.x + (endX - origin.x) * t;
        const y =
          origin.y +
          (endY - origin.y) * t +
          (string - 1.5) * 8 * swell +
          Math.sin(t * Math.PI * 4 - (motion ? tick / 5 : 0)) *
            9 *
            swell *
            Math.sin(t * Math.PI);
        if (!n) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (tick >= 42)
      for (let i = 0; i < 3; i++) {
        const phase = motion ? ((tick - 42 + i * 10) % 30) / 30 : i / 3;
        view.ring(
          rivalX,
          feet - 8 - phase * visibleHeight * 0.7,
          45 + 18 * swell + phase * 20,
          "#ffd887",
          0.24,
        );
      }
  }
  view.body(
    view.rival,
    authored(rivalX),
    feetAt(rivalX, feet),
    300,
    -1,
    activeFrame === 7 ? "hurt" : "stand",
  );
  const pose = aliFinalePose(tick);
  drawAttackArt(
    ctx,
    view.images,
    "ali",
    pose,
    actorX,
    source.y,
    aliPoseHeight(pose, 305),
  );
  for (const [index, beat] of profile.damageBeats.entries()) {
    const age = tick - beat;
    if (age >= 0 && age < 12) {
      ctx.save();
      ctx.globalAlpha *= 1 - age / 12;
      view.ring(
        torso.x,
        torso.y,
        33 + index * 18 + age * (motion ? 3 : 0),
        "#fff0bb",
        0.85,
      );
      ctx.restore();
    }
  }
  if (view.pulse) {
    ctx.save();
    ctx.globalAlpha *= view.pulse;
    // The damage label follows the same presented body and actual frame crown,
    // including visual separation at edges and vertical movement during lift.
    view.text(
      `−${Math.round(view.state.finale!.damage / profile.damageBeats.length)} VIDA`,
      between(
        rivalX,
        (view.viewport?.left ?? -Infinity) + 70,
        (view.viewport?.right ?? Infinity) - 70,
      ),
      Math.max(
        (view.viewport?.top ?? -Infinity) + 30,
        feet - visibleHeight - 28,
      ),
      29,
      "#ffb4a2",
    );
    ctx.restore();
  }
  return true;
}
