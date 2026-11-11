import type { MatchState } from "../../../shared/engine/engine";

export interface SmoothedPosition {
  x: number;
  y: number;
}

/**
 * Ease online fighters toward each authoritative snapshot instead of jumping,
 * snapping only after a teleport-sized correction. Updates `positions`.
 */
export function smoothRemotePlayers(
  state: MatchState,
  positions: SmoothedPosition[],
  elapsed: number,
): MatchState {
  return {
    ...state,
    players: state.players.map((p, i) => {
      const position = positions[i];
      const blend =
        Math.abs(position.x - p.x) > 260 || Math.abs(position.y - p.y) > 260
          ? 1
          : 1 - Math.exp(-elapsed / 24);
      position.x += (p.x - position.x) * blend;
      position.y += (p.y - position.y) * blend;
      return { ...p, x: position.x, y: position.y };
    }) as MatchState["players"],
  };
}
