import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const FILE = "finales-giuseppe-desk-v2";
const MARGIN = 16;
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Component {
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
}

/** Translate complete source pixels; never scale, repaint or reconstruct art. */
export async function packGiuseppeDesk(source: Buffer) {
  const metadata = await sharp(source, {
    limitInputPixels: 16_000_000,
  }).metadata();
  if (metadata.format !== "png" || !metadata.hasAlpha)
    throw new Error("Giuseppe desk requires a transparent PNG source");
  const { data, info } = await sharp(source, { limitInputPixels: 16_000_000 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const labels = new Int32Array(info.width * info.height);
  const queue = new Int32Array(labels.length);
  const components: Component[] = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || !data[start * 4 + 3]) continue;
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
    let head = 0,
      tail = 1;
    queue[0] = start;
    labels[start] = component.label;
    while (head < tail) {
      const pixel = queue[head++],
        x = pixel % info.width,
        y = Math.floor(pixel / info.width);
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
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height)
            continue;
          const neighbor = ny * info.width + nx;
          if (labels[neighbor] || !data[neighbor * 4 + 3]) continue;
          labels[neighbor] = component.label;
          queue[tail++] = neighbor;
        }
    }
    component.pixels = tail;
    components.push(component);
  }
  const objects = components.filter(
    (component) => component.corePixels >= 2_000,
  );
  // Preserve faint antialias islands one transparent pixel from the outline.
  // These alpha-2 pixels are artwork, not removable alpha-1 background noise.
  const main = objects[0];
  const satellites = components.filter((component) => {
    if (
      !main ||
      component === main ||
      component.maxAlpha !== 2 ||
      component.pixels > 32 ||
      component.minX < main.minX ||
      component.minY < main.minY ||
      component.maxX > main.maxX ||
      component.maxY > main.maxY
    )
      return false;
    for (
      let y = Math.max(0, component.minY - 2);
      y <= Math.min(info.height - 1, component.maxY + 2);
      y++
    )
      for (
        let x = Math.max(0, component.minX - 2);
        x <= Math.min(info.width - 1, component.maxX + 2);
        x++
      )
        if (labels[y * info.width + x] === main.label) return true;
    return false;
  });
  const noise = components.filter(
    (component) => component !== main && !satellites.includes(component),
  );
  const noisePixels = noise.reduce(
    (sum, component) => sum + component.pixels,
    0,
  );
  if (
    objects.length !== 1 ||
    noise.some(
      (component) => component.maxAlpha > 1 || component.pixels > 256,
    ) ||
    noisePixels > Math.max(16, labels.length * 0.02)
  )
    throw new Error(
      `Expected one complete desk/laptop object and only small disconnected alpha-1 noise; objects=${objects.length}, noise=${noise.length}/${noisePixels}px, largest=${Math.max(0, ...noise.map((component) => component.pixels))}px, maxAlpha=${Math.max(0, ...noise.map((component) => component.maxAlpha))}, visibleFragments=${JSON.stringify(noise.filter((component) => component.maxAlpha > 1).map((component) => ({ x: component.minX, y: component.minY, pixels: component.pixels, maxAlpha: component.maxAlpha })))}`,
    );
  const object = objects[0];
  if (
    object.coreMinX < 5 ||
    object.coreMinY < 5 ||
    object.coreMaxX >= info.width - 5 ||
    object.coreMaxY >= info.height - 5
  )
    throw new Error("Giuseppe desk is clipped at the source edge");
  const sourceBounds: Bounds = {
    x: object.minX,
    y: object.minY,
    width: object.maxX - object.minX + 1,
    height: object.maxY - object.minY + 1,
  };
  const frame: Bounds = {
    x: MARGIN,
    y: MARGIN,
    width: sourceBounds.width,
    height: sourceBounds.height,
  };
  const width = frame.width + MARGIN * 2,
    height = frame.height + MARGIN * 2;
  const packed = Buffer.alloc(width * height * 4);
  const keptLabels = new Set([
    object.label,
    ...satellites.map((component) => component.label),
  ]);
  for (let y = 0; y < frame.height; y++)
    for (let x = 0; x < frame.width; x++) {
      const pixel = (sourceBounds.y + y) * info.width + sourceBounds.x + x;
      if (!keptLabels.has(labels[pixel])) continue;
      data.copy(
        packed,
        ((frame.y + y) * width + frame.x + x) * 4,
        pixel * 4,
        pixel * 4 + 4,
      );
    }
  const raw = { width, height, channels: 4 as const };
  const png = await sharp(packed, { raw }).png().toBuffer();
  const webp = await sharp(packed, { raw })
    .webp({ lossless: true, exact: true, effort: 6 })
    .toBuffer();
  if (!(await sharp(webp).ensureAlpha().raw().toBuffer()).equals(packed))
    throw new Error("Giuseppe desk lossless WebP changed RGBA source pixels");
  const alpha = Buffer.alloc(width * height);
  for (let pixel = 0; pixel < alpha.length; pixel++)
    alpha[pixel] = packed[pixel * 4 + 3];
  return {
    png,
    webp,
    manifest: { file: FILE, frame },
    audit: {
      sourceWidth: info.width,
      sourceHeight: info.height,
      width,
      height,
      sourceBounds,
      frame,
      pixels:
        object.pixels +
        satellites.reduce((sum, component) => sum + component.pixels, 0),
      corePixels: object.corePixels,
      preservedAntialiasSatellites: satellites.map((component) => ({
        x: component.minX,
        y: component.minY,
        pixels: component.pixels,
        maxAlpha: component.maxAlpha,
      })),
      sourceSha256: hash(source),
      normalizedSha256: hash(png),
      sha256: hash(webp),
      rgbaSha256: hash(packed),
      alphaSha256: hash(alpha),
      discardedNoise: {
        components: noise.length,
        pixels: noisePixels,
        maxAlpha: Math.max(0, ...noise.map((component) => component.maxAlpha)),
      },
      preservation:
        "Generated source untouched; every RGBA pixel of the complete desk/laptop object and tiny alpha-2 antialias satellites within 2px of its outline is copied exactly with 16px transparent margins. Only small disconnected alpha-1 background noise is discarded. No repainting or rescaling.",
      bytes: webp.length,
      encoding: "lossless RGBA",
    },
  };
}

async function writeChanged(file: string, bytes: Buffer | string) {
  const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try {
    if ((await readFile(file)).equals(content)) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

export async function prepareGiuseppeDesk(root = process.cwd()) {
  const source = `assets/source/finales/${FILE}-generated.png`;
  const normalized = `assets/source/finales/${FILE}.png`;
  const destination = `public/assets/${FILE}.webp`;
  const prepared = await packGiuseppeDesk(
    await readFile(path.join(root, source)),
  );
  await writeChanged(path.join(root, normalized), prepared.png);
  await writeChanged(path.join(root, destination), prepared.webp);
  await writeChanged(
    path.join(root, "shared/finale-desk-assets.json"),
    JSON.stringify(prepared.manifest, null, 2) + "\n",
  );
  await writeChanged(
    path.join(root, "docs/finales/giuseppe-desk-v2.json"),
    JSON.stringify(
      {
        tool: "image_gen.imagegen",
        source,
        normalized,
        destination,
        ...prepared.audit,
      },
      null,
      2,
    ) + "\n",
  );
  return prepared;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  prepareGiuseppeDesk()
    .then((result) =>
      console.log(
        `${FILE}: ${result.audit.width}×${result.audit.height}, ${Math.round(result.webp.length / 1024)} KiB`,
      ),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
