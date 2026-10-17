import type { CommunityCharacter } from "./creator";
import type { FighterId, StageId } from "./content";
import type { Input, MatchState } from "./engine";

export interface RoomPlayer {
  id: string;
  name: string;
  fighter: FighterId;
  ready: boolean;
  wins: number;
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
  | {
      type: "create";
      name: string;
      fighter: FighterId;
      stage: StageId;
      wins: number;
      private: boolean;
    }
  | {
      type: "join";
      code: string;
      name: string;
      fighter: FighterId;
      wins: number;
    }
  | { type: "select"; fighter?: FighterId; stage?: StageId; wins?: number }
  | { type: "ready"; ready: boolean }
  | { type: "input"; matchId: string; input: Input }
  | { type: "rematch" }
  | { type: "leave" };
export type ServerMessage =
  | { type: "community"; characters: CommunityCharacter[] }
  | { type: "welcome"; id: string }
  | { type: "rooms"; rooms: RoomView[]; online: number }
  | { type: "room"; room: RoomView }
  | { type: "start"; state: MatchState; index: number }
  | { type: "state"; state: MatchState }
  | { type: "left" }
  | { type: "opponent-left" }
  | { type: "error"; message: string };
