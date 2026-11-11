// Helper actors' motion: carried pots, falling curtains, runway models and
// everything that walks, rides or drives on the arena's surfaces.
import { WORLD } from "../arena";
import { DORANGEL_POT } from "./dorangel";
import { platformsAtTick } from "../../roster/roster";
import type { MatchState, PlayerState } from "../engine";
import type { FieldFinaleState } from "./field-finales";
import { COUTURE_MODEL_SPEED, coutureModelEnd } from "./couture-runway";
import {
  rideMoving,
  rideSpeed,
  type ArenaFinaleActor,
} from "./arena-finale-specs";
import { clamp } from "../../math";

/** Helpers use the same gravity, one-way surfaces and arena floor as fighters. */
function moveGroundActor(
  actor: ArenaFinaleActor,
  surfaces: ReturnType<typeof platformsAtTick>,
  priorSurfaces: ReturnType<typeof platformsAtTick>,
) {
  if (actor.supportPlatform !== undefined && actor.supportPlatform >= 0) {
    const prior = priorSurfaces[actor.supportPlatform],
      current = surfaces[actor.supportPlatform];
    if (prior && current && Math.abs(actor.y - prior.y) < 2) {
      actor.x += current.x - prior.x;
      actor.y += current.y - prior.y;
    }
  }
  const oldY = actor.y;
  actor.x += actor.vx;
  actor.vy += 0.52;
  actor.y += actor.vy;
  delete actor.supportPlatform;
  for (const [index, surface] of [
    ...surfaces,
    { x: WORLD.left, y: WORLD.floor, width: WORLD.right - WORLD.left },
  ].entries()) {
    if (
      actor.vy >= 0 &&
      oldY <= surface.y + 2 &&
      actor.y >= surface.y &&
      actor.x >= surface.x &&
      actor.x <= surface.x + surface.width
    ) {
      actor.y = surface.y;
      actor.vy = 0;
      actor.supportPlatform = index === surfaces.length ? -1 : index;
      break;
    }
  }
}

/** Move every helper one tick and drop the ones that have left the arena. */
export function advanceArenaActors(
  state: MatchState,
  field: FieldFinaleState,
  p: PlayerState,
  tick: number,
) {
  const surfaces = field.actors?.length
      ? platformsAtTick(state.stage, state.tick)
      : [],
    priorSurfaces = field.actors?.length
      ? platformsAtTick(state.stage, state.tick - 1)
      : [];
  field.actors = field.actors?.filter((actor) =>
    advanceActor(field, actor, p, tick, surfaces, priorSurfaces),
  );
}

function advanceActor(
  field: FieldFinaleState,
  actor: ArenaFinaleActor,
  p: PlayerState,
  tick: number,
  surfaces: ReturnType<typeof platformsAtTick>,
  priorSurfaces: ReturnType<typeof platformsAtTick>,
): boolean {
  actor.previousX = actor.x;
  actor.previousY = actor.y;
  actor.age++;
  actor.life--;
  if (actor.kind === "pot" && field.cancelled)
    actor.life = Math.min(actor.life, 12);
  if (
    actor.kind === "pot" &&
    !field.cancelled &&
    tick <= DORANGEL_POT.placeTick
  ) {
    const progress = clamp(
      (tick - DORANGEL_POT.spawnTick) /
        (DORANGEL_POT.placeTick - DORANGEL_POT.spawnTick),
      0,
      1,
    );
    const lower = progress * progress * (3 - 2 * progress);
    const offset =
      DORANGEL_POT.carryOffset +
      ((actor.placementOffset ?? DORANGEL_POT.offset) -
        DORANGEL_POT.carryOffset) *
        lower;
    actor.x = clamp(
      p.x + field.direction * offset,
      WORLD.left + 80,
      WORLD.right - 80,
    );
    actor.y = p.y - DORANGEL_POT.carryLift * (1 - lower);
    actor.vx = 0;
    actor.vy = 0;
    delete actor.supportPlatform;
    if (tick < DORANGEL_POT.placeTick) return actor.life > 0;
  }
  if (actor.kind === "curtain") {
    if (tick >= 75) actor.vy = -9;
    else actor.vy = Math.min(14, actor.vy + 0.7);
    const nextY = actor.y + actor.vy;
    const support = [
      ...surfaces,
      { x: WORLD.left, y: WORLD.floor, width: WORLD.right - WORLD.left },
    ].find(
      (surface) =>
        actor.x >= surface.x &&
        actor.x <= surface.x + surface.width &&
        actor.y <= surface.y + 2 &&
        nextY >= surface.y,
    );
    actor.y = actor.vy >= 0 && support ? support.y : nextY;
    if (actor.vy >= 0 && support) actor.vy = 0;
  } else {
    if (actor.kind === "model") {
      const end = coutureModelEnd(field);
      actor.vx =
        actor.direction *
        Math.min(COUTURE_MODEL_SPEED, Math.abs(end - actor.x));
      if (Math.abs(end - actor.x) <= COUTURE_MODEL_SPEED)
        actor.life = Math.min(actor.life, 12);
      // This temporary walkway supports its models, just as Dayana's does.
      // Other fighters keep their ordinary movement and platform physics.
      actor.x += actor.vx;
      actor.y = field.y;
      actor.vy = 0;
      return actor.life > 0;
    }
    if (actor.kind === "supporter")
      actor.vx = rideMoving(field)
        ? field.direction * rideSpeed(field.fighter)
        : 0;
    if (
      actor.goalX !== undefined &&
      (actor.goalX - actor.x) * field.direction <= Math.abs(actor.vx)
    ) {
      actor.x = actor.goalX;
      actor.vx = 0;
      actor.direction = actor.index === 1 ? -field.direction : field.direction;
    }
    if (actor.kind === "handchain" && actor.caughtTick !== undefined)
      actor.vx = 0;
    moveGroundActor(actor, surfaces, priorSurfaces);
  }
  // A helper may leave naturally after contact; touching does not erase its artwork.
  return (
    actor.life > 0 &&
    actor.x > WORLD.x - 220 &&
    actor.x < WORLD.x + WORLD.width + 220 &&
    actor.y < WORLD.y + WORLD.height + 180
  );
}
