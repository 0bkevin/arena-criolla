// Arena definitives: performances that release helpers, waves and projectiles
// onto the arena instead of taking over the screen. Entry point.
import type { MatchState } from "../engine";
import type { FieldFinaleState } from "./field-finales";
import { opponentOf } from "../types";
import { ARENA_FINALES, isArenaFinalist } from "./arena-finale-specs";
import { spawnArenaCast, steerArenaCaster } from "./arena-finale-cast";
import { advanceArenaActors } from "./arena-finale-actors";

export {
  ARENA_FINALES,
  ARENA_FINALE_CUES,
  REVIEWED_FINALISTS,
  activeArenaPerformance,
  arenaActorReach,
  arenaFinaleInRange,
  arenaMountReach,
  cancelArenaPerformance,
  isArenaFinalist,
  mountedFinale,
  rideMoving,
  type ArenaContact,
  type ArenaFinaleActor,
  type ArenaFinalist,
} from "./arena-finale-specs";
export {
  arenaFinaleContacts,
  registerArenaContact,
} from "./arena-finale-contacts";

/** Only creates spatial attacks. Nothing in this module changes the rival's HP. */
export function advanceArenaFinale(state: MatchState, field: FieldFinaleState) {
  if (!isArenaFinalist(field.fighter)) return;
  const spec = ARENA_FINALES[field.fighter],
    p = state.players[field.owner],
    target = state.players[opponentOf(field.owner)],
    tick = field.tick;
  steerArenaCaster(field, spec, p, tick);
  if (!field.cancelled) spawnArenaCast(state, field, p, target, tick);
  if (field.caught && target.rootTicks && target.rootKind === "screen")
    field.caught = { x: target.x, y: target.y };
  advanceArenaActors(state, field, p, tick);
}
