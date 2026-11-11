export interface CreatorLimits {
  concurrency: number;
  capacity: number;
  uploads: number;
  jobTimeoutMs: number;
  uploadTimeoutMs: number;
  dailyAttempts: number;
  dailyUserAttempts: number;
}

export function creatorLimits(
  overrides: Partial<CreatorLimits> = {},
): CreatorLimits {
  const setting = (
    key: keyof CreatorLimits,
    env: string,
    fallback: number,
    max: number,
  ) => {
    const value = overrides[key] ?? Number(process.env[env] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max)
      throw new Error(`${env} must be an integer between 1 and ${max}.`);
    return value;
  };
  const limits = {
    concurrency: setting("concurrency", "ARENA_CREATOR_CONCURRENCY", 2, 4),
    capacity: setting("capacity", "ARENA_CREATOR_CAPACITY", 12, 100),
    uploads: setting("uploads", "ARENA_CREATOR_UPLOADS", 2, 4),
    jobTimeoutMs: setting(
      "jobTimeoutMs",
      "ARENA_CREATOR_JOB_TIMEOUT_MS",
      300_000,
      900_000,
    ),
    uploadTimeoutMs: setting(
      "uploadTimeoutMs",
      "ARENA_CREATOR_UPLOAD_TIMEOUT_MS",
      30_000,
      120_000,
    ),
    dailyAttempts: setting(
      "dailyAttempts",
      "ARENA_CREATOR_DAILY_ATTEMPTS",
      50,
      10_000,
    ),
    dailyUserAttempts: setting(
      "dailyUserAttempts",
      "ARENA_CREATOR_USER_DAILY_ATTEMPTS",
      6,
      100,
    ),
  };
  if (limits.concurrency > limits.capacity)
    throw new Error(
      "ARENA_CREATOR_CAPACITY must be at least ARENA_CREATOR_CONCURRENCY.",
    );
  return limits;
}

// Abort the wait even if a provider ignores its signal. Nodes also check the signal
// after I/O, so a late response cannot resume a timed-out job or overwrite a retry.
export function abortable<T>(
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  signal?.throwIfAborted();
  if (!signal) return operation();
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return operation();
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));
  });
}

export class CreatorWorker {
  private queue: { id: string; deadline: number }[] = [];
  private active = new Map<string, Promise<void>>();
  private shutdown = new AbortController();
  private stopped = false;
  constructor(
    private limits: CreatorLimits,
    private run: (id: string, signal: AbortSignal) => Promise<unknown>,
    private failed: (id: string, error: unknown) => void,
  ) {}
  get size() {
    return this.queue.length + this.active.size;
  }
  get accepting() {
    return !this.stopped;
  }
  enqueue(id: string) {
    if (
      this.stopped ||
      this.queue.some((job) => job.id === id) ||
      this.active.has(id)
    )
      return;
    this.queue.push({
      id,
      deadline: performance.now() + this.limits.jobTimeoutMs,
    });
    this.pump();
  }
  private pump() {
    while (
      !this.stopped &&
      this.queue.length &&
      this.active.size < this.limits.concurrency
    ) {
      const job = this.queue.shift()!;
      const { id } = job;
      const task = this.execute(job).finally(() => {
        this.active.delete(id);
        this.pump();
      });
      this.active.set(id, task);
    }
  }
  private async execute({ id, deadline }: { id: string; deadline: number }) {
    const timeout = new AbortController();
    const expired = () =>
      timeout.abort(
        new DOMException("Generation deadline exceeded", "TimeoutError"),
      );
    const remaining = deadline - performance.now();
    if (remaining <= 0) expired();
    const timer = setTimeout(expired, Math.max(0, remaining));
    const signal = AbortSignal.any([this.shutdown.signal, timeout.signal]);
    try {
      await abortable(signal, () => this.run(id, signal));
    } catch (error) {
      try {
        this.failed(id, error);
      } catch {
        // A failed persistence write must not crash the game or start more billed jobs.
        console.error(
          "Could not persist generation failure; workshop stopped.",
        );
        this.stop();
      }
    } finally {
      clearTimeout(timer);
    }
  }
  stop() {
    this.stopped = true;
    this.shutdown.abort();
    this.queue = [];
  }
  async close() {
    this.stop();
    await Promise.all(this.active.values());
  }
}
