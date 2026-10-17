import type { FighterId } from "../../shared/content";
import {
  presentationById,
  samplePose,
  type PresentationStyle,
} from "../../shared/presentation";
import { drawSprite, type SpriteAsset } from "./assets";
import { sampleGesture } from "../../shared/choreography";
import { drawEntranceAction } from "./entrance-renderer";
import {
  drawArticulatedSprite,
  handAnchors,
  type RigPoint,
} from "./gesture-rig";

function note(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillRect(0, -11, 2, 13);
  ctx.fillRect(2, -11, 6, 3);
  ctx.beginPath();
  ctx.ellipse(-2, 2, 4, 2.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function sparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillRect(x - size, y - 1, size * 2, 2);
  ctx.fillRect(x - 1, y - size, 2, size * 2);
}
function accents(
  ctx: CanvasRenderingContext2D,
  id: FighterId,
  style: PresentationStyle,
  progress: number,
  height: number,
  selection: boolean,
  frame: number,
  hands: [RigPoint, RigPoint],
) {
  const profile = presentationById(id);
  const activity = Math.sin(Math.PI * progress);
  if (activity <= 0.01) return;
  ctx.save();
  ctx.scale(height / 177, height / 177);
  ctx.globalAlpha *= activity * (selection ? 0.38 : 0.85);
  ctx.fillStyle = profile.color;
  ctx.strokeStyle = profile.color;
  ctx.lineWidth = 2;
  // Props already painted in the atlas are never drawn a second time.
  if (style === "strum" || style === "bass") {
    for (let n = 0; n < (style === "bass" ? 3 : 4); n++) {
      const phase = Math.max(0, Math.min(1, (progress - n * 0.04) / 0.8));
      ctx.globalAlpha = activity * (1 - phase) * (selection ? 0.25 : 0.8);
      note(
        ctx,
        27 + n * 9 + phase * 18,
        -87 - phase * 42,
        style === "bass" ? 1.15 : 0.8,
      );
    }
  } else if (style === "conduct") {
    ctx.beginPath();
    ctx.moveTo(20, -125);
    ctx.bezierCurveTo(80, -165, 72, -95, 29, -90);
    ctx.stroke();
    // Dudamel already holds a baton: the arc follows its movement.
    for (let n = 0; n < 3; n++)
      note(
        ctx,
        69 + n * 14,
        -119 - Math.sin(progress * Math.PI + n * 0.12) * 12,
        0.65,
      );
  } else if (style === "phone" || style === "card" || style === "inspect") {
    const phone = profile.prop === "phone";
    if (
      (profile.prop === "phone" && id !== "lele") ||
      profile.prop === "card"
    ) {
      ctx.save();
      ctx.translate(hands[1].x * 177, hands[1].y * 177);
      ctx.rotate(-0.15 + Math.sin(progress * Math.PI) * 0.2);
      ctx.fillStyle = "#0d2035";
      ctx.strokeStyle = profile.color;
      ctx.beginPath();
      ctx.roundRect(-9, -10, phone ? 15 : 23, phone ? 27 : 16, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = profile.color;
      if (phone) {
        ctx.fillRect(-6, -5, 9, 15);
        ctx.fillStyle = "#eef6ff";
        ctx.fillRect(-3, 3, 4, 2);
      } else {
        ctx.fillRect(-5, -4, 6, 4);
        ctx.fillRect(4, 3, 7, 2);
      }
      ctx.restore();
    }
    if (id === "lele") {
      sparkle(ctx, 35, -115, 4);
      ctx.strokeRect(23, -128, 24 + activity * 4, 35);
    }
    if (profile.prop === "vial") sparkle(ctx, -15, -75, 3);
    if (profile.prop === "book") {
      ctx.strokeRect(8, -106, 15, 20);
      ctx.fillRect(15, -103, 1, 14);
    }
    if (profile.prop === "cane") sparkle(ctx, -27, -56, 3);
    if (profile.prop === "none" && id !== "amanda") sparkle(ctx, 18, -150, 2);
  } else if (style === "spectral") {
    for (let wisp = 0; wisp < 4; wisp++) {
      const phase = Math.max(0, Math.min(1, (progress - wisp * 0.04) / 0.8));
      ctx.globalAlpha = activity * (1 - phase) * (selection ? 0.16 : 0.38);
      ctx.beginPath();
      ctx.ellipse(
        -23 + wisp * 18 + Math.sin(phase * 6) * 9,
        -6 - phase * 21,
        24,
        6,
        -0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    if (id === "llorona") {
      ctx.globalAlpha = activity * 0.6;
      for (let tear = 0; tear < 2; tear++) {
        const phase = Math.max(0, Math.min(1, (progress - tear * 0.05) / 0.8));
        ctx.fillRect(7 + tear * 6, -145 + phase * 29, 2, 4);
      }
    }
  } else if (style === "ritual") {
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.ellipse(0, -3, 40 + activity * 7, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let leaf = 0; leaf < 5; leaf++) {
      const angle = progress * Math.PI * 2 + leaf * 1.26;
      const x = Math.cos(angle) * 49,
        y = -70 + Math.sin(angle) * 25;
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 2, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (
    style === "dance" ||
    style === "hop" ||
    style === "pounce" ||
    style === "stalk"
  ) {
    for (let step = 0; step < 3; step++) {
      const phase = Math.max(0, Math.min(1, (progress - step * 0.04) / 0.8));
      ctx.globalAlpha = activity * (1 - phase) * (selection ? 0.16 : 0.5);
      ctx.beginPath();
      ctx.ellipse(
        -24 + step * 20,
        -2,
        8 + phase * 17,
        2 + phase * 3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (profile.prop === "fire")
      for (let ember = 0; ember < 4; ember++) {
        const phase = Math.max(
          0,
          Math.min(1, (progress - ember * 0.04) / 0.85),
        );
        ctx.globalAlpha = activity * (1 - phase) * 0.55;
        ctx.fillRect(-25 + ember * 15, -16 - phase * 36, 3, 5);
      }
  } else if (style === "hat") {
    sparkle(ctx, 17 + Math.sin(progress * 4) * 4, -160, 3);
    ctx.globalAlpha *= 0.4;
    ctx.beginPath();
    ctx.arc(13, -150, 16, -1.8, -0.3);
    ctx.stroke();
  } else if (style === "broadcast") {
    for (let ring = 0; ring < 2; ring++) {
      ctx.globalAlpha = activity * (selection ? 0.15 : 0.35);
      ctx.beginPath();
      ctx.arc(22, -132, 8 + ring * 9 + progress * 6, -0.7, 0.7);
      ctx.stroke();
    }
  } else if (style === "joke") {
    sparkle(ctx, 42, -130 - Math.sin(progress * 5) * 7, 3);
    sparkle(ctx, -30, -146, 2);
  } else {
    ctx.globalAlpha *= 0.35;
    sparkle(ctx, 45, -128, 3);
    if (profile.prop === "flower" || profile.prop === "leaves") {
      for (let petal = 0; petal < 4; petal++) {
        const angle = (petal * Math.PI) / 2;
        ctx.fillRect(
          27 + Math.cos(angle) * 4,
          -106 + Math.sin(angle) * 4,
          4,
          4,
        );
      }
    }
  }
  ctx.restore();
}

export function drawPresentation(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  id: FighterId,
  progress: number,
  x: number,
  feet: number,
  height: number,
  facing: number,
  kind: "intro" | "selection",
  reducedMotion = false,
) {
  const profile = presentationById(id);
  const pose = samplePose(
    kind === "intro" ? profile.introBeats : profile.selectionBeats,
    progress,
  );
  const style = kind === "intro" ? profile.introStyle : profile.selectionStyle;
  ctx.save();
  ctx.translate(
    x + (reducedMotion ? 0 : pose.dx * height * facing),
    feet + (reducedMotion ? 0 : pose.dy * height),
  );
  if (!reducedMotion) {
    ctx.rotate(pose.rotate * facing);
    ctx.scale(pose.scaleX, pose.scaleY);
  }
  const spectral = style === "spectral" && !reducedMotion;
  if (spectral) ctx.globalAlpha *= 1 - Math.sin(progress * Math.PI) ** 2 * 0.12;
  const gesture = sampleGesture(id, progress, kind === "selection");
  const dedicated =
    !reducedMotion &&
    drawEntranceAction(ctx, sprite, id, progress, height, facing);
  if (dedicated) {
    // The authored pose sequence contains the entire action; extra swaying and
    // repeated musical trails would reintroduce the old looping appearance.
  } else if (reducedMotion)
    drawSprite(ctx, sprite, profile.battleFrame, 0, 0, height, facing);
  else
    drawArticulatedSprite(ctx, sprite, id, pose.frame, height, facing, gesture);
  if (!reducedMotion && !dedicated && style !== "defiant") {
    ctx.scale(facing, 1);
    accents(
      ctx,
      id,
      style,
      progress,
      height,
      kind === "selection",
      pose.frame,
      handAnchors(sprite, id, pose.frame, gesture),
    );
  }
  ctx.restore();
  return reducedMotion
    ? {
        ...pose,
        frame: profile.battleFrame,
        dx: 0,
        dy: 0,
        rotate: 0,
        scaleX: 1,
        scaleY: 1,
      }
    : pose;
}
