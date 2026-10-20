import { VICTORY_TRANSITION_MS } from "./victory-types";

const REVEAL_MS = VICTORY_TRANSITION_MS;
const HOLD_MS = 2000;
const REST_MS = 500;

/**
 * Let the result screen arrive, play the complete greeting, and rest in its
 * signature pose. The authored release returns to the guard before replay.
 * Holds use a timer rather than repainting an unchanged canvas.
 */
export function samplePortraitLoop(
  elapsedMs: number,
  durationMs: number,
  poseProgress: number,
) {
  if (elapsedMs < REVEAL_MS)
    return { progress: 0, waitMs: REVEAL_MS - elapsedMs };

  const cycleMs = durationMs + HOLD_MS + REST_MS;
  const time = (elapsedMs - REVEAL_MS) % cycleMs;
  const poseMs = durationMs * poseProgress;
  if (time < poseMs) return { progress: time / durationMs, waitMs: 0 };
  if (time < poseMs + HOLD_MS)
    return { progress: poseProgress, waitMs: poseMs + HOLD_MS - time };
  if (time < durationMs + HOLD_MS)
    return { progress: (time - HOLD_MS) / durationMs, waitMs: 0 };
  return { progress: 1, waitMs: cycleMs - time };
}
