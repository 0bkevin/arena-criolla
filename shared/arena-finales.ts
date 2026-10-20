import { WORLD } from "./arena";
import { platformsAtTick, type FighterId } from "./content";
import type { MatchState, PlayerState } from "./engine";
import type { FieldFinaleState } from "./field-finales";

/** The authored batch. The other roster finales retain their existing rules. */
export const REVIEWED_FINALISTS = [
  "bolivar",
  "gomez",
  "zavarce",
  "vallenilla",
  "javier",
  "renny",
  "simon",
  "conde",
  "emilio",
  "maite",
  "oscar",
  "puma",
  "chataing",
  "george",
  "mcm",
  "ali",
  "melanio",
  "dayana",
  "lorenzo",
  "dudamel",
  "llorona",
  "deyna",
] as const satisfies readonly FighterId[];

export const ARENA_FINALES = {
  bolivar: { duration: 220, recovery: 104, riding: true },
  gomez: { duration: 180, recovery: 104, riding: true },
  zavarce: { duration: 210, recovery: 24, riding: false },
  vallenilla: { duration: 126, recovery: 30, riding: false },
  javier: { duration: 78, recovery: 78, riding: false },
  renny: { duration: 126, recovery: 90, riding: false },
  simon: { duration: 155, recovery: 68, riding: false },
  oscar: { duration: 96, recovery: 84, riding: false },
  puma: { duration: 125, recovery: 30, riding: false },
  chataing: { duration: 70, recovery: 68, riding: false },
  george: { duration: 112, recovery: 52, riding: false },
  mcm: { duration: 130, recovery: 96, riding: true },
  ali: { duration: 98, recovery: 84, riding: false },
  melanio: { duration: 76, recovery: 74, riding: false },
  lorenzo: { duration: 185, recovery: 96, riding: true },
  dudamel: { duration: 102, recovery: 90, riding: false },
  llorona: { duration: 80, recovery: 76, riding: false },
} as const;
export type ArenaFinalist = keyof typeof ARENA_FINALES;
/** Emission/gesture cues for sound, never guaranteed damage times. */
export const ARENA_FINALE_CUES: Record<ArenaFinalist, readonly number[]> = {
  bolivar: [12, 23, 34, 45, 56, 67, 78],
  gomez: [12, 29, 51],
  zavarce: [0, 12, 24, 36, 48, 60, 72],
  vallenilla: [36, 49, 62, 75, 88, 101],
  javier: [12, 36, 60],
  renny: [48, 70, 92, 104],
  simon: [12, 32, 52],
  oscar: [12, 36, 60],
  puma: [12, 36],
  chataing: [14, 44],
  george: [28],
  mcm: [12],
  ali: [12, 36, 60],
  melanio: [20, 48],
  lorenzo: [12, 28, 48],
  dudamel: [12, 36, 60],
  llorona: [18, 38, 58],
};
export const isArenaFinalist = (id: FighterId): id is ArenaFinalist =>
  Object.prototype.hasOwnProperty.call(ARENA_FINALES, id);

export interface ArenaFinaleActor {
  id: number;
  kind:
    | "courier"
    | "horse"
    | "truck"
    | "mascot"
    | "dancer"
    | "woodhorse"
    | "handchain"
    | "curtain"
    | "supporter";
  index: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  direction: number;
  height: number;
  connected: boolean;
  goalX?: number;
  caughtTick?: number;
  supportPlatform?: number;
}

export interface ArenaContact {
  field: FieldFinaleState;
  actor?: ArenaFinaleActor;
  owner: 0 | 1;
  damage: number;
  force: number;
  direction: number;
  x: number;
  y: number;
  rootTicks?: number;
}

/** Painted leading edges, shared with the visible fallback when an atlas fails. */
export function arenaActorReach(actor: ArenaFinaleActor) {
  const melee = actor.kind === "mascot" || actor.kind === "dancer";
  return {
    offset: melee
      ? 38
      : actor.kind === "horse"
        ? 88
        : actor.kind === "courier"
          ? 77
          : actor.kind === "truck"
            ? 100
            : 0,
    halfWidth: melee
      ? 42
      : actor.kind === "curtain"
        ? 100
        : actor.kind === "truck"
          ? 75
          : actor.kind === "handchain"
            ? actor.caughtTick === undefined
              ? 85
              : 105
            : 32,
    top: melee
      ? 155
      : actor.kind === "curtain"
        ? 24
        : actor.kind === "truck"
          ? 160
          : actor.kind === "woodhorse"
            ? 105
            : actor.kind === "handchain" && actor.caughtTick !== undefined
              ? 165
              : 140,
    feetOffset: actor.kind === "curtain" ? 12 : 0,
    bottom: actor.kind === "curtain" ? 0 : melee ? 8 : 10,
  };
}

export function arenaMountReach(field: FieldFinaleState) {
  const truck = field.fighter === "mcm" || field.fighter === "lorenzo";
  return {
    offset: truck ? (field.fighter === "mcm" ? 175 : 98) : 88,
    halfWidth: truck ? (field.fighter === "mcm" ? 140 : 90) : 35,
    top: truck ? 165 : 145,
    feetOffset: 0,
    bottom: 8,
  };
}

export const mountedFinale = (field: FieldFinaleState) =>
  isArenaFinalist(field.fighter) && ARENA_FINALES[field.fighter].riding;

export function activeArenaPerformance(state: MatchState, player: PlayerState) {
  return state.fieldFinales?.find(
    (f) =>
      isArenaFinalist(f.fighter) &&
      state.players[f.owner] === player &&
      !f.cancelled &&
      f.tick < ARENA_FINALES[f.fighter].recovery &&
      player.attack === "super" &&
      !player.stun,
  );
}

export function cancelArenaPerformance(state: MatchState, player: PlayerState) {
  const field = activeArenaPerformance(state, player);
  if (!field) return;
  field.cancelled = true;
  player.attack = null;
  player.cooldown = Math.min(player.cooldown, 12);
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rideSpeed = (id: FighterId) =>
  id === "bolivar" || id === "gomez" ? 7.2 : 5.8;
export const rideMoving = (field: FieldFinaleState) =>
  !field.cancelled && field.tick >= 12 && field.tick < 88;

export function arenaFinaleInRange(player: PlayerState, target: PlayerState) {
  if (!player.grounded || Math.abs(player.y - target.y) > 125) return false;
  const id = player.config.fighter,
    distance = Math.abs(target.x - player.x);
  const reach =
    id === "llorona" || id === "melanio"
      ? 115
      : id === "chataing"
        ? 170
        : id === "javier"
          ? 210
          : id === "george"
            ? 250
            : id === "vallenilla" || id === "renny" || id === "puma"
              ? 330
              : 620;
  return distance < reach;
}

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
    kind: note ? "finale-note" : scold ? "broadcast" : "sonic",
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

/** Only creates spatial attacks. Nothing in this module changes the rival's HP. */
export function advanceArenaFinale(state: MatchState, field: FieldFinaleState) {
  if (!isArenaFinalist(field.fighter)) return;
  const spec = ARENA_FINALES[field.fighter],
    p = state.players[field.owner],
    target = state.players[1 - field.owner],
    tick = field.tick;
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
  if (!field.cancelled) {
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
      for (let i = 0; i < 2; i++) {
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
  }
  if (field.caught && target.rootTicks && target.rootKind === "screen")
    field.caught = { x: target.x, y: target.y };
  const surfaces = field.actors?.length
      ? platformsAtTick(state.stage, state.tick)
      : [],
    priorSurfaces = field.actors?.length
      ? platformsAtTick(state.stage, state.tick - 1)
      : [];
  field.actors = field.actors?.filter((actor) => {
    actor.previousX = actor.x;
    actor.previousY = actor.y;
    actor.age++;
    actor.life--;
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
        actor.direction =
          actor.index === 1 ? -field.direction : field.direction;
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
  });
}

/** The body rectangle is deliberately smaller than capes, swords and feather tips. */
function overlaps(
  target: PlayerState,
  x: number,
  feet: number,
  halfWidth: number,
  top: number,
  bottom = 8,
  previousX = x,
  previousFeet = feet,
) {
  return (
    target.x + 22 >= Math.min(x, previousX) - halfWidth &&
    target.x - 22 <= Math.max(x, previousX) + halfWidth &&
    target.y >= Math.min(feet, previousFeet) - top &&
    target.y - 145 <= Math.max(feet, previousFeet) - bottom
  );
}

export function arenaFinaleContacts(state: MatchState): ArenaContact[] {
  const contacts: ArenaContact[] = [];
  for (const field of state.fieldFinales ?? []) {
    if (!isArenaFinalist(field.fighter)) continue;
    const target = state.players[1 - field.owner],
      p = state.players[field.owner],
      active = activeArenaPerformance(state, p) === field;
    const offer = (
      fraction: number,
      force: number,
      x: number,
      y: number,
      direction = field.direction,
      actor?: ArenaFinaleActor,
      rootTicks?: number,
    ) =>
      contacts.push({
        field,
        actor,
        owner: field.owner,
        damage: field.damage * fraction,
        force,
        direction,
        x,
        y,
        rootTicks,
      });
    if (
      active &&
      mountedFinale(field) &&
      rideMoving(field) &&
      !field.connected
    ) {
      const reach = arenaMountReach(field);
      if (
        overlaps(
          target,
          p.x + field.direction * reach.offset,
          p.y,
          reach.halfWidth,
          reach.top,
        )
      )
        offer(
          field.fighter === "bolivar"
            ? 1 / 7
            : field.fighter === "gomez" || field.fighter === "lorenzo"
              ? 1 / 3
              : 1,
          4.5,
          target.x,
          target.y - 75,
        );
    }
    for (const actor of field.actors ?? []) {
      if (actor.kind === "supporter") continue;
      if (actor.kind === "mascot" || actor.kind === "dancer") {
        const beats =
            actor.kind === "mascot"
              ? [36, 49, 62, 75, 88, 101]
              : [48, 70, 92, 104],
          beat = beats.indexOf(field.tick);
        if (beat !== -1 && beat % 2 === actor.index) {
          const x = actor.x + actor.direction * 38;
          if (overlaps(target, x, actor.y, 42, 155))
            offer(
              actor.kind === "mascot" ? 1 / 6 : 1 / 4,
              beat === beats.length - 1 ? 6 : 1.8,
              target.x,
              target.y - 80,
              actor.direction,
              actor,
            );
        }
        continue;
      }
      if (actor.kind === "handchain" && actor.caughtTick !== undefined) {
        if (
          field.tick === actor.caughtTick + 24 &&
          overlaps(target, actor.x, actor.y, 105, 165)
        )
          offer(0.75, 19, target.x, target.y - 70, actor.direction, actor);
        continue;
      }
      if (actor.connected) continue;
      if (actor.kind === "curtain") {
        if (
          field.tick < 75 &&
          overlaps(
            target,
            actor.x,
            actor.y + 12,
            100,
            24,
            0,
            actor.previousX,
            actor.previousY + 12,
          )
        )
          offer(1, 10, target.x, actor.y, field.direction, actor);
        continue;
      }
      const reach = arenaActorReach(actor);
      if (
        overlaps(
          target,
          actor.x + actor.direction * reach.offset,
          actor.y,
          reach.halfWidth,
          reach.top,
          reach.bottom,
          actor.previousX + actor.direction * reach.offset,
          actor.previousY,
        )
      )
        offer(
          actor.kind === "handchain"
            ? 0.25
            : field.fighter === "bolivar" || field.fighter === "zavarce"
              ? 1 / 7
              : 1 / 3,
          actor.kind === "handchain" ? 1 : 4.5,
          target.x,
          target.y - 70,
          actor.direction,
          actor,
          actor.kind === "handchain" ? 25 : undefined,
        );
    }
    if (!active) continue;
    if (
      field.fighter === "melanio" &&
      [20, 48].includes(field.tick) &&
      overlaps(
        target,
        p.x + field.direction * 60,
        p.y,
        field.tick === 20 ? 68 : 38,
        155,
      )
    )
      offer(
        field.tick === 20 ? 0.2 : 0.8,
        field.tick === 20 ? 1 : 8,
        target.x,
        target.y - 90,
        field.direction,
        undefined,
        field.tick === 20 ? 14 : undefined,
      );
    if (field.fighter === "chataing") {
      const x = field.caught?.x ?? field.x + field.direction * 105,
        y = field.caught?.y ?? field.y;
      if (
        ((field.tick >= 14 && field.tick <= 20 && !field.connected) ||
          field.tick === 44) &&
        Math.abs(p.x - x) < 195 &&
        overlaps(target, x, y, 62, 162)
      )
        offer(
          field.tick === 44 ? 0.85 : 0.15,
          field.tick === 44 ? 9 : 1,
          target.x,
          target.y - 80,
          field.direction,
          undefined,
          field.tick < 44 ? 20 : undefined,
        );
    }
    if (
      field.fighter === "llorona" &&
      [18, 38, 58].includes(field.tick) &&
      overlaps(target, p.x + field.direction * 48, p.y, 64, 165)
    )
      offer(
        field.tick === 58 ? 0.5 : 0.25,
        field.tick === 58 ? 8 : 1.4,
        target.x,
        target.y - 75,
        field.direction,
        undefined,
        field.tick === 18 ? 22 : undefined,
      );
  }
  return contacts;
}

/** Called only after ordinary guard, counter and invincibility rules accept contact. */
export function registerArenaContact(
  state: MatchState,
  contact: ArenaContact,
  damaged: boolean,
) {
  const { field, actor } = contact;
  if (actor && actor.kind !== "mascot" && actor.kind !== "dancer") {
    actor.connected = true;
    if (
      damaged &&
      actor.kind === "handchain" &&
      actor.caughtTick === undefined
    ) {
      actor.caughtTick = field.tick;
      actor.vx = 0;
    }
  } else if (!actor && (mountedFinale(field) || field.fighter === "chataing"))
    field.connected = true;
  if (damaged && contact.rootTicks) {
    const target = state.players[1 - contact.owner];
    target.rootTicks = Math.max(target.rootTicks, contact.rootTicks);
    target.rootKind =
      field.fighter === "puma"
        ? "chain"
        : field.fighter === "chataing"
          ? "screen"
          : field.fighter === "llorona"
            ? "spectral"
            : "flash";
    if (field.fighter === "chataing")
      field.caught = { x: target.x, y: target.y };
  }
}
