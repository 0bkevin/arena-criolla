import {
  opponentOf,
  type MatchState,
  type PlayerIndex,
} from "../../shared/engine/engine";
import type { GameMode } from "../components/match/Game";
import type { Progress } from "./storage";

/**
 * The progress after a finished match, seen from `index`. Local versus also
 * credits player 2's win; the history keeps the latest eight matches.
 */
export function recordMatch(
  progress: Progress,
  state: MatchState,
  index: PlayerIndex,
  mode: GameMode,
): Progress {
  const saved = structuredClone(progress);
  const local = state.players[index];
  const won = state.winner === index;
  saved.played++;
  saved.bestCombo = Math.max(saved.bestCombo, local.peakCombo);
  if (won)
    saved.wins[local.config.fighter] =
      (Number(saved.wins[local.config.fighter]) || 0) + 1;
  if (mode === "local" && state.winner === 1) {
    const second = state.players[1];
    saved.wins[second.config.fighter] =
      (Number(saved.wins[second.config.fighter]) || 0) + 1;
  }
  saved.recent.unshift({
    fighter: local.config.fighter,
    rival: state.players[opponentOf(index)].config.fighter,
    won,
    date: new Date().toISOString(),
  });
  saved.recent = saved.recent.slice(0, 8);
  return saved;
}
