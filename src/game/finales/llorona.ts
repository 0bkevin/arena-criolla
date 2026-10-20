import { fighterById } from "../../../shared/content";
import type {
  Effect,
  MatchState,
  PlayerState,
  Projectile,
} from "../../../shared/engine";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

export const LLORONA_POSES = [
  "lure",
  "cast",
  "reveal",
  "embrace-high",
  "embrace-low",
  "recover",
  "portal",
  "wave",
] as const;
const heights: Record<string, number> = {
  lure: 495,
  cast: 452,
  reveal: 437,
  "embrace-high": 475,
  "embrace-low": 399,
  recover: 493,
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
/** One source-pixel scale across all six poses: a crouch never enlarges a head. */
export const lloronaHeight = (pose: string, body = 300) =>
  (heights[pose] * body) / 495;
export const lloronaSpecialPose = (tick: number) =>
  tick < 9
    ? "lure"
    : tick < 14
      ? "cast"
      : tick < 29
        ? "embrace-low"
        : "recover";
export function drawLloronaSpecial(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  p: PlayerState,
  height: number,
) {
  if (
    p.config.fighter !== "llorona" ||
    p.attack !== "special" ||
    p.stun ||
    !hasAttackArt(images, "llorona", LLORONA_POSES)
  )
    return false;
  const pose = lloronaSpecialPose(p.attackTick);
  return drawAttackArt(
    ctx,
    images,
    "llorona",
    pose,
    p.x,
    p.y,
    lloronaHeight(pose, height),
    p.facing,
  );
}
/** Called inside the production projectile translation/facing transform. */
export function drawLloronaProjectile(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  shot: Projectile,
) {
  if (shot.kind !== "undertow" || !hasAttackArt(images, "llorona", ["wave"]))
    return false;
  ctx.shadowBlur = 0;
  return drawAttackArt(ctx, images, "llorona", "wave", 0, 29, 58);
}

/** Preserve the wave on the exact contact frame, including immediate close hits. */
export function drawLloronaImpact(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  images: Record<string, HTMLImageElement>,
  effect: Effect,
) {
  if (
    effect.owner === undefined ||
    state.players[effect.owner].config.fighter !== "llorona" ||
    effect.impact !== "special" ||
    (effect.kind !== "hit" && effect.kind !== "block") ||
    !hasAttackArt(images, "llorona", ["wave"])
  )
    return;
  const age = effect.duration - effect.life;
  if (age > 8) return;
  ctx.save();
  ctx.shadowBlur = 0;
  drawAttackArt(
    ctx,
    images,
    "llorona",
    "wave",
    effect.x,
    effect.y + 29,
    58,
    effect.direction ?? 1,
    1 - age / 9,
  );
  ctx.restore();
}

export function lloronaPhase(tick: number) {
  if (tick < 36) return "lure";
  if (tick < 60) return "reveal";
  if (tick < 100) return "embrace";
  if (tick < 138) return "descend";
  if (tick < 148) return "underworld";
  if (tick < 168) return "return";
  return "release";
}
/** Capture choreography only changes illustration coordinates. Physics, camera,
 * combat clock and the ordinary release impulse remain owned by the engine. */
export function drawLloronaFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "llorona", LLORONA_POSES)) return false;
  const { ctx, tick } = view,
    sheet = ATTACK_ART.llorona;
  const source = view.point(306, 514),
    target = view.point(782, 514);
  const span = Math.max(1, target.x - source.x);
  const authored = (x: number) => 306 + ((x - source.x) * 476) / span;
  const atFeet = (x: number, y: number) =>
    514 + y - view.point(authored(x), 514).y;
  const transition = Math.min(ease(tick / 18), ease((180 - tick) / 12));
  const portalHeight = 180;
  const portalRange = finaleArtXRange(
    view.viewport,
    sheet.frames.portal,
    portalHeight,
  );
  // At an arena edge the scene moves inward only enough for the complete portal.
  // The captured state and production camera are untouched; return to feet by180.
  const center = Math.max(
    portalRange.minX,
    Math.min(portalRange.maxX, source.x + 65),
  );
  const actorX = source.x + (center - 65 - source.x) * transition;
  const portalX = actorX + 65;
  const pull = ease((tick - 12) / 48) * (1 - ease((tick - 168) / 12));
  const rivalX = target.x + (actorX + 100 - target.x) * pull;
  const feet = target.y + (source.y - target.y) * pull;
  const rivalHeight =
    (290 * (fighterById(view.rival).displayHeight ?? 177)) / 177;
  const sprite = view.sprites[view.rival];
  const visibleHeight = sprite
    ? (sprite.frames[sprite.battleFrame].height * rivalHeight) /
      sprite.bodyHeight
    : rivalHeight;
  const embrace = visibleHeight < 245 ? "embrace-low" : "embrace-high";
  const phase = lloronaPhase(tick);
  const pose =
    phase === "lure"
      ? "lure"
      : phase === "reveal"
        ? "reveal"
        : phase === "release" || phase === "return"
          ? "recover"
          : embrace;
  const portalOpen = Math.min(
    ease((tick - 25) / 20),
    1 - ease((tick - 168) / 10),
  );
  const portalFeet = source.y + 56;
  const drawPortal = () =>
    view.art(
      "portal",
      authored(portalX),
      atFeet(portalX, portalFeet),
      portalHeight,
      1,
      portalOpen,
    );
  if (portalOpen > 0) drawPortal();
  // All anatomy stays in its source bitmap. The portal surface occludes feet,
  // torso then head as both complete bodies physically translate downward.
  const depth = Math.max(350, visibleHeight + 55);
  const descent =
    ease((tick - 100) / 38) * (1 - ease((tick - 148) / 20)) * depth;
  ctx.save();
  if (descent > 0) {
    ctx.beginPath();
    ctx.rect(
      (view.viewport?.left ?? -2000) - 100,
      -3000,
      6000,
      source.y + 20 + 3000,
    );
    ctx.clip();
  }
  view.body(
    view.rival,
    authored(rivalX),
    atFeet(rivalX, feet + descent),
    290,
    -1,
    "stand",
  );
  view.art(
    pose,
    authored(actorX),
    atFeet(actorX, source.y + descent),
    lloronaHeight(pose),
  );
  ctx.restore();
  // The near painted rim lies in front of both bodies; the back rim remains behind.
  if (portalOpen > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(portalX - 500, source.y + 20, 1000, 300);
    ctx.clip();
    drawPortal();
    ctx.restore();
  }
  view.damage(115);
  view.text(
    "DEFINITIVA",
    Math.max(
      (view.viewport?.left ?? -Infinity) + 95,
      Math.min((view.viewport?.right ?? Infinity) - 95, portalX),
    ),
    Math.max(
      (view.viewport?.top ?? -Infinity) + 30,
      Math.min(source.y - 335, target.y - visibleHeight - 30),
    ),
    25,
    "#bcefff",
  );
  return true;
}
