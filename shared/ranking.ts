import type { FighterId, StageId } from "./content";

export const RANKED_RECONNECT_MS = 10_000;
export interface ArenaAccount {
  id: string;
  name: string;
}
export interface RankingEntry {
  userId: string;
  name: string;
  position: number | null;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  winRate: number;
}
export type RankingReason =
  | "combat"
  | "forfeit"
  | "both_disconnected"
  | "server_restart"
  | "start_cancelled";
export interface RankingHistoryEntry {
  matchId: string;
  startedAt: number;
  finishedAt: number;
  stage: StageId;
  fighter: FighterId;
  opponentFighter: FighterId;
  opponent: string;
  outcome: "win" | "loss" | "draw" | "void";
  reason: RankingReason;
  hits: number;
  peakCombo: number;
}
export interface RankingReceipt {
  matchId: string;
  status: "saved" | "pending" | "void";
  reason?: RankingReason;
  outcome?: RankingHistoryEntry["outcome"];
}
export interface RankedStart {
  matchId: string;
  stage: StageId;
  players: [
    ArenaAccount & { fighter: FighterId },
    ArenaAccount & { fighter: FighterId },
  ];
}
export interface RankedFinish {
  matchId: string;
  winner: 0 | 1 | "draw" | null;
  reason: RankingReason;
  players?: [
    { hits: number; peakCombo: number },
    { hits: number; peakCombo: number },
  ];
}
export interface RankedReceiptForUser {
  userId: string;
  receipt: RankingReceipt;
}
export interface RankingCommands {
  begin: { args: RankedStart; result: void };
  finish: { args: RankedFinish; result: RankedReceiptForUser[] };
  board: { args: null; result: { entries: RankingEntry[] } };
  profile: {
    args: ArenaAccount;
    result: { entry: RankingEntry; history: RankingHistoryEntry[] };
  };
  receipt: {
    args: { userId: string; matchId: string };
    result: RankingReceipt | null;
  };
  close: { args: null; result: void };
}
