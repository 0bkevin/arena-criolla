import { synthesizeScore, type ScoreRequest } from "./music-preparation";

self.onmessage = ({
  data,
}: MessageEvent<{ id: number; input: ScoreRequest }>) => {
  try {
    const result = synthesizeScore(data.input);
    self.postMessage(
      { id: data.id, result },
      { transfer: [result.left.buffer, result.right.buffer] },
    );
  } catch {
    self.postMessage({ id: data.id, error: true });
  }
};
