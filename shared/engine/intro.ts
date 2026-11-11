import type { PlayerIndex } from "./types";

// Shared ticks keep both clients on the same entrance, countdown and opening pose.
export const INTRO_PLAYER_TICKS = 180;
export const INTRO_COUNTDOWN_START = INTRO_PLAYER_TICKS * 2;
export const INTRO_COUNTDOWN_TICKS = 150;
export const INTRO_TOTAL_TICKS = INTRO_COUNTDOWN_START + INTRO_COUNTDOWN_TICKS;
export function introActor(tick: number): PlayerIndex | null {
  return tick < INTRO_COUNTDOWN_START
    ? tick < INTRO_PLAYER_TICKS
      ? 0
      : 1
    : null;
}
