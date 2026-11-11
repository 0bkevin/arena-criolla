// The messages between preparationWorker and the music and sprite workers.

export interface WorkerRequest<Input> {
  id: number;
  input: Input;
}

/** A worker either returns its result or reports that it could not. */
export type WorkerReply<Output> =
  { id: number; result: Output } | { id: number; error: true };
