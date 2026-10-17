import type { CommunityCharacter } from "./creator";
import type { FighterId, StageId } from "./content";
import type { Input, MatchState } from "./engine";
import type { ArenaAccount, RankingReceipt } from "./ranking";

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
  ranked?: boolean;
  starting?: boolean;
  reconnectUntil?: number;
}
export type ClientMessage =
  | { type: "ping"; sentAt: number }
  | { type: "list" }
  | {
      type: "create";
      name: string;
      fighter: FighterId;
      stage: StageId;
      wins: number;
      private: boolean;
      ranked?: boolean;
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
  | { type: "resume"; matchId: string }
  | { type: "abandon"; matchId: string }
  | { type: "leave" };
export type ServerMessage =
  | { type: "pong"; sentAt: number }
  | { type: "community"; characters: CommunityCharacter[] }
  | { type: "welcome"; id: string; account?: ArenaAccount | null }
  | { type: "rooms"; rooms: RoomView[]; online: number }
  | { type: "room"; room: RoomView }
  | { type: "start"; state: MatchState; index: number; ranked?: boolean }
  | { type: "state"; state: MatchState }
  | { type: "left" }
  | { type: "opponent-left" }
  | { type: "ranked-result"; result: RankingReceipt }
  | { type: "resume-unavailable"; message: string }
  | { type: "session-replaced" }
  | { type: "abandon-accepted"; matchId: string }
  | { type: "error"; message: string };
