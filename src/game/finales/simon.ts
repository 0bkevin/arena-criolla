/** One visible strum releases the special's existing three-note fan. */
export function simonSpecialPose(tick: number): string {
  return tick < 12
    ? "ready"
    : tick < 20
      ? "downstroke"
      : tick < 28
        ? "upstroke"
        : "ready";
}
