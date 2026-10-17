import { Worker } from "node:worker_threads";
import type { RankingCommands } from "../shared/ranking";

export class RankingStore {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private failure: Error | null = null;
  private closed = false;
  private ready: Promise<void>;
  constructor(databasePath: string) {
    this.worker = new Worker(new URL("./ranking-worker.ts", import.meta.url), {
      workerData: { databasePath },
      execArgv: [],
    });
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker.on("message", (message) => {
        if (message.ready) {
          resolve();
          return;
        }
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error)
          pending.reject(
            Object.assign(new Error(message.error), {
              retryable: message.retryable,
            }),
          );
        else pending.resolve(message.value);
      });
      const failed = () => {
        this.failure = new Error(
          "El ranking no está disponible. Inténtalo más tarde.",
        );
        reject(this.failure);
        this.pending.forEach((task) => task.reject(this.failure!));
        this.pending.clear();
      };
      this.worker.on("error", failed);
      this.worker.on("exit", () => {
        if (!this.closed) failed();
      });
    });
    // Readiness is awaited by operations; construction alone must not leak a rejection.
    void this.ready.catch(() => {});
  }
  async request<T extends keyof RankingCommands>(
    type: T,
    args: RankingCommands[T]["args"],
  ): Promise<RankingCommands[T]["result"]> {
    await this.ready;
    if (this.failure) throw this.failure;
    if (this.closed) throw new Error("El ranking se está cerrando.");
    if (this.pending.size >= 256)
      throw new Error(
        "El ranking está ocupado. Inténtalo de nuevo en un momento.",
      );
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, {
        resolve: (value) => resolve(value as RankingCommands[T]["result"]),
        reject,
      });
      this.worker.postMessage({ id, type, args });
    });
  }
  async close() {
    if (this.closed) return;
    try {
      if (!this.failure) await this.request("close", null);
    } catch {
      /* Recovery voids unfinished matches on the next process start. */
    } finally {
      this.closed = true;
      await this.worker.terminate();
    }
  }
}
