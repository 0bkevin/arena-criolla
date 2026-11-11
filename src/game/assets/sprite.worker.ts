import { isolateFramePixels } from "./sprite-isolation";
import type { WorkerReply, WorkerRequest } from "./worker-protocol";

interface FrameInput {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

const reply = (
  message: WorkerReply<Uint8ClampedArray>,
  transfer: ArrayBuffer[] = [],
) => self.postMessage(message, { transfer });

self.onmessage = ({ data }: MessageEvent<WorkerRequest<FrameInput>>) => {
  try {
    const { pixels, width, height } = data.input;
    const result = isolateFramePixels(pixels, width, height);
    reply({ id: data.id, result }, [result.buffer]);
  } catch {
    reply({ id: data.id, error: true });
  }
};
