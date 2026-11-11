import { isFighter, isStage } from "../roster/roster";
import { ACTIONS, emptyInput, type Input } from "../engine/engine";
import type { ClientMessage } from "./protocol";
import { isRoomCode } from "./room-code";
import { isRecord } from "../guards";

const MAX_ACTION_COUNT = 1_000_000_000;

/** A display name without control characters or markup, at most 20 characters. */
export const cleanName = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f<>]/g, "")
        .trim()
        .slice(0, 20)
    : "";

/** A win count clamped to 0–9999. */
export const cleanWins = (value: unknown) =>
  Number.isFinite(value)
    ? Math.min(9999, Math.max(0, Math.floor(Number(value))))
    : 0;

/** The declared `type` of a decoded message, before any field is trusted. */
export function messageType(data: unknown): string | null {
  return isRecord(data) && typeof data.type === "string" ? data.type : null;
}

/** Held controls and monotonic action counters; null when any field is invalid. */
function parseInput(value: unknown): Input | null {
  if (!isRecord(value) || !isRecord(value.actions)) return null;
  const input = emptyInput();
  input.left = value.left === true;
  input.right = value.right === true;
  input.block = value.block === true;
  input.down = value.down === true;
  input.superHeld = value.superHeld === true;
  for (const action of ACTIONS) {
    const count = value.actions[action];
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > MAX_ACTION_COUNT
    )
      return null;
    input.actions[action] = count;
  }
  return input;
}

/**
 * Validate a decoded client message. Names and win counts are sanitized, and an
 * unknown fighter or stage in `select` is dropped rather than rejecting the
 * whole message. Returns null for anything else that is malformed.
 */
export function parseClientMessage(data: unknown): ClientMessage | null {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "list":
    case "leave":
    case "rematch":
      return { type: data.type };
    case "create":
      if (!isFighter(data.fighter) || !isStage(data.stage)) return null;
      return {
        type: "create",
        name: cleanName(data.name),
        fighter: data.fighter,
        stage: data.stage,
        wins: cleanWins(data.wins),
        private: Boolean(data.private),
      };
    case "join":
      if (!isRoomCode(data.code) || !isFighter(data.fighter)) return null;
      return {
        type: "join",
        code: data.code,
        name: cleanName(data.name),
        fighter: data.fighter,
        wins: cleanWins(data.wins),
      };
    case "select":
      return {
        type: "select",
        ...(isFighter(data.fighter) && { fighter: data.fighter }),
        ...(isStage(data.stage) && { stage: data.stage }),
        wins: cleanWins(data.wins),
      };
    case "ready":
      return typeof data.ready === "boolean"
        ? { type: "ready", ready: data.ready }
        : null;
    case "input": {
      const input = parseInput(data.input);
      return input && typeof data.matchId === "string"
        ? { type: "input", matchId: data.matchId, input }
        : null;
    }
    default:
      return null;
  }
}
