import type {
  MatchState,
  PlayerState,
  Projectile,
} from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const CHATAING_POSES = [
  "windup",
  "cast",
  "reel",
  "recover",
  "microphone",
  "screen",
] as const;
export const CHATAING_SPECIAL_POSES = CHATAING_POSES.slice(0, 5);
export const CHATAING_SMASH_TICK = 114;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
// One source-pixel scale: bent knees do not make the head larger.
export const CHATAING_BODY_HEIGHTS: Record<string, number> = {
  windup: 451,
  cast: 433,
  reel: 442,
  recover: 442,
};
const height = (pose: string, standing: number) =>
  (CHATAING_BODY_HEIGHTS[pose] / 451) * standing;

export function chataingSpecialPose(player: PlayerState, shot?: Projectile) {
  if (shot) {
    const reach = (shot.x - player.x) * (shot.direction ?? player.facing);
    return !shot.returning && reach > 140 ? "cast" : "reel";
  }
  return player.attackTick < 11 ? "windup" : "recover";
}

function hand(
  pose: string,
  x: number,
  feet: number,
  standing: number,
  facing = 1,
) {
  const scale = standing / 451;
  // Measured cable tips in the unmodified v2 source, relative to body anchor/sole.
  return pose === "cast"
    ? { x: x + facing * 247.5 * scale, y: feet - 289 * scale }
    : { x: x + facing * 141.5 * scale, y: feet - 240 * scale };
}

export function drawMicrophoneCable(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  slack: number,
  width = 3,
) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineCap = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(
      (from.x + to.x) / 2,
      Math.max(from.y, to.y) + slack,
      to.x,
      to.y,
    );
  };
  ctx.lineWidth = width + 1.2;
  ctx.strokeStyle = "#d0d5d5";
  path();
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = "#17191d";
  path();
  ctx.stroke();
  ctx.restore();
}

/** The physics point is the grille, not the centre of the long handle. */
export function drawWiredMicrophone(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  grille: { x: number; y: number },
  direction: number,
  angle = 0,
  length = 40,
  artwork = true,
) {
  ctx.save();
  ctx.translate(grille.x, grille.y);
  ctx.rotate(angle);
  ctx.scale(direction, 1);
  ctx.shadowBlur = 0;
  let painted = false;
  if (artwork && hasAttackArt(images, "chataing", ["microphone"])) {
    // Source width510, core height172. Grille centre is at89% of source width.
    const h = (length * 172) / 510;
    const frame = ATTACK_ART.chataing.frames.microphone;
    const scale = h / (frame.bodyHeight ?? frame.height);
    const feet = ((frame.anchorY ?? frame.height) - frame.height / 2) * scale;
    painted = drawAttackArt(
      ctx,
      images,
      "chataing",
      "microphone",
      -length * 0.39,
      feet,
      h,
    );
  }
  if (!painted) {
    ctx.fillStyle = "#22252a";
    ctx.strokeStyle = "#aab0b4";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-length * 0.86, -3.5, length * 0.7, 7, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#747d84";
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "#242a2f";
    ctx.lineWidth = 0.8;
    for (let n = -8; n <= 8; n += 3) {
      ctx.beginPath();
      ctx.moveTo(n, -8);
      ctx.lineTo(n, 8);
      ctx.moveTo(-8, n);
      ctx.lineTo(8, n);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  return {
    x: grille.x - direction * length * 0.89 * Math.cos(angle),
    y: grille.y - direction * length * 0.89 * Math.sin(angle),
  };
}

/** Draw after the actor so the cable connects visibly to its painted hand. */
export function drawChataingSpecial(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  images: Record<string, HTMLImageElement>,
  player: PlayerState,
  index: number,
  standing: number,
): boolean {
  if (player.config.fighter !== "chataing") return false;
  const shot = state.projectiles.find((p) => p.owner === index && p.tether);
  if (!shot && (player.attack !== "special" || player.stun)) return false;
  if (!hasAttackArt(images, "chataing", CHATAING_SPECIAL_POSES)) return false;
  const pose = chataingSpecialPose(player, shot);
  const facing = shot?.direction ?? player.facing;
  drawAttackArt(
    ctx,
    images,
    "chataing",
    pose,
    player.x,
    player.y,
    height(pose, standing),
    facing,
  );
  if (shot) drawChataingTether(ctx, images, player, shot, pose, standing);
  return true;
}

export function drawChataingTether(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  player: PlayerState,
  shot: Projectile,
  pose: string,
  standing: number,
  artwork = true,
) {
  const facing = shot.direction ?? player.facing;
  const from = hand(pose, player.x, player.y, standing, facing);
  const length = (40 * standing) / 177;
  const to = { x: shot.x - facing * length * 0.89, y: shot.y };
  drawMicrophoneCable(ctx, from, to, shot.returning ? 16 : 7, 2.2);
  drawWiredMicrophone(ctx, images, shot, facing, 0, length, artwork);
}

export function drawChataingFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "chataing", CHATAING_POSES)) return false;
  const { ctx, tick, profile, motion } = view;
  const source = view.point(341, 516),
    target = view.point(744, 516);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 341 + ((x - source.x) * 403) / span;
  const feet = (x: number, y: number) =>
    516 + y - view.point(authored(x), 516).y;
  const transition = Math.min(clamp(tick / 12), clamp((180 - tick) / 12));
  const screenHeight = 510;
  const sheet = ATTACK_ART.chataing;
  const screenRange = finaleArtXRange(
    view.viewport,
    sheet.frames.screen,
    screenHeight,
  );
  const actorRanges = CHATAING_POSES.slice(0, 4).map((p) =>
    finaleArtXRange(view.viewport, sheet.frames[p], height(p, 300)),
  );
  const actorMin = Math.max(...actorRanges.map((r) => r.minX));
  const actorMax = Math.min(...actorRanges.map((r) => r.maxX));
  const constrain = (x: number, min: number, max: number) =>
    Math.max(min, Math.min(max, x));
  let screenX = constrain(target.x, screenRange.minX, screenRange.maxX);
  const desiredActor = constrain(
    Math.min(source.x, screenX - 450),
    actorMin,
    actorMax,
  );
  screenX = constrain(
    Math.max(screenX, desiredActor + 450),
    screenRange.minX,
    screenRange.maxX,
  );
  const actorX = source.x + (desiredActor - source.x) * transition;
  const rivalX = target.x + (screenX - target.x) * transition;
  screenX = rivalX;
  const screenFrame = sheet.frames.screen;
  const screenTopOffset =
    ((screenFrame.anchorY ?? screenFrame.height) * screenHeight) /
    (screenFrame.bodyHeight ?? screenFrame.height);
  const screenFeet = Math.max(
    target.y,
    (view.viewport?.top ?? -Infinity) + screenTopOffset + 8,
  );
  // The underlay extends beneath the opaque bezel, covering the complete
  // curved alpha aperture rather than exposing a strip of untinted arena.
  const screenScale = screenHeight / 346;
  const aperture = {
    x: screenX - 178 * screenScale,
    y: screenFeet - 316 * screenScale,
    w: 323 * screenScale,
    h: 257 * screenScale,
  };
  const screenAlpha = clamp((tick - 3) / 9);
  const broken = tick >= CHATAING_SMASH_TICK;
  const bodyMode = tick >= CHATAING_SMASH_TICK && tick < 142 ? "hurt" : "stand";
  const bodyX = rivalX - 25 * transition;
  // The screen stands on the rival's platform; its frozen image rises into the
  // aperture. After the glass breaks it settles back to its physical feet.
  const lift =
    (101 - (screenFeet - target.y)) *
    (broken ? 1 - clamp((tick - CHATAING_SMASH_TICK) / 30) : transition);
  if (!broken) {
    ctx.save();
    ctx.globalAlpha *= screenAlpha;
    ctx.fillStyle = "#142f3de8";
    ctx.beginPath();
    ctx.roundRect(aperture.x, aperture.y, aperture.w, aperture.h, 28);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  if (!broken && tick >= 12) {
    ctx.beginPath();
    ctx.roundRect(aperture.x, aperture.y, aperture.w, aperture.h, 28);
    ctx.clip();
  }
  view.body(
    view.rival,
    authored(bodyX),
    feet(bodyX, target.y - lift),
    290,
    -1,
    bodyMode,
  );
  ctx.restore();
  if (!broken) {
    ctx.save();
    ctx.globalAlpha *= screenAlpha;
    // Scan lines belong to this local television prop, never to the arena.
    ctx.beginPath();
    ctx.roundRect(aperture.x, aperture.y, aperture.w, aperture.h, 28);
    ctx.clip();
    ctx.fillStyle = "#b5eeff18";
    for (let y = aperture.y; y < aperture.y + aperture.h; y += 8)
      ctx.fillRect(aperture.x, y, aperture.w, 1);
    ctx.restore();
    drawAttackArt(
      ctx,
      view.images,
      "chataing",
      "screen",
      screenX,
      screenFeet,
      screenHeight,
      1,
      screenAlpha,
    );
  } else if (tick < 150) {
    const elapsed = tick - CHATAING_SMASH_TICK;
    const alpha = clamp((150 - tick) / 25);
    // Natural fracture masks split the complete prop into four physical pieces.
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1,
        sy = i < 2 ? -1 : 1;
      const dx = motion ? sx * elapsed * 2.2 : 0;
      const dy = motion ? sy * elapsed * 1.3 + elapsed * elapsed * 0.08 : 0;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.beginPath();
      ctx.rect(
        screenX + (sx < 0 ? -360 : 0),
        screenFeet - 550 + (sy < 0 ? 0 : 270),
        360,
        280,
      );
      ctx.clip();
      drawAttackArt(
        ctx,
        view.images,
        "chataing",
        "screen",
        screenX,
        screenFeet,
        screenHeight,
        1,
        alpha,
      );
      ctx.restore();
    }
    if (elapsed < 14) {
      ctx.save();
      ctx.strokeStyle = "#e3f7ff";
      ctx.lineWidth = 3;
      ctx.globalAlpha *= 1 - elapsed / 14;
      const hit = { x: aperture.x + aperture.w * 0.35, y: screenFeet - 251 };
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(hit.x, hit.y);
        ctx.lineTo(
          hit.x + Math.cos(angle + 0.12) * 50,
          hit.y + Math.sin(angle + 0.12) * 50,
        );
        ctx.lineTo(
          hit.x + Math.cos(angle) * 100,
          hit.y + Math.sin(angle) * 100,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  const pose =
    tick < 80
      ? "recover"
      : tick < 96
        ? "windup"
        : tick < 118
          ? "cast"
          : tick < 150
            ? "reel"
            : "recover";
  drawAttackArt(
    ctx,
    view.images,
    "chataing",
    pose,
    actorX,
    source.y,
    height(pose, 300),
  );
  if (tick >= 96 && tick < 150) {
    const from = hand(pose, actorX, source.y, 300);
    const start = { x: actorX - 50, y: source.y - 275 };
    const impact = { x: aperture.x + aperture.w * 0.35, y: screenFeet - 251 };
    const caught = { x: actorX - 15, y: source.y - 219 };
    const throwing = tick <= CHATAING_SMASH_TICK;
    const progress = throwing
      ? clamp((tick - 96) / 18)
      : clamp((tick - 118) / 32);
    const a = throwing ? start : impact,
      b = throwing ? impact : caught;
    const grille = {
      x: a.x + (b.x - a.x) * progress,
      y:
        a.y +
        (b.y - a.y) * progress -
        Math.sin(progress * Math.PI) * (throwing ? 65 : -40),
    };
    const length = 67.8;
    const plug = { x: grille.x - length * 0.89, y: grille.y };
    drawMicrophoneCable(ctx, from, plug, throwing ? 20 : 35, 3.6);
    drawWiredMicrophone(ctx, view.images, grille, 1, 0, length);
  }
  view.bubble(
    "¡Vamos a comerciales!",
    constrain(
      actorX + 30,
      (view.viewport?.left ?? -Infinity) + 173,
      (view.viewport?.right ?? Infinity) - 173,
    ),
    Math.max((view.viewport?.top ?? -Infinity) + 38, source.y - 440),
    330,
  );
  view.damage(115);
  return true;
}
