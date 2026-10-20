import { fighterById } from "../../../shared/content";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const GEORGE_POSES = [
  "present",
  "incline",
  "bow",
  "recover",
  "curtain",
  "support",
] as const;
export const GEORGE_CONTACT_TICK = 96;
// Crown to sole in raw-v1, before independent cell packing. A waist bow lowers
// the head; it must never enlarge the actor to fill an upright bounding box.
export const GEORGE_BODY_HEIGHTS: Record<string, number> = {
  present: 506,
  incline: 470,
  bow: 379,
  recover: 463,
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const GEORGE_POSE_SCALE: Record<string, number> = {
  present: 1,
  incline: 1,
  bow: 1,
  recover: 506 / 463,
};
const height = (pose: string) =>
  (GEORGE_BODY_HEIGHTS[pose] * GEORGE_POSE_SCALE[pose] * 300) / 506;

/** The lower gold hem first touches the canonical crown at the sole damage beat. */
export function georgeCurtainHem(
  tick: number,
  feet: number,
  crown: number,
  rail: number,
) {
  if (tick < 60) return rail;
  if (tick <= GEORGE_CONTACT_TICK)
    return rail + (crown - rail) * clamp((tick - 60) / 36) ** 2;
  if (tick <= 112) return crown + (feet - crown) * clamp((tick - 96) / 16);
  if (tick < 140) return feet;
  return feet + (rail - feet) * clamp((tick - 140) / 30);
}

export function drawGeorgeFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "george", GEORGE_POSES)) return false;
  const { ctx, tick, profile } = view;
  const source = view.point(333, 518),
    target = view.point(766, 523);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 333 + ((x - source.x) * 433) / span;
  const feetAt = (x: number, feet: number) =>
    523 + feet - view.point(authored(x), 523).y;
  const transition = Math.min(
    clamp(tick / 12),
    clamp((profile.duration - tick) / 12),
  );
  const sheet = ATTACK_ART.george;
  const curtainHeight = 430;
  const supportHeight = 60;
  const ranges = [
    finaleArtXRange(view.viewport, sheet.frames.curtain, curtainHeight),
    finaleArtXRange(view.viewport, sheet.frames.support, supportHeight),
  ];
  const actorRanges = GEORGE_POSES.slice(0, 4).map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], height(p)),
  );
  const constrain = (x: number, min: number, max: number) =>
    Math.max(min, Math.min(max, x));
  const propMin = Math.max(...ranges.map((r) => r.minX)),
    propMax = Math.min(...ranges.map((r) => r.maxX));
  const actorMin = Math.max(...actorRanges.map((r) => r.minX)),
    actorMax = Math.min(...actorRanges.map((r) => r.maxX));
  let curtainX = constrain(target.x, propMin, propMax);
  const actorEnd = constrain(
    Math.min(source.x, curtainX - 445),
    actorMin,
    actorMax,
  );
  curtainX = constrain(Math.max(curtainX, actorEnd + 445), propMin, propMax);
  const actorX = source.x + (actorEnd - source.x) * transition;
  const rivalX = target.x + (curtainX - target.x) * transition;
  // Each body retains its physical platform height. Only a bounded horizontal
  // presentation adjustment separates close captures; it returns before release.
  const rivalHeight =
    (300 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const sprite = view.sprites[view.rival];
  // drawSprite grounds the chosen full frame and scales by the idle bodyHeight.
  // A guarded/crouched battle frame can be shorter than nominal displayHeight.
  const standingHeight = sprite
    ? (rivalHeight * sprite.frames[sprite.battleFrame].height) /
      sprite.bodyHeight
    : rivalHeight;
  const crown = target.y - standingHeight;
  const rail = Math.min(target.y - curtainHeight + 6, crown - 72);
  const hem = georgeCurtainHem(tick, target.y, crown, rail);
  const propAlpha = Math.min(clamp((tick - 12) / 12), clamp((176 - tick) / 6));
  view.body(
    view.rival,
    authored(rivalX),
    feetAt(rivalX, target.y),
    300,
    -1,
    tick >= GEORGE_CONTACT_TICK + 4 && tick < 165 ? "hurt" : "stand",
  );
  if (propAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= propAlpha;
    // These taut rigging lines terminate at the painted brass mounting eyes.
    // Their far anchors remain above the existing arena camera, as stage rigging.
    const halfEyeSpan =
      (0.383 * sheet.frames.support.width * supportHeight) /
      sheet.frames.support.bodyHeight!;
    for (const sign of [-1, 1]) {
      const x = rivalX + sign * halfEyeSpan;
      ctx.strokeStyle = "#d4b579";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, view.viewport?.top ?? rail - 180);
      ctx.lineTo(x, rail - 44);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    // Complete cloth translates behind its fixed rail, as a descending drop.
    // Only the cloth is occluded by the rail; actor anatomy is never masked.
    ctx.beginPath();
    ctx.rect(rivalX - 310, rail, 620, target.y - rail + 15);
    ctx.clip();
    drawAttackArt(
      ctx,
      view.images,
      "george",
      "curtain",
      rivalX,
      hem,
      curtainHeight,
      1,
      propAlpha,
    );
    ctx.restore();
    // Both short mounting eyes are painted as part of the connected support.
    drawAttackArt(
      ctx,
      view.images,
      "george",
      "support",
      rivalX,
      rail + 8,
      supportHeight,
      1,
      propAlpha,
    );
  }
  const pose =
    tick < 36
      ? "present"
      : tick < 60
        ? "incline"
        : tick < 126
          ? "bow"
          : tick < 146
            ? "incline"
            : tick < 168
              ? "recover"
              : "present";
  drawAttackArt(
    ctx,
    view.images,
    "george",
    pose,
    actorX,
    source.y,
    height(pose),
  );
  if (tick >= GEORGE_CONTACT_TICK && tick < GEORGE_CONTACT_TICK + 10) {
    ctx.save();
    ctx.globalAlpha *= (106 - tick) / 10;
    ctx.strokeStyle = "#ffdfa0";
    ctx.lineWidth = 3;
    for (let n = 0; n < 7; n++) {
      const angle = Math.PI + (n * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(rivalX + Math.cos(angle) * 20, crown + Math.sin(angle) * 15);
      ctx.lineTo(rivalX + Math.cos(angle) * 45, crown + Math.sin(angle) * 34);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (tick < 140)
    view.bubble(
      "Se acabó el show",
      constrain(
        actorX + 15,
        (view.viewport?.left ?? -Infinity) + 150,
        (view.viewport?.right ?? Infinity) - 150,
      ),
      Math.max((view.viewport?.top ?? -Infinity) + 36, source.y - 440),
      280,
    );
  if (view.pulse) {
    ctx.save();
    ctx.globalAlpha *= view.pulse;
    // Follow the presented rival as well: the shared damage label follows its
    // physical anchor, which can overlap George's dialogue in a close capture.
    view.text(
      `−${Math.round(view.state.finale!.damage)} VIDA`,
      rivalX,
      crown - 42,
      29,
      "#ffb4a2",
    );
    ctx.restore();
  }
  return true;
}
