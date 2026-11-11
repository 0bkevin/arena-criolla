import sharp, { type OutputInfo } from "sharp";
import { SpriteValidationError } from "./sprites";
import { sha256 } from "./asset-bundle";

// Image generation does not guarantee exact cell boundaries. Isolate complete
// generated silhouettes before the strict game packer; never reconstruct pixels.
export async function normalizeGeneratedAtlas(
  source: Buffer,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const image = sharp(source, { limitInputPixels: 16_000_000 });
  let decoded: { data: Buffer; info: OutputInfo };
  try {
    const metadata = await image.metadata();
    if (metadata.format !== "png" || !metadata.hasAlpha)
      throw new SpriteValidationError(
        "Necesitamos un PNG con ocho figuras transparentes.",
      );
    decoded = await image
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof SpriteValidationError) throw error;
    throw new SpriteValidationError(
      "La imagen generada no se pudo abrir. Vuelve a generar las poses.",
    );
  }
  const { data, info } = decoded;
  const { width, height } = info;
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(labels.length);
  const components: {
    label: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixels: number;
  }[] = [];
  let label = 0,
    noise = 0,
    transparent = 0;
  for (let p = 0; p < labels.length; p++) {
    if (data[p * 4 + 3] < 30) transparent++;
    if (labels[p] || data[p * 4 + 3] < 40) continue;
    signal?.throwIfAborted();
    const own = ++label;
    labels[p] = own;
    queue[0] = p;
    let head = 0,
      tail = 1,
      minX = width,
      minY = height,
      maxX = -1,
      maxY = -1;
    while (head < tail) {
      const n = queue[head++],
        x = n % width,
        y = Math.floor(n / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const next of [
        x > 0 ? n - 1 : -1,
        x < width - 1 ? n + 1 : -1,
        y > 0 ? n - width : -1,
        y < height - 1 ? n + width : -1,
      ]) {
        if (next >= 0 && !labels[next] && data[next * 4 + 3] >= 40) {
          labels[next] = own;
          queue[tail++] = next;
        }
      }
    }
    if (tail < 32) noise += tail;
    else components.push({ label: own, minX, minY, maxX, maxY, pixels: tail });
  }
  if (
    components.length !== 8 ||
    noise > 128 ||
    transparent < width * height * 0.18
  )
    throw new SpriteValidationError(
      "Necesitamos exactamente ocho siluetas completas y separadas. No se pueden reparar poses ausentes, unidas o fragmentadas.",
    );
  const frames = components
    .map((component) => {
      const column = Math.floor(
        (component.minX + component.maxX) / 2 / (width / 4),
      );
      const row = Math.floor(
        (component.minY + component.maxY) / 2 / (height / 2),
      );
      if (
        component.minX < 5 ||
        component.minY < 5 ||
        component.maxX > width - 6 ||
        component.maxY > height - 6 ||
        component.pixels < ((width * height) / 8) * 0.035
      )
        throw new SpriteValidationError(
          "Una figura está recortada por el borde del lienzo o está incompleta.",
        );
      // Whole silhouettes may cross internal row or column lines. Their centers
      // must still map one-to-one to the eight ordered cells below; moving the
      // complete component preserves every generated pixel and limb.
      return { ...component, frame: row * 4 + column };
    })
    .sort((a, b) => a.frame - b.frame);
  if (frames.some((frame, index) => frame.frame !== index))
    throw new SpriteValidationError(
      "Las ocho figuras deben seguir el orden de cuatro columnas por dos filas.",
    );
  // One scale preserves relative body proportions and the shorter jump silhouette.
  const scale = Math.min(
    440 / (frames[0].maxY - frames[0].minY + 5),
    ...frames.map((b) =>
      Math.min(450 / (b.maxX - b.minX + 5), 450 / (b.maxY - b.minY + 5)),
    ),
  );
  const layers = [];
  const signatures = new Set<string>();
  for (const frame of frames) {
    signal?.throwIfAborted();
    const left = frame.minX - 2,
      top = frame.minY - 2;
    const w = frame.maxX - frame.minX + 5,
      h = frame.maxY - frame.minY + 5;
    const pixels = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sx = left + x,
          sy = top + y,
          p = sy * width + sx;
        let own = labels[p] === frame.label;
        // Preserve this silhouette's antialiased edge, excluding other figures.
        if (!own && data[p * 4 + 3] < 40) {
          for (let dy = -2; dy <= 2 && !own; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const nx = sx + dx,
                ny = sy + dy;
              if (
                nx >= 0 &&
                nx < width &&
                ny >= 0 &&
                ny < height &&
                labels[ny * width + nx] === frame.label
              ) {
                own = true;
                break;
              }
            }
        }
        if (own) data.copy(pixels, (y * w + x) * 4, p * 4, p * 4 + 4);
      }
    const signature = `${w}:${h}:${sha256(pixels)}`;
    if (signatures.has(signature))
      throw new SpriteValidationError(
        "Las ocho poses deben ser distintas; hay una pose repetida.",
      );
    signatures.add(signature);
    const outW = Math.max(1, Math.round(w * scale)),
      outH = Math.max(1, Math.round(h * scale));
    const input = await sharp(pixels, {
      raw: { width: w, height: h, channels: 4 },
    })
      .resize(outW, outH)
      .png()
      .toBuffer();
    layers.push({
      input,
      left: (frame.frame % 4) * 512 + Math.floor((512 - outW) / 2),
      top: Math.floor(frame.frame / 4) * 512 + 482 - outH,
    });
  }
  const png = await sharp({
    create: {
      width: 2048,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
  signal?.throwIfAborted();
  return {
    png,
    audit: {
      sourceWidth: width,
      sourceHeight: height,
      frames,
      ignoredNoisePixels: noise,
    },
  };
}
