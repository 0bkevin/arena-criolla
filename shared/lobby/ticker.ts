/** Fixed-step scheduler for the authoritative match simulation. */
export class FixedStepTicker {
  private previous: number | null = null;
  private remainder = 0;

  constructor(
    private readonly stepMs = 1000 / 60,
    private readonly maxCatchUp = 5,
  ) {
    if (!Number.isFinite(stepMs) || stepMs <= 0)
      throw new RangeError("stepMs must be a positive finite number");
    if (!Number.isSafeInteger(maxCatchUp) || maxCatchUp < 1)
      throw new RangeError("maxCatchUp must be a positive integer");
  }

  /** Return the number of fixed simulation steps due at this monotonic time. */
  advance(now: number): number {
    if (!Number.isFinite(now)) return 0;
    if (this.previous === null) {
      this.previous = now;
      return 0;
    }

    const elapsed = Math.max(0, now - this.previous);
    this.previous = Math.max(this.previous, now);
    this.remainder += elapsed;

    const due = Math.floor((this.remainder + 1e-7) / this.stepMs);
    const steps = Math.min(due, this.maxCatchUp);
    this.remainder -= steps * this.stepMs;
    if (due > this.maxCatchUp) {
      this.remainder =
        ((this.remainder % this.stepMs) + this.stepMs) % this.stepMs;
      if (this.remainder < 1e-7 || this.stepMs - this.remainder < 1e-7)
        this.remainder = 0;
    }
    return steps;
  }
}
