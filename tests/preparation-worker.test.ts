import test from "node:test";
import assert from "node:assert/strict";
import { preparationWorker } from "../src/game/preparation-worker";

test("worker jobs correlate out-of-order replies and recover pending jobs after failure", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    onerror?: () => void;
    onmessageerror?: () => void;
    jobs: { id: number; input: number }[] = [];
    terminated = false;
    postMessage(job: { id: number; input: number }) {
      this.jobs.push(job);
    }
    terminate() {
      this.terminated = true;
    }
  }
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: FakeWorker,
  });
  try {
    const worker = new FakeWorker();
    const run = preparationWorker(
      () => worker as unknown as Worker,
      (n: number) => n * 2,
    );
    const first = run(3),
      second = run(7);
    worker.onmessage!({ data: { id: worker.jobs[1].id, result: 14 } });
    assert.equal(await second, 14);
    worker.onerror!();
    assert.equal(await first, 6);
    assert.equal(worker.terminated, true);
    assert.equal(run(9), 18, "failed worker is not recreated on every frame");
    assert.equal(worker.jobs.length, 2);
    const blocked = preparationWorker(
      () => {
        throw new Error("CSP");
      },
      (n: number) => n * 2,
    );
    assert.equal(blocked(4), 8);
  } finally {
    if (previous) Object.defineProperty(globalThis, "Worker", previous);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
});
