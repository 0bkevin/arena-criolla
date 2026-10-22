import {
  DORANGEL_POT,
  DORANGEL_BITE,
  dorangelPot,
  dorangelPotIsHot,
  insideDorangelPot,
} from "../../../shared/dorangel";
import type { ArenaFinaleActor } from "../../../shared/arena-finales";
import type { MatchState, PlayerState } from "../../../shared/engine";
import type { FieldFinaleState } from "../../../shared/field-finales";
import { WORLD } from "../../../shared/arena";
import { FINALE_CAPTURE_TICK } from "../../../shared/finales";
import { ATTACK_ART, drawAttackArt } from "../attack-art";
import { TECHNIQUES } from "../../../shared/techniques";

type Images = Record<string, HTMLImageElement>;
const unit = (value: number) => Math.max(0, Math.min(1, value));

/** Crouching and leaning keep the same scale as the upright native body. */
export function dorangelPoseHeight(pose: string, height: number) {
  const frames = ATTACK_ART.dorangel.frames;
  const reference =
    frames[pose.startsWith("bite-") ? "bite-ready" : "cook-finish"];
  const frame = frames[pose];
  return reference?.bodyHeight && frame?.bodyHeight
    ? (height * frame.bodyHeight) / reference.bodyHeight
    : height;
}

export function drawDorangelBite(
  ctx: CanvasRenderingContext2D,
  images: Images,
  player: PlayerState,
  height: number,
  reduced = false,
  rival?: PlayerState,
) {
  if (
    player.config.fighter !== "dorangel" ||
    player.attack !== "special" ||
    player.stun
  )
    return false;
  const tick = player.attackTick;
  const cues = TECHNIQUES.bite.pulses!.map(
    (pulse) => TECHNIQUES.bite.startup + pulse,
  );
  const last = cues.filter((cue) => cue <= tick).at(-1);
  const contact = last !== undefined && tick - last < (reduced ? 12 : 9);
  const pose =
    tick < DORANGEL_BITE.approachStart
      ? "bite-ready"
      : contact && rival?.rootKind === "bite"
        ? "bite-close"
        : cues.some((cue) => cue > tick) || contact
          ? "bite-reach"
          : "bite-release";
  return drawAttackArt(
    ctx,
    images,
    "dorangel",
    pose,
    player.x,
    player.y,
    dorangelPoseHeight(pose, height),
    player.facing,
  );
}

export function drawDorangelPickUp(
  ctx: CanvasRenderingContext2D,
  images: Images,
  player: PlayerState,
  height: number,
) {
  if (
    player.config.fighter !== "dorangel" ||
    player.attack !== "super" ||
    player.attackTick >= FINALE_CAPTURE_TICK ||
    player.stun ||
    !player.grounded
  )
    return false;
  const pose = player.attackTick < 4 ? "cook-place" : "cook-lower";
  const pot = {
    x: Math.max(
      WORLD.left + 80,
      Math.min(
        WORLD.right - 80,
        player.x + player.facing * DORANGEL_POT.carryOffset,
      ),
    ),
    y:
      player.y -
      DORANGEL_POT.carryLift * unit(player.attackTick / FINALE_CAPTURE_TICK),
    height: DORANGEL_POT.height,
  };
  potBody(ctx, images, pot);
  const painted = drawAttackArt(
    ctx,
    images,
    "dorangel",
    pose,
    player.x,
    player.y,
    dorangelPoseHeight(pose, height),
    player.facing,
  );
  drawDorangelPotFront(ctx, images, pot);
  return painted;
}

export function dorangelCookingPose(tick: number, reduced = false) {
  if (tick < 8) return "cook-carry";
  if (tick < 16) return "cook-lower";
  if (tick < 30) return "cook-place";
  if (tick < DORANGEL_POT.fireTick) return "cook-light-a";
  if (tick < DORANGEL_POT.stirTick) return "cook-light-b";
  if (tick >= DORANGEL_POT.finishTick) return "cook-finish";
  return reduced || Math.floor((tick - DORANGEL_POT.stirTick) / 11) % 2 === 0
    ? "cook-stir-a"
    : "cook-stir-b";
}

/** React with the defender's own body; a jump immediately restores locomotion. */
export function dorangelHeatReaction(
  state: MatchState,
  player: PlayerState,
  reduced = false,
) {
  if (!player.grounded) return;
  const field = state.fieldFinales?.find(
    (candidate) =>
      state.players[candidate.owner] !== player &&
      dorangelPotIsHot(candidate) &&
      insideDorangelPot(candidate, player),
  );
  if (!field) return;
  const pot = dorangelPot(field)!;
  const age = Math.max(0, DORANGEL_POT.snareTicks - player.rootTicks);
  // The bowl keeps occluding legs between damage pulses without extending the grip.
  const passive =
    player.rootKind === "pot" &&
    player.rootTicks > 0 &&
    !player.attack &&
    !player.blocking;
  return {
    frame: passive ? (reduced || age < 7 ? 7 : 1) : undefined,
    lift:
      reduced || !passive
        ? 0
        : -Math.sin(unit(age / DORANGEL_POT.snareTicks) * Math.PI) * 1.5,
    lipY:
      pot.y -
      DORANGEL_POT.hearthHeight -
      (pot.height - DORANGEL_POT.hearthHeight) * 0.78 +
      DORANGEL_POT.potInset,
  };
}

function potBody(
  ctx: CanvasRenderingContext2D,
  images: Images,
  actor: Pick<ArenaFinaleActor, "x" | "y" | "height">,
) {
  const feet = actor.y - DORANGEL_POT.hearthHeight + DORANGEL_POT.potInset;
  const height = actor.height - DORANGEL_POT.hearthHeight;
  if (!drawAttackArt(ctx, images, "dorangel", "pot", actor.x, feet, height)) {
    ctx.fillStyle = "#7d858d";
    ctx.strokeStyle = "#d1d4d3";
    ctx.beginPath();
    ctx.rect(actor.x - 67, feet - height, 134, height);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawDorangelPotBack(
  ctx: CanvasRenderingContext2D,
  images: Images,
  field: FieldFinaleState,
  actor: ArenaFinaleActor,
  source: PlayerState,
  reduced = false,
) {
  ctx.save();
  ctx.globalAlpha *= unit(actor.life / 12);
  const carried = field.tick < DORANGEL_POT.placeTick;
  const hearthX = carried
    ? Math.max(
        WORLD.left + 80,
        Math.min(
          WORLD.right - 80,
          source.x +
            field.direction * (actor.placementOffset ?? DORANGEL_POT.offset),
        ),
      )
    : actor.x;
  const hearthY = carried ? source.y : actor.y;
  if (!carried || !field.cancelled)
    drawAttackArt(
      ctx,
      images,
      "dorangel",
      "hearth",
      hearthX,
      hearthY,
      DORANGEL_POT.hearthHeight,
    );
  if (
    !field.cancelled &&
    field.tick >= DORANGEL_POT.fireTick &&
    field.tick < DORANGEL_POT.finishTick
  )
    drawAttackArt(
      ctx,
      images,
      "dorangel",
      "flame",
      actor.x,
      actor.y - 3,
      reduced ? 32 : 32 + Math.sin(field.tick / 3) * 2,
    );
  potBody(ctx, images, actor);
  if (dorangelPotIsHot(field))
    drawAttackArt(
      ctx,
      images,
      "dorangel",
      "steam",
      actor.x,
      actor.y - actor.height + 18,
      reduced ? 42 : 42 + Math.sin(field.tick / 7) * 4,
      1,
      0.6,
    );
  ctx.restore();
}

/** The back rim precedes the body; the front rim hides its legs without moving them. */
export function drawDorangelPotFront(
  ctx: CanvasRenderingContext2D,
  images: Images,
  actor: Pick<ArenaFinaleActor, "x" | "y" | "height">,
) {
  const height = actor.height - DORANGEL_POT.hearthHeight;
  const feet = actor.y - DORANGEL_POT.hearthHeight + DORANGEL_POT.potInset;
  ctx.save();
  ctx.beginPath();
  ctx.rect(actor.x - 200, feet - height * 0.78, 400, height + 20);
  ctx.clip();
  potBody(ctx, images, actor);
  ctx.restore();
}
