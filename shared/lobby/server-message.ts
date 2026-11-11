// The client's side of the trust boundary: a decoded server frame is only
// acted on once its shape matches a ServerMessage.
import { isFighter, isStage } from "../roster/roster";
import type { MatchState } from "../engine/engine";
import type { RoomPlayer, RoomView, ServerMessage } from "./protocol";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isSeat = (value: unknown): value is 0 | 1 => value === 0 || value === 1;
const ROOM_STATUSES: readonly unknown[] = ["waiting", "playing", "finished"];
const MATCH_PHASES: readonly unknown[] = ["intro", "playing", "finished"];

function isRoomPlayer(value: unknown): value is RoomPlayer {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isFighter(value.fighter) &&
    typeof value.ready === "boolean" &&
    isNumber(value.wins) &&
    (value.connected === undefined || typeof value.connected === "boolean")
  );
}

function isRoomView(value: unknown): value is RoomView {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.name === "string" &&
    isStage(value.stage) &&
    Array.isArray(value.players) &&
    value.players.every(isRoomPlayer) &&
    ROOM_STATUSES.includes(value.status) &&
    typeof value.host === "string"
  );
}

/**
 * The outline of a match snapshot: identity, clock, phase and two fighters
 * with known roster entries. The simulation's inner fields come from the same
 * engine version as this client and are not re-checked one by one.
 */
function isMatchState(value: unknown): value is MatchState {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isStage(value.stage) ||
    !isNumber(value.tick) ||
    !isNumber(value.remaining) ||
    !MATCH_PHASES.includes(value.phase) ||
    !(
      value.winner === null ||
      value.winner === "draw" ||
      isSeat(value.winner)
    ) ||
    !Array.isArray(value.projectiles) ||
    !Array.isArray(value.effects) ||
    !Array.isArray(value.players) ||
    value.players.length !== 2
  )
    return false;
  return value.players.every(
    (player) =>
      isRecord(player) &&
      isRecord(player.config) &&
      isFighter(player.config.fighter) &&
      isNumber(player.x) &&
      isNumber(player.y) &&
      isNumber(player.hp),
  );
}

/** A decoded server frame as a ServerMessage, or null when it is malformed. */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "welcome":
      return typeof data.id === "string" &&
        (data.resumeToken === undefined ||
          typeof data.resumeToken === "string") &&
        (data.resumed === undefined || typeof data.resumed === "boolean")
        ? {
            type: "welcome",
            id: data.id,
            resumeToken: data.resumeToken,
            resumed: data.resumed,
          }
        : null;
    case "rooms":
      return Array.isArray(data.rooms) &&
        data.rooms.every(isRoomView) &&
        isNumber(data.online)
        ? { type: "rooms", rooms: data.rooms, online: data.online }
        : null;
    case "room":
      return isRoomView(data.room) ? { type: "room", room: data.room } : null;
    case "start":
      return isMatchState(data.state) && isSeat(data.index)
        ? { type: "start", state: data.state, index: data.index }
        : null;
    case "state":
      return isMatchState(data.state)
        ? { type: "state", state: data.state }
        : null;
    case "left":
    case "opponent-left":
      return { type: data.type };
    case "error":
      return typeof data.message === "string"
        ? { type: "error", message: data.message }
        : null;
    default:
      return null;
  }
}
