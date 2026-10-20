import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

type Bounds = { x: number; y: number; width: number; height: number };
type Component = {
  label: number;
  pixels: number;
  corePixels: number;
  maxAlpha: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  coreMinX: number;
  coreMinY: number;
  coreMaxX: number;
  coreMaxY: number;
};
const names = ["leftChair", "rightChair", "table", "cup"] as const;
const hash = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");
const bounds = (component: Component): Bounds => ({
  x: component.minX,
  y: component.minY,
  width: component.maxX - component.minX + 1,
  height: component.maxY - component.minY + 1,
});

export async function prepareCafeFurniture() {
  const source = "assets/source/finales/finales-cafe-furniture.png";
  const normalized = "assets/source/finales/finales-cafe-furniture-packed.png";
  const destination = "public/assets/finales-cafe-furniture.webp";
  const original = await readFile(source);
  const metadata = await sharp(original).metadata();
  if (!metadata.hasAlpha)
    throw new Error(`${source}: a transparent source is required`);
  const { data, info } = await sharp(original)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const labels = new Int32Array(info.width * info.height);
  const queue = new Int32Array(labels.length);
  const components: Component[] = [];
  // Connect every nonzero alpha pixel, so faint steam and antialiasing stay
  // attached to their object. Alpha >= 40 only identifies the four solid cores.
  for (let index = 0; index < labels.length; index++) {
    if (labels[index] || !data[index * 4 + 3]) continue;
    const component: Component = {
      label: components.length + 1,
      pixels: 0,
      corePixels: 0,
      maxAlpha: 0,
      minX: info.width,
      minY: info.height,
      maxX: -1,
      maxY: -1,
      coreMinX: info.width,
      coreMinY: info.height,
      coreMaxX: -1,
      coreMaxY: -1,
    };
    let head = 0;
    let tail = 1;
    queue[0] = index;
    labels[index] = component.label;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      const alpha = data[pixel * 4 + 3];
      component.minX = Math.min(component.minX, x);
      component.minY = Math.min(component.minY, y);
      component.maxX = Math.max(component.maxX, x);
      component.maxY = Math.max(component.maxY, y);
      component.maxAlpha = Math.max(component.maxAlpha, alpha);
      if (alpha >= 40) {
        component.corePixels++;
        component.coreMinX = Math.min(component.coreMinX, x);
        component.coreMinY = Math.min(component.coreMinY, y);
        component.coreMaxX = Math.max(component.coreMaxX, x);
        component.coreMaxY = Math.max(component.coreMaxY, y);
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (
            nextX < 0 ||
            nextY < 0 ||
            nextX >= info.width ||
            nextY >= info.height
          )
            continue;
          const next = nextY * info.width + nextX;
          if (labels[next] || !data[next * 4 + 3]) continue;
          labels[next] = component.label;
          queue[tail++] = next;
        }
      }
    }
    component.pixels = tail;
    components.push(component);
  }
  const objects = components.filter(
    (component) => component.corePixels >= 2_000,
  );
  const noise = components.filter((component) => component.corePixels < 2_000);
  if (objects.length !== 4 || noise.some((component) => component.maxAlpha > 1))
    throw new Error(
      `${source}: expected four complete objects and only isolated alpha-1 background noise`,
    );
  const ordered: (Component | undefined)[] = Array(4);
  for (const object of objects) {
    if (
      object.coreMinX < 5 ||
      object.coreMinY < 5 ||
      object.coreMaxX >= info.width - 5 ||
      object.coreMaxY >= info.height - 5
    )
      throw new Error(
        `${source}: object ${object.label} is cut at the outer edge`,
      );
    const column = Math.floor(
      ((object.coreMinX + object.coreMaxX) / 2 / info.width) * 2,
    );
    const row = Math.floor(
      ((object.coreMinY + object.coreMaxY) / 2 / info.height) * 2,
    );
    const cell = row * 2 + column;
    if (ordered[cell])
      throw new Error(`${source}: objects overlap the same centre quadrant`);
    ordered[cell] = object;
  }
  if (ordered.some((component) => !component))
    throw new Error(`${source}: missing furniture quadrant`);
  // Translate whole objects without scaling. The table may cross a source grid
  // line; only its centre selects a quadrant. Output cells add >=16px of margin.
  const cellSize =
    Math.ceil(
      (Math.max(
        ...objects.map((object) => {
          const frame = bounds(object);
          return Math.max(frame.width, frame.height);
        }),
      ) +
        32) /
        32,
    ) * 32;
  const width = cellSize * 2;
  const height = cellSize * 2;
  const packed = Buffer.alloc(width * height * 4);
  const frames: Record<string, Bounds> = {};
  const objectAudit = [];
  for (const [index, name] of names.entries()) {
    const object = ordered[index]!;
    const sourceBounds = bounds(object);
    const frame = {
      x:
        (index % 2) * cellSize +
        Math.floor((cellSize - sourceBounds.width) / 2),
      y:
        Math.floor(index / 2) * cellSize +
        Math.floor((cellSize - sourceBounds.height) / 2),
      width: sourceBounds.width,
      height: sourceBounds.height,
    };
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const sourcePixel =
          (sourceBounds.y + y) * info.width + sourceBounds.x + x;
        if (labels[sourcePixel] !== object.label) continue;
        const destinationPixel = (frame.y + y) * width + frame.x + x;
        data.copy(
          packed,
          destinationPixel * 4,
          sourcePixel * 4,
          sourcePixel * 4 + 4,
        );
      }
    }
    frames[name] = frame;
    objectAudit.push({
      name,
      sourceBounds,
      frame,
      pixels: object.pixels,
      corePixels: object.corePixels,
    });
  }
  const raw = { width, height, channels: 4 as const };
  const png = await sharp(packed, { raw }).png().toBuffer();
  const webp = await sharp(packed, { raw })
    .webp({ lossless: true, exact: true, effort: 6 })
    .toBuffer();
  const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
  if (!decoded.equals(packed))
    throw new Error(`${destination}: lossless RGBA roundtrip failed`);
  const alpha = Buffer.alloc(width * height);
  for (let index = 0; index < alpha.length; index++)
    alpha[index] = packed[index * 4 + 3];
  await mkdir("public/assets", { recursive: true });
  await mkdir("docs/finales", { recursive: true });
  await writeFile(normalized, png);
  await writeFile(destination, webp);
  await writeFile(
    "shared/finale-cafe-assets.json",
    JSON.stringify({ file: "finales-cafe-furniture", frames }, null, 2) + "\n",
  );
  await writeFile(
    "docs/finales/cafe-furniture.json",
    JSON.stringify(
      {
        tool: "image_gen.imagegen",
        source,
        normalized,
        destination,
        sourceWidth: info.width,
        sourceHeight: info.height,
        width,
        height,
        cellSize,
        frames,
        objects: objectAudit,
        sourceSha256: hash(original),
        normalizedSha256: hash(png),
        sha256: hash(webp),
        rgbaSha256: hash(packed),
        alphaSha256: hash(alpha),
        discardedNoise: {
          components: noise.length,
          pixels: noise.reduce((sum, component) => sum + component.pixels, 0),
          maxAlpha: Math.max(
            0,
            ...noise.map((component) => component.maxAlpha),
          ),
        },
        preservation:
          "Source untouched; every RGBA pixel in the four complete nonzero-alpha connected objects is copied exactly. Only disconnected alpha-1 background noise is discarded. No repainting or rescaling.",
        bytes: webp.length,
        encoding: "lossless RGBA",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `finales-cafe-furniture: 4 complete objects, ${width}×${height}, ${Math.round(webp.length / 1024)} KiB`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await prepareCafeFurniture();
