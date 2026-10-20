import {
  activeArenaPerformance,
  arenaActorReach,
  arenaMountReach,
  isArenaFinalist,
  mountedFinale,
  rideMoving,
  type ArenaFinaleActor,
} from "../../shared/arena-finales";
import type { FieldFinaleState } from "../../shared/field-finales";
import type { MatchState, PlayerState, Projectile } from "../../shared/engine";
import courier from "../../shared/courier-assets.json";
import { ATTACK_ART, drawAttackArt, hasAttackArt } from "./attack-art";
import { BOLIVAR_BODY_HEIGHTS } from "./finales/bolivar";
import { aliPoseHeight } from "./finales/ali";
import { dudamelHeight } from "./finales/dudamel";
import { melanioPoseHeight } from "./finales/melanio";
import { lloronaHeight } from "./finales/llorona";
import { OSCAR_HEIGHTS } from "./finales/oscar";
import { CHATAING_BODY_HEIGHTS } from "./finales/chataing";
import { GEORGE_BODY_HEIGHTS, GEORGE_POSE_SCALE } from "./finales/george";
import { WORLD } from "../../shared/arena";

type Images = Record<string, HTMLImageElement>;
const unit = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const opacity = (field: FieldFinaleState) =>
  Math.min(
    unit((field.tick + 1) / 9),
    unit((field.duration - field.tick) / 12),
  );

/** Core body scale, independent of raised weapons, costumes and packed crop size. */
export function arenaPerformerPose(
  field: FieldFinaleState,
  height = 177,
  reducedMotion = false,
) {
  const t = field.tick,
    id = field.fighter;
  let pose: string | undefined,
    size = height,
    facing: number | undefined;
  if (id === "bolivar") {
    if (t >= 92) return;
    pose =
      t < 12 || !rideMoving(field)
        ? "ready"
        : reducedMotion || Math.floor(t / 6) % 2 === 0
          ? "gallop-a"
          : "gallop-b";
    size = BOLIVAR_BODY_HEIGHTS[pose] * 0.45;
  } else if (id === "gomez") {
    pose =
      t < 12
        ? "ready"
        : t >= 94
          ? "dismount"
          : t >= 88
            ? "brake"
            : reducedMotion || Math.floor(t / 5) % 2 === 0
              ? "gallop-extended"
              : "gallop-gathered";
    size = {
      ready: 234,
      "gallop-extended": 204,
      "gallop-gathered": 210,
      brake: 241,
      dismount: 216,
    }[pose]!;
  } else if (id === "lorenzo") {
    pose = field.direction > 0 ? "ride-right" : "ride-left";
    size = 236;
    facing = 1; // Both source directions keep the Polar lettering readable.
  } else if (id === "mcm") {
    pose = "truck";
    size = 145;
  } else if (id === "vallenilla") pose = "summon";
  else if (id === "javier")
    pose =
      t < 15 ? "headshirt" : t < 32 ? "fingerwag" : t < 54 ? "scold" : "point";
  else if (id === "renny") {
    pose = "ladder";
    size = 232;
  } else if (id === "simon")
    pose =
      t < 10
        ? "ready"
        : t % 20 < 8
          ? "accent"
          : t % 20 < 14
            ? "upstroke"
            : "downstroke";
  else if (id === "oscar") {
    pose =
      t < 10 ? "ready" : t % 24 < 12 ? "pull" : t >= 60 ? "accent" : "release";
    size = (height * OSCAR_HEIGHTS[pose]) / 305;
  } else if (id === "puma") pose = t < 18 ? "summon" : "release";
  else if (id === "chataing") {
    pose = t < 14 ? "windup" : t < 36 ? "cast" : t < 52 ? "reel" : "recover";
    size = (height * CHATAING_BODY_HEIGHTS[pose]) / 451;
  } else if (id === "george") {
    pose = t < 12 ? "present" : t < 25 ? "incline" : t < 42 ? "bow" : "recover";
    size = (height * GEORGE_BODY_HEIGHTS[pose] * GEORGE_POSE_SCALE[pose]) / 506;
  } else if (id === "ali") {
    pose =
      t < 10
        ? "ready"
        : t % 24 < 12
          ? "upstroke"
          : t >= 60
            ? "accent"
            : "downstroke";
    size = aliPoseHeight(pose, height);
  } else if (id === "dudamel") {
    pose =
      t < 8
        ? "ready"
        : t % 24 < 12
          ? "upbeat"
          : t >= 60
            ? "fortissimo"
            : "downbeat";
    size = dudamelHeight(pose, height);
  } else if (id === "melanio") {
    pose =
      t < 28
        ? "record"
        : t < 43
          ? "windup"
          : t < 56
            ? "strike-high"
            : "recover";
    size = melanioPoseHeight(pose, height);
  } else if (id === "llorona") {
    pose =
      t < 10
        ? "lure"
        : t < 26
          ? "reveal"
          : t < 50
            ? "embrace-high"
            : t < 65
              ? "embrace-low"
              : "recover";
    size = lloronaHeight(pose, height);
  }
  return pose
    ? { pose, height: size, facing: facing ?? field.direction }
    : undefined;
}

export function drawArenaPerformer(
  ctx: CanvasRenderingContext2D,
  images: Images,
  state: MatchState,
  player: PlayerState,
  height: number,
  reducedMotion = false,
) {
  const field = activeArenaPerformance(state, player);
  if (!field) return false;
  const pose = arenaPerformerPose(field, height, reducedMotion);
  return (
    !!pose &&
    drawAttackArt(
      ctx,
      images,
      field.fighter,
      pose.pose,
      player.x,
      player.y,
      pose.height,
      pose.facing,
    )
  );
}

function shadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
) {
  ctx.fillStyle = "#10151c55";
  ctx.beginPath();
  ctx.ellipse(x, y + 2, width, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function collisionFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  feet: number,
  direction: number,
  reach: ReturnType<typeof arenaActorReach>,
) {
  ctx.strokeStyle = "#ffdf9e";
  ctx.fillStyle = "#314657cc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(
    x + direction * reach.offset - reach.halfWidth,
    feet + reach.feetOffset - reach.top,
    reach.halfWidth * 2,
    reach.top - reach.bottom,
    8,
  );
  ctx.fill();
  ctx.stroke();
}

export function arenaHelperPose(
  field: FieldFinaleState,
  actor: ArenaFinaleActor,
  reducedMotion = false,
) {
  let pose: string | undefined,
    height = actor.height,
    facing = actor.direction;
  const gait = !reducedMotion && Math.floor(actor.age / 5) % 2 === 1;
  if (actor.kind === "horse") {
    if (field.fighter === "bolivar") pose = `llanero-${actor.index + 1}`;
    else {
      pose = gait ? "trooper-gathered" : "trooper-extended";
      height *= gait ? 325 / 307 : 1;
    }
  } else if (actor.kind === "truck") {
    pose = actor.direction > 0 ? "truck-right" : "truck-left";
    facing = 1;
  } else if (actor.kind === "woodhorse")
    pose = gait ? "horse-spring" : "horse-trot";
  else if (actor.kind === "mascot") {
    const beat = [36, 49, 62, 75, 88, 101].findIndex(
      (b, i) =>
        i % 2 === actor.index && field.tick >= b - 5 && field.tick < b + 9,
    );
    pose =
      beat < 0 ? "guard" : ["jab", "hook", "uppercut"][Math.floor(beat / 2)];
  } else if (actor.kind === "dancer") {
    const beat = [48, 70, 92, 104].findIndex(
      (b, i) =>
        i % 2 === actor.index && field.tick >= b - 6 && field.tick < b + 10,
    );
    pose = beat < 0 ? "present" : beat >= 2 ? "push" : "kick";
    height *= pose === "push" ? 370 / 388 : pose === "kick" ? 392 / 388 : 1;
  } else if (actor.kind === "handchain") {
    pose = `ring-${["a", "b", "c", "d"][reducedMotion ? 0 : Math.floor(actor.age / 7) % 4]}`;
  } else if (actor.kind === "curtain") pose = "curtain";
  else if (actor.kind === "supporter")
    pose = ["man-a", "woman-a", "man-b", "woman-b"][actor.index];
  return pose ? { pose, height, facing } : undefined;
}

function drawHelper(
  ctx: CanvasRenderingContext2D,
  images: Images,
  field: FieldFinaleState,
  actor: ArenaFinaleActor,
  reducedMotion: boolean,
) {
  ctx.save();
  ctx.globalAlpha *= Math.min(
    unit(actor.age / 5),
    unit(actor.life / 12),
    opacity(field),
  );
  if (actor.kind !== "curtain")
    shadow(
      ctx,
      actor.x,
      actor.y,
      actor.kind === "horse" || actor.kind === "truck" ? 75 : 36,
    );
  if (actor.kind === "courier" && images[courier.file]?.width) {
    const frame =
        courier.frames[
          reducedMotion
            ? 0
            : (Math.floor(actor.age / 5) + actor.index) % courier.frameCount
        ],
      scale = actor.height / courier.bodyHeight;
    ctx.translate(actor.x, actor.y);
    ctx.scale(actor.direction, 1);
    ctx.drawImage(
      images[courier.file],
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      -frame.width * 0.62 * scale,
      -courier.baseline * scale,
      frame.width * scale,
      frame.height * scale,
    );
  } else {
    const pose = arenaHelperPose(field, actor, reducedMotion);
    const painted =
      pose &&
      drawAttackArt(
        ctx,
        images,
        field.fighter,
        pose.pose,
        actor.x,
        actor.y,
        pose.height,
        pose.facing,
      );
    if (!painted) {
      // A failed optional atlas must not turn a real hitbox into an invisible attack.
      collisionFallback(
        ctx,
        actor.x,
        actor.y,
        actor.direction,
        arenaActorReach(actor),
      );
    }
  }
  ctx.restore();
}

/** Backdrop props share arena coordinates; no fit-to-screen camera or defender copy. */
export function drawArenaFinaleLayer(
  ctx: CanvasRenderingContext2D,
  images: Images,
  state: MatchState,
  layer: "back" | "front",
  reducedMotion = false,
) {
  for (const field of state.fieldFinales ?? []) {
    if (!isArenaFinalist(field.fighter)) continue;
    const p = state.players[field.owner],
      active = activeArenaPerformance(state, p) === field;
    ctx.save();
    if (layer === "back") {
      ctx.globalAlpha *= opacity(field);
      const pose = active && mountedFinale(field) && arenaPerformerPose(field);
      if (pose && !hasAttackArt(images, field.fighter, [pose.pose]))
        collisionFallback(
          ctx,
          p.x,
          p.y,
          field.direction,
          arenaMountReach(field),
        );
      if (field.fighter === "ali" && !field.cancelled) {
        const anchor = clamp(
          field.x - field.direction * 135,
          WORLD.left + 135,
          WORLD.right - 135,
        );
        for (let i = 0; i < 6; i++)
          drawAttackArt(
            ctx,
            images,
            "ali",
            `choir-${"abcdef"[i]}`,
            anchor + field.direction * (i - 2.5) * 39,
            WORLD.floor,
            174,
            field.direction,
          );
      }
      if (field.fighter === "dudamel" && !field.cancelled)
        drawAttackArt(
          ctx,
          images,
          "dudamel",
          "orchestra",
          clamp(
            field.x - field.direction * 95,
            WORLD.left + 200,
            WORLD.right - 200,
          ),
          WORLD.floor,
          186,
          field.direction,
        );
      if (field.fighter === "bolivar" && active && field.tick >= 92)
        drawAttackArt(
          ctx,
          images,
          "bolivar",
          "horse",
          p.x + field.direction * (40 + (field.tick - 92) * 6),
          p.y,
          166,
          field.direction,
          unit((104 - field.tick) / 12),
        );
      if (field.fighter === "chataing" && !field.cancelled && field.tick < 50) {
        const x = field.caught?.x ?? field.x + field.direction * 105,
          y = field.caught?.y ?? field.y;
        const painted = drawAttackArt(
          ctx,
          images,
          "chataing",
          "screen",
          x,
          y,
          177,
          field.direction,
        );
        if (!painted)
          collisionFallback(ctx, x, y, field.direction, {
            offset: 0,
            halfWidth: 62,
            top: 162,
            feetOffset: 0,
            bottom: 0,
          });
      }
      if (field.fighter === "llorona" && active && field.tick >= 8)
        drawAttackArt(
          ctx,
          images,
          "llorona",
          "portal",
          p.x + field.direction * 48,
          p.y + 6,
          54,
          field.direction,
        );
    }
    ctx.restore();
    for (const actor of field.actors ?? []) {
      const depth =
        actor.kind === "supporter"
          ? "back"
          : actor.kind === "curtain" || actor.index % 3 === 2
            ? "front"
            : "back";
      if (depth === layer) drawHelper(ctx, images, field, actor, reducedMotion);
    }
    if (
      layer === "front" &&
      field.fighter === "melanio" &&
      active &&
      field.tick >= 20 &&
      field.tick < 26
    ) {
      ctx.save();
      ctx.globalAlpha *= 0.23 * (1 - (field.tick - 20) / 6);
      ctx.fillStyle = "#fff5d9";
      ctx.beginPath();
      ctx.moveTo(p.x + field.direction * 25, p.y - 115);
      ctx.lineTo(p.x + field.direction * 128, p.y - 163);
      ctx.lineTo(p.x + field.direction * 128, p.y - 38);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Painted notes stay centred on the projectile's physical circle, even on reflection. */
export function drawArenaFinaleProjectile(
  ctx: CanvasRenderingContext2D,
  images: Images,
  shot: Projectile,
) {
  if (!shot.finaleArt) return false;
  const { fighter, pose, height } = shot.finaleArt;
  if (!hasAttackArt(images, fighter, [pose])) return false;
  const f = ATTACK_ART[fighter].frames[pose],
    scale = height / (f.bodyHeight ?? f.height);
  return drawAttackArt(
    ctx,
    images,
    fighter,
    pose,
    (f.anchorX - f.width / 2) * scale,
    ((f.anchorY ?? f.height) - f.height / 2) * scale,
    height,
  );
}
