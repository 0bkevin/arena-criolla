import type { FighterId, StageId } from "../roster/roster";
import type { Input, MatchState, PlayerIndex } from "../engine/engine";

export const ARENA_SOCKET_PROTOCOL = "arena-v1";
export const ROOM_RESUME_PROTOCOL_PREFIX = "arena-resume.";

export interface RoomPlayer {
  id: string;
  name: string;
  fighter: FighterId;
  ready: boolean;
  wins: number;
  connected?: boolean;
}
export interface RoomView {
  code: string;
  name: string;
  stage: StageId;
  players: RoomPlayer[];
  status: "waiting" | "playing" | "finished";
  host: string;
}
export type ClientMessage =
  | { type: "list" }
  /** Keeps an idle connection alive; the server answers nothing. */
  | { type: "ping" }
  | {
      type: "create";
      name?: string;
      fighter: FighterId;
      stage: StageId;
      wins: number;
      private: boolean;
    }
  | {
      type: "join";
      code: string;
      name?: string;
      fighter: FighterId;
      wins: number;
    }
  | { type: "select"; fighter?: FighterId; stage?: StageId; wins?: number }
  | { type: "ready"; ready: boolean }
  | { type: "input"; matchId: string; input: Input }
  | { type: "rematch" }
  | { type: "leave" };
export type ServerMessage =
  | {
      type: "welcome";
      id: string;
      resumeToken?: string | undefined;
      resumed?: boolean | undefined;
    }
  | { type: "rooms"; rooms: RoomView[]; online: number }
  | { type: "room"; room: RoomView }
  | { type: "start"; state: MatchState; index: PlayerIndex }
  | { type: "state"; state: MatchState }
  | { type: "left" }
  | { type: "opponent-left" }
  | { type: "error"; message: string };
