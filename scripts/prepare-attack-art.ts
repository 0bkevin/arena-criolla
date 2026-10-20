import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp, { type OverlayOptions } from "sharp";

export interface AttackArtConfig {
  fighter: string;
  source: string;
  file: string;
  columns: number;
  rows: number;
  poses: string[];
  /** Source-local anchor fractions, e.g. a rider's feet rather than the horse's centre. */
  anchorFractions?: Record<string, number>;
}
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Pack complete transparent source cells; no painting, masking or anatomy manipulation. */
export async function prepareAttackArt(config: AttackArtConfig) {
  const { fighter, source, file, columns, rows, poses } = config;
  if (
    typeof fighter !== "string" ||
    typeof file !== "string" ||
    !/^[a-z0-9-]+$/.test(fighter) ||
    !/^[a-z0-9-]+$/.test(file)
  )
    throw Error("Invalid fighter or asset id");
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    columns > 8 ||
    rows > 8 ||
    !Array.isArray(poses) ||
    !poses.length ||
    poses.some(
      (pose) => typeof pose !== "string" || !/^[a-z0-9-]+$/.test(pose),
    ) ||
    columns * rows !== poses.length ||
    new Set(poses).size !== poses.length
  )
    throw Error("Each source cell needs a unique pose name");
  const original = await readFile(source);
  const meta = await sharp(original).metadata();
  if (!meta.hasAlpha)
    throw Error(`${source}: real source transparency is required`);
  const input = await sharp(original)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sw = input.info.width / columns,
    sh = input.info.height / rows;
  if (!Number.isInteger(sw) || !Number.isInteger(sh))
    throw Error("Source grid must divide image dimensions");
  const cell = 512,
    padding = 20;
  const frames: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      anchorX: number;
      anchorY: number;
      bodyHeight: number;
    }
  > = {};
  const objects = [];
  const layers: OverlayOptions[] = [];
  for (const [i, name] of poses.entries()) {
    const sx = (i % columns) * sw,
      sy = Math.floor(i / columns) * sh;
    let minX = sw,
      minY = sh,
      maxX = -1,
      maxY = -1,
      coreMinY = sh,
      coreMaxY = -1,
      visible = 0,
      transparent = 0;
    const cleaned = Buffer.alloc(sw * sh * 4);
    const visited = new Uint8Array(sw * sh);
    const queue = new Int32Array(sw * sh);
    const discardedNoise = { components: 0, pixels: 0, maxAlpha: 0 };
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const index = y * sw + x;
        const alpha =
          input.data[((sy + y) * input.info.width + sx + x) * 4 + 3];
        if (alpha === 0) transparent++;
        if (!alpha || visited[index]) continue;
        let head = 0,
          tail = 1,
          maxAlpha = 0;
        visited[index] = 1;
        queue[0] = index;
        while (head < tail) {
          const pixel = queue[head++],
            px = pixel % sw,
            py = Math.floor(pixel / sw);
          maxAlpha = Math.max(
            maxAlpha,
            input.data[((sy + py) * input.info.width + sx + px) * 4 + 3],
          );
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = px + dx,
                ny = py + dy;
              if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
              const next = ny * sw + nx;
              if (
                visited[next] ||
                !input.data[((sy + ny) * input.info.width + sx + nx) * 4 + 3]
              )
                continue;
              visited[next] = 1;
              queue[tail++] = next;
            }
        }
        // Keep even alpha-1 steam and antialiasing attached to a visible object.
        // Only completely disconnected alpha-1 background specks are discarded.
        if (maxAlpha === 1) {
          discardedNoise.components++;
          discardedNoise.pixels += tail;
          discardedNoise.maxAlpha = 1;
          continue;
        }
        for (let at = 0; at < tail; at++) {
          const pixel = queue[at],
            px = pixel % sw,
            py = Math.floor(pixel / sw);
          const sourcePixel = ((sy + py) * input.info.width + sx + px) * 4;
          input.data.copy(cleaned, pixel * 4, sourcePixel, sourcePixel + 4);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
          if (input.data[sourcePixel + 3] >= 40) {
            visible++;
            coreMinY = Math.min(coreMinY, py);
            coreMaxY = Math.max(coreMaxY, py);
            if (px < 5 || py < 5 || px >= sw - 5 || py >= sh - 5)
              throw Error(
                `${name}: visible art touches a grid edge; regenerate with complete silhouettes and gutters`,
              );
          }
        }
      }
    if (visible < 1000 || transparent < sw * sh * 0.12)
      throw Error(`${name}: incomplete silhouette or opaque background`);
    if (minX < 2 || minY < 2 || maxX >= sw - 2 || maxY >= sh - 2)
      throw Error(
        `${name}: nontrivial alpha touches a grid edge; review the raw sheet`,
      );
    const sourceBounds = {
      left: sx + minX,
      top: sy + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    const ratio = Math.min(
      (cell - padding * 2) / sourceBounds.width,
      (cell - padding * 2) / sourceBounds.height,
    );
    const width = Math.round(sourceBounds.width * ratio),
      height = Math.round(sourceBounds.height * ratio);
    const left = (i % columns) * cell + Math.floor((cell - width) / 2);
    const top = Math.floor(i / columns) * cell + cell - padding - height;
    const bytes = await sharp(cleaned, {
      raw: { width: sw, height: sh, channels: 4 },
    })
      .extract({
        left: minX,
        top: minY,
        width: sourceBounds.width,
        height: sourceBounds.height,
      })
      .resize(width, height, { fit: "fill" })
      .png()
      .toBuffer();
    layers.push({ input: bytes, left, top });
    const anchor = config.anchorFractions?.[name] ?? 0.5;
    if (!Number.isFinite(anchor) || anchor < 0 || anchor > 1)
      throw Error(`${name}: anchor outside painted bounds`);
    frames[name] = {
      x: left,
      y: top,
      width,
      height,
      anchorX: width * anchor,
      // Preserve faint alpha outside the body without letting it lift the feet
      // or reduce the visible character's intended height.
      anchorY: ((coreMaxY - minY + 1) * height) / sourceBounds.height,
      bodyHeight: ((coreMaxY - coreMinY + 1) * height) / sourceBounds.height,
    };
    objects.push({
      pose: name,
      sourceBounds,
      uniformScale: ratio,
      width,
      height,
      visibleSourcePixels: visible,
      transparentSourcePixels: transparent,
      coreBounds: { top: sy + coreMinY, bottom: sy + coreMaxY + 1 },
      discardedNoise,
    });
  }
  const width = cell * columns,
    height = cell * rows;
  const packed = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
  const rgba = await sharp(packed).ensureAlpha().raw().toBuffer();
  const runtime = await sharp(packed)
    .webp({ lossless: true, exact: true, effort: 6 })
    .toBuffer();
  const decoded = await sharp(runtime).ensureAlpha().raw().toBuffer();
  if (!rgba.equals(decoded))
    throw Error("Lossless runtime RGBA roundtrip failed");
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  const normalized = `assets/source/finales/attack-overhaul/${fighter}/${file}-packed.png`;
  const destination = `public/assets/${file}.webp`;
  const reportPath = `docs/finales/attack-overhaul/${fighter}/assets.json`;
  for (const path of [normalized, destination, reportPath])
    await mkdir(dirname(path), { recursive: true });
  await writeFile(normalized, packed);
  await writeFile(destination, runtime);
  const manifestPath = "shared/attack-assets.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest[fighter] = { file, frames };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  const report = {
    ...config,
    tool: "image_gen.imagegen",
    normalized,
    destination,
    width,
    height,
    cell,
    frames,
    objects,
    sourceSha256: sha(original),
    normalizedSha256: sha(packed),
    runtimeSha256: sha(runtime),
    rgbaSha256: sha(rgba),
    alphaSha256: sha(alpha),
    lossless: true,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `${fighter}: ${poses.length} complete poses, transparent ${width}×${height}, exact RGBA WebP`,
  );
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const path = process.argv[2];
  if (!path)
    throw Error(
      "Usage: npx tsx scripts/prepare-attack-art.ts path/to/config.json",
    );
  await prepareAttackArt(JSON.parse(await readFile(path, "utf8")));
}
