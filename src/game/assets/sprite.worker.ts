import { isolateFramePixels } from "./sprite-isolation";

self.onmessage = ({
  data,
}: MessageEvent<{
  id: number;
  input: { pixels: Uint8ClampedArray; width: number; height: number };
}>) => {
  try {
    const { pixels, width, height } = data.input;
    const result = isolateFramePixels(pixels, width, height);
    self.postMessage({ id: data.id, result }, { transfer: [result.buffer] });
  } catch {
    self.postMessage({ id: data.id, error: true });
  }
};
