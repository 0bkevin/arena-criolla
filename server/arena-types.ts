import type { WebSocket } from "ws";
import type { Input, MatchState } from "../shared/engine";
import type { RoomView } from "../shared/protocol";
import type { ArenaAccount } from "../shared/ranking";

export interface Client {
  id: string;
  socket: WebSocket;
  room: string | null;
  input: Input;
  inputAt: number;
  alive: boolean;
  messages: number;
  controls: number;
  lists: number;
  pings: number;
  window: number;
  account: ArenaAccount | null;
  sessionHash: string | null;
  resumeAttempted?: boolean;
}
export interface Room {
  view: RoomView;
  clients: Client[];
  private: boolean;
  state: MatchState | null;
  touched: number;
}
