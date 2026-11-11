import type { WorkerReply, WorkerRequest } from "../assets/worker-protocol";
import {
  synthesizeScore,
  type ScoreRequest,
  type SynthesizedScore,
} from "./music-preparation";

const reply = (
  message: WorkerReply<SynthesizedScore>,
  transfer: ArrayBuffer[] = [],
) => self.postMessage(message, { transfer });

self.onmessage = ({ data }: MessageEvent<WorkerRequest<ScoreRequest>>) => {
  try {
    const result = synthesizeScore(data.input);
    reply({ id: data.id, result }, [result.left.buffer, result.right.buffer]);
  } catch {
    reply({ id: data.id, error: true });
  }
};
