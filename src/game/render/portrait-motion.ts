/** Repeat the full authored victory sequence without adding a rest between plays. */
export function samplePortraitLoop(elapsedMs: number, durationMs: number) {
  return (elapsedMs % durationMs) / durationMs;
}
