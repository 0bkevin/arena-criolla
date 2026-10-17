import sharp, { type Sharp, type Metadata } from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SpriteGeometry } from "../../shared/creator";

export class SpriteValidationError extends Error {
  name = "SpriteValidationError";
}

export async function packCharacterSprites(
  source: Buffer,
  folder: string,
  signal?: AbortSignal,
): Promise<SpriteGeometry> {
  signal?.throwIfAborted();
  let image: Sharp;
  let metadata: Metadata;
  try {
    image = sharp(source, { limitInputPixels: 16_000_000 });
    metadata = await image.metadata();
  } catch {
    signal?.throwIfAborted();
    throw new SpriteValidationError(
      "La imagen generada no se pudo abrir. Vuelve a generar las poses.",
    );
  }
  signal?.throwIfAborted();
  if (!metadata.width || !metadata.height || !metadata.hasAlpha)
    throw new SpriteValidationError(
      "Necesitamos ocho poses con fondo transparente. Vuelve a generar el personaje.",
    );
  const width = metadata.width,
    height = metadata.height;
  if (width % 4 || height % 2)
    throw new SpriteValidationError(
      "La hoja de poses tiene una distribución inesperada.",
    );
  let data: Buffer;
  try {
    data = await image.ensureAlpha().raw().toBuffer();
  } catch {
    signal?.throwIfAborted();
    throw new SpriteValidationError(
      "La imagen generada no se pudo leer. Vuelve a generar las poses.",
    );
  }
  signal?.throwIfAborted();
  let transparent = 0;
  for (let p = 3; p < data.length; p += 4) if (data[p] < 30) transparent++;
  if (transparent < width * height * 0.18)
    throw new SpriteValidationError(
      "El fondo de las poses no es transparente. Vuelve a intentarlo.",
    );
  const tileW = width / 4,
    tileH = height / 2,
    cell = 512,
    baseline = 482;
  const crops = [];
  for (let frame = 0; frame < 8; frame++) {
    signal?.throwIfAborted();
    const left = (frame % 4) * tileW,
      top = Math.floor(frame / 4) * tileH;
    let minX = tileW,
      minY = tileH,
      maxX = -1,
      maxY = -1,
      count = 0;
    for (let y = 0; y < tileH; y++)
      for (let x = 0; x < tileW; x++) {
        if (data[((top + y) * width + left + x) * 4 + 3] < 40) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count++;
      }
    if (
      count < tileW * tileH * 0.035 ||
      minX < 5 ||
      minY < 5 ||
      maxX > tileW - 6 ||
      maxY > tileH - 6
    )
      throw new SpriteValidationError(
        `La pose ${frame + 1} está vacía o recortada. Vuelve a generar las poses.`,
      );
    crops.push({
      left: left + minX,
      top: top + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }
  // One scale for the whole atlas preserves body proportions and jump height.
  const scale = Math.min(
    440 / crops[0].height,
    ...crops.map((c) => Math.min(460 / c.width, 460 / c.height)),
  );
  const layers = [];
  const frames: SpriteGeometry["frames"] = [];
  for (let frame = 0; frame < 8; frame++) {
    const crop = crops[frame],
      w = Math.max(1, Math.round(crop.width * scale)),
      h = Math.max(1, Math.round(crop.height * scale));
    const slotX = (frame % 4) * cell,
      slotY = Math.floor(frame / 4) * cell;
    const left = slotX + Math.floor((cell - w) / 2),
      top = slotY + baseline - h;
    const input = await sharp(source)
      .extract(crop)
      .resize(w, h)
      .png()
      .toBuffer();
    signal?.throwIfAborted();
    layers.push({ input, left, top });
    frames.push({ x: left, y: top, width: w, height: h, slotX, slotY });
  }
  const png = await sharp({
    create: {
      width: cell * 4,
      height: cell * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
  signal?.throwIfAborted();
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "sprite.png"), png);
  signal?.throwIfAborted();
  await sharp(png)
    .webp({ lossless: true, effort: 6 })
    .toFile(path.join(folder, "sprite.webp"));
  signal?.throwIfAborted();
  await sharp(png)
    .extract({ left: 0, top: 0, width: cell, height: cell })
    .resize(384, 384)
    .webp({ lossless: true })
    .toFile(path.join(folder, "portrait.webp"));
  signal?.throwIfAborted();
  const geometry = {
    width: cell * 4,
    height: cell * 2,
    cellWidth: cell,
    cellHeight: cell,
    baseline,
    bodyHeight: frames[0].height,
    frames,
  };
  await writeFile(
    path.join(folder, "geometry.json"),
    JSON.stringify(geometry, null, 2) + "\n",
  );
  return geometry;
}
