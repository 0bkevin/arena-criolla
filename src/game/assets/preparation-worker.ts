/** A failed/blocked worker falls back to the same algorithm, never lesser quality. */
export function preparationWorker<Input, Output>(
  create: () => Worker,
  fallback: (input: Input) => Output,
) {
  let worker: Worker | undefined;
  let unavailable = false;
  let nextId = 0;
  const pending = new Map<
    number,
    {
      resolve: (value: Output) => void;
      input: Input;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const fail = () => {
    unavailable = true;
    worker?.terminate();
    worker = undefined;
    for (const job of pending.values()) {
      clearTimeout(job.timer);
      job.resolve(fallback(job.input));
    }
    pending.clear();
  };
  return (input: Input): Output | Promise<Output> => {
    if (unavailable || typeof Worker === "undefined") return fallback(input);
    if (!worker) {
      try {
        worker = create();
        worker.onmessage = ({ data }) => {
          const job = pending.get(data.id);
          if (!job) return;
          clearTimeout(job.timer);
          pending.delete(data.id);
          job.resolve(data.error ? fallback(job.input) : data.result);
        };
        worker.onerror = fail;
        worker.onmessageerror = fail;
      } catch {
        fail();
        return fallback(input);
      }
    }
    return new Promise<Output>((resolve) => {
      const id = ++nextId;
      pending.set(id, { resolve, input, timer: setTimeout(fail, 30_000) });
      // Keep the input available for recovery. Large output buffers are transferred.
      try {
        worker!.postMessage({ id, input });
      } catch {
        fail();
      }
    });
  };
}
