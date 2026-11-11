// The caster's own movement during an arena definitive, and the helpers,
// waves and projectiles each fighter's definitive releases on its cues.
import { WORLD } from "../arena";
import { DORANGEL_POT } from "./dorangel";
import { advanceInakiFinale } from "./inaki";
import type { MatchState, PlayerState } from "../engine";
import type { FieldFinaleState } from "./field-finales";
import {
  COUTURE_MODEL_CUES,
  COUTURE_MODEL_HEIGHT,
  COUTURE_MODEL_SPEED,
  coutureModelStart,
} from "./couture-runway";
import { PLAYERS } from "../types";
import {
  ARENA_FINALES,
  ARENA_FINALE_CUES,
  clamp,
  rideMoving,
  rideSpeed,
  type ArenaFinaleActor,
  type ArenaFinalist,
} from "./arena-finale-specs";

function spawnActor(
  state: MatchState,
  field: FieldFinaleState,
  kind: ArenaFinaleActor["kind"],
  index: number,
  height: number,
  speed: number,
  x = field.x,
  y = field.y,
  goalX?: number,
) {
  const actor: ArenaFinaleActor = {
    id: state.nextId++,
    kind,
    index,
    x,
    y,
    previousX: x,
    previousY: y,
    vx: field.direction * speed,
    vy: 0,
    age: 0,
    life: 160,
    direction: field.direction,
    height,
    connected: false,
    ...(goalX === undefined ? {} : { goalX }),
  };
  (field.actors ??= []).push(actor);
  return actor;
}

function fireWave(
  state: MatchState,
  field: FieldFinaleState,
  index: number,
  count: number,
) {
  const p = state.players[field.owner],
    note = field.fighter === "oscar",
    scold = field.fighter === "javier";
  state.projectiles.push({
    id: state.nextId++,
    owner: field.owner,
    direction: field.direction,
    x: p.x + field.direction * 44,
    y: p.y - (note ? 94 : 100),
    vx: field.direction * (scold ? 7 : 9),
    age: 0,
    life: scold ? 22 : 100,
    kind: note
      ? "finale-note"
      : scold
        ? "broadcast"
        : field.fighter === "dudamel"
          ? "cadenza"
          : "sonic",
    impact: "super",
    radius: note ? 15 : 20,
    ...(note || scold ? {} : { growth: 0.25 }),
    maxRadius: 40,
    force: index === count - 1 ? 7 : 2.6,
    damage: field.damage / count,
    hitInvincibility: 5,
    ...(note
      ? {
          finaleArt: {
            fighter: "oscar" as const,
            pose: index === 1 ? "note-pair" : "note",
            height: 38,
          },
        }
      : {}),
  });
}

/** End, cancel or steer the caster's performance for this tick. */
export function steerArenaCaster(
  field: FieldFinaleState,
  spec: (typeof ARENA_FINALES)[ArenaFinalist],
  p: PlayerState,
  tick: number,
) {
  if (tick < spec.recovery && (p.attack !== "super" || p.stun || !p.grounded)) {
    field.cancelled = true;
    if (p.attack === "super") p.attack = null;
    p.cooldown = Math.min(p.cooldown, Math.max(12, p.stun));
  }
  if (!field.cancelled && tick >= spec.recovery && p.attack === "super") {
    p.attack = null;
    p.cooldown = 0;
    if (spec.riding) {
      p.vx = 0;
      p.recoilVx = 0;
    }
  }
  if (!field.cancelled && spec.riding && p.attack === "super") {
    p.vx = rideMoving(field)
      ? clamp(
          p.x + field.direction * rideSpeed(field.fighter),
          WORLD.left + 35,
          WORLD.right - 35,
        ) - p.x
      : 0;
    p.recoilVx = 0;
    p.facing = field.direction;
  }
}

/** Release whatever this fighter's definitive spawns on the current tick. */
export function spawnArenaCast(
  state: MatchState,
  field: FieldFinaleState,
  p: PlayerState,
  target: PlayerState,
  tick: number,
) {
  advanceInakiFinale(state, field);
  if (field.fighter === "dorangel" && tick === DORANGEL_POT.spawnTick) {
    const pot = spawnActor(
      state,
      field,
      "pot",
      0,
      DORANGEL_POT.height,
      0,
      clamp(
        p.x + field.direction * DORANGEL_POT.offset,
        WORLD.left + 80,
        WORLD.right - 80,
      ),
      p.y,
    );
    // Aim once, keeping the bowl clear of its caster and within arm's reach.
    // A fixed 105px placement left a blind spot at body-contact distance.
    pot.placementOffset = clamp(
      (target.x - p.x) * field.direction,
      DORANGEL_POT.minOffset,
      DORANGEL_POT.offset,
    );
    pot.life = field.duration - tick;
  }
  if (field.fighter === "carolina") {
    const index = COUTURE_MODEL_CUES.findIndex((cue) => cue === tick);
    if (index !== -1)
      spawnActor(
        state,
        field,
        "model",
        index,
        COUTURE_MODEL_HEIGHT,
        COUTURE_MODEL_SPEED,
        coutureModelStart(field),
      ).life = ARENA_FINALES.carolina.duration;
  }
  if (
    field.fighter === "bolivar" &&
    tick >= 23 &&
    tick <= 78 &&
    (tick - 23) % 11 === 0
  )
    spawnActor(state, field, "horse", (tick - 23) / 11, 218, 7.2);
  if (field.fighter === "gomez" && (tick === 29 || tick === 51))
    spawnActor(state, field, "horse", tick === 29 ? 0 : 1, 204, 7.2);
  if (field.fighter === "zavarce" && tick <= 72 && tick % 12 === 0)
    spawnActor(state, field, "courier", tick / 12, 154, 8.2);
  if (field.fighter === "lorenzo" && (tick === 28 || tick === 48))
    spawnActor(state, field, "truck", tick === 28 ? 0 : 1, 236, 5.8);
  if (field.fighter === "mcm" && tick === 0)
    for (let i = 0; i < 4; i++)
      spawnActor(
        state,
        field,
        "supporter",
        i,
        166,
        0,
        field.x - field.direction * (80 + i * 43),
      );
  if (field.fighter === "simon" && [12, 32, 52].includes(tick))
    spawnActor(state, field, "woodhorse", (tick - 12) / 20, 126, 7);
  if (
    (field.fighter === "vallenilla" || field.fighter === "renny") &&
    tick === 0
  ) {
    const distance = clamp((target.x - field.x) * field.direction, 100, 310);
    for (const i of PLAYERS) {
      const x = field.x - field.direction * (i * 45),
        goal = field.x + field.direction * (distance - (i ? -60 : 60));
      spawnActor(
        state,
        field,
        field.fighter === "vallenilla" ? "mascot" : "dancer",
        i,
        field.fighter === "vallenilla" ? 126 : 230,
        5.5,
        x,
        field.y,
        goal,
      );
    }
  }
  if (field.fighter === "puma" && tick === 12)
    spawnActor(state, field, "handchain", 0, 190, 5.5);
  if (field.fighter === "george" && tick === 12) {
    const actor = spawnActor(
      state,
      field,
      "curtain",
      0,
      238,
      0,
      field.x + field.direction * 160,
      field.y - 230,
    );
    actor.vy = 4;
  }
  if (["oscar", "ali", "dudamel", "javier"].includes(field.fighter)) {
    const index = [12, 36, 60].indexOf(tick);
    if (index !== -1) fireWave(state, field, index, 3);
  }
  if (field.fighter === "kevin") {
    const cues = ARENA_FINALE_CUES.kevin,
      index = cues.indexOf(tick);
    if (index !== -1)
      state.projectiles.push({
        id: state.nextId++,
        owner: field.owner,
        direction: field.direction,
        x: p.x + field.direction * 48,
        y: p.y - (index % 2 ? 84 : 112),
        vx: field.direction * 9.5,
        age: 0,
        life: 80,
        kind: "remittance",
        impact: "super",
        radius: 17,
        damage: field.damage / cues.length,
        force: index === cues.length - 1 ? 7 : 2.6,
        hitInvincibility: 5,
        finaleArt: {
          fighter: "kevin",
          pose: index % 2 ? "receipt" : "token",
          height: 34,
        },
      });
  }
}
