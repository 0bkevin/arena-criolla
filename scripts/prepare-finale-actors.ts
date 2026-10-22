import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";
import { FINALE_ASSET_GROUPS } from "../shared/finales";

export const ACTOR_CELL = 512;
export const ACTOR_BASELINE = 482;
export const PERFORMER_ATLASES = [
  { id: "nacho", file: "finales-nacho-dance" },
  { id: "giuseppe", file: "finales-giuseppe-hack" },
] as const;
// A separate sheet refreshes identities without repainting approved neighbours.
export const SEATED_IDENTITY_REFRESH = {
  file: "finales-seated-main-v1",
  ids: ["capriles", "nacho", "javier", "knoche"],
} as const;
const VERSION = 1;
const hash = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

export interface ActorFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ActorGeometry {
  frame: ActorFrame;
  bodyHeight: number;
  anchorX: number;
}
interface Component {
  label: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
  frame: number;
}
interface PackingAudit {
  file: string;
  raw: string;
  source: string;
  runtime: string;
  columns: number;
  rows: number;
  inputSha256: string;
  sourceSha256: string;
  runtimeSha256: string;
  alphaSha256: string;
  rgbaSha256: string;
  frames: ActorGeometry[];
  fingerprint?: string;
}

function bounds(
  rgba: Buffer,
  width: number,
  left: number,
  top: number,
  cell: number,
) {
  let minX = left + cell,
    minY = top + cell,
    maxX = -1,
    maxY = -1;
  for (let y = top; y < top + cell; y++)
    for (let x = left; x < left + cell; x++) {
      if (!rgba[(y * width + x) * 4 + 3]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  if (maxX < minX || maxY < minY) throw new Error("Celda de actor vacía");
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function actorHeadAnchor(
  rgba: Buffer,
  atlasWidth: number,
  frame: ActorFrame,
) {
  const bottom = frame.y + Math.max(1, Math.ceil(frame.height * 0.24));
  let weightedX = 0,
    weight = 0;
  for (let y = frame.y; y < bottom; y++)
    for (let x = frame.x; x < frame.x + frame.width; x++) {
      const alpha = rgba[(y * atlasWidth + x) * 4 + 3];
      if (alpha < 200) continue;
      weightedX += (x - frame.x + 0.5) * alpha;
      weight += alpha;
    }
  if (!weight)
    throw new Error("El actor no tiene una cabeza opaca identificable");
  return weightedX / weight;
}

/** Anchor new dancing figures on their torso, away from raised fists. */
export function actorDanceAnchor(
  rgba: Buffer,
  atlasWidth: number,
  frame: ActorFrame,
) {
  const top = frame.y + Math.floor(frame.height * 0.45);
  const bottom = frame.y + Math.ceil(frame.height * 0.65);
  const rowMedians: number[] = [];
  for (let y = top; y < bottom; y++) {
    let weight = 0;
    for (let x = frame.x; x < frame.x + frame.width; x++) {
      const alpha = rgba[(y * atlasWidth + x) * 4 + 3];
      if (alpha >= 200) weight += alpha;
    }
    if (!weight) continue;
    let cumulative = 0;
    for (let x = frame.x; x < frame.x + frame.width; x++) {
      const alpha = rgba[(y * atlasWidth + x) * 4 + 3];
      if (alpha < 200) continue;
      if (cumulative + alpha >= weight / 2) {
        rowMedians.push(x - frame.x + (weight / 2 - cumulative) / alpha);
        break;
      }
      cumulative += alpha;
    }
  }
  if (!rowMedians.length)
    throw new Error("La pose de baile no tiene un torso opaco identificable");
  rowMedians.sort((a, b) => a - b);
  const middle = Math.floor(rowMedians.length / 2);
  return rowMedians.length % 2
    ? rowMedians[middle]
    : (rowMedians[middle - 1] + rowMedians[middle]) / 2;
}

/** Move complete normalized pixels; do not stretch, repaint, or repair a pose. */
export async function alignActorAtlas(
  source: Buffer,
  columns: number,
  rows: number,
) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== columns * ACTOR_CELL || info.height !== rows * ACTOR_CELL)
    throw new Error("El atlas normalizado no tiene celdas de 512 píxeles");
  const packed = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < columns * rows; index++) {
    const slotX = (index % columns) * ACTOR_CELL,
      slotY = Math.floor(index / columns) * ACTOR_CELL;
    const frame = bounds(data, info.width, slotX, slotY, ACTOR_CELL);
    if (frame.width > 500 || frame.height > ACTOR_BASELINE - 5)
      throw new Error(`Pose ${index + 1}: no cabe completa en la celda`);
    const left = slotX + Math.floor((ACTOR_CELL - frame.width) / 2);
    const top = slotY + ACTOR_BASELINE - frame.height;
    for (let y = 0; y < frame.height; y++) {
      const start = ((frame.y + y) * info.width + frame.x) * 4;
      data.copy(
        packed,
        ((top + y) * info.width + left) * 4,
        start,
        start + frame.width * 4,
      );
    }
  }
  return sharp(packed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** The four-pose café sheet uses the same isolation rules with a 2×2 layout. */
export async function normalizeActorPoses(
  source: Buffer,
  columns: number,
  rows: number,
) {
  const metadata = await sharp(source, {
    limitInputPixels: 16_000_000,
  }).metadata();
  if (metadata.format !== "png" || !metadata.hasAlpha)
    throw new Error("Se necesita un PNG transparente de poses completas");
  const { data, info } = await sharp(source)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const labels = new Int32Array(width * height),
    queue = new Int32Array(width * height);
  const components: Component[] = [];
  let label = 0,
    noise = 0,
    transparent = 0;
  for (let p = 0; p < labels.length; p++) {
    const alpha = data[p * 4 + 3];
    if (alpha < 30) transparent++;
    if (labels[p] || alpha < 40) continue;
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
      const next = queue[head++],
        x = next % width,
        y = Math.floor(next / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const neighbor of [
        x ? next - 1 : -1,
        x < width - 1 ? next + 1 : -1,
        y ? next - width : -1,
        y < height - 1 ? next + width : -1,
      ])
        if (
          neighbor >= 0 &&
          !labels[neighbor] &&
          data[neighbor * 4 + 3] >= 40
        ) {
          labels[neighbor] = own;
          queue[tail++] = neighbor;
        }
    }
    if (tail < 32) {
      noise += tail;
      continue;
    }
    const column = Math.floor((minX + maxX) / 2 / (width / columns));
    const row = Math.floor((minY + maxY) / 2 / (height / rows));
    components.push({
      label: own,
      minX,
      minY,
      maxX,
      maxY,
      pixels: tail,
      frame: row * columns + column,
    });
  }
  if (
    components.length !== columns * rows ||
    noise > 128 ||
    transparent < width * height * 0.18
  )
    throw new Error(
      `Se requieren ${columns * rows} siluetas separadas: llegaron ${components.length}, ruido ${noise}`,
    );
  components.sort((a, b) => a.frame - b.frame);
  for (const [index, component] of components.entries())
    if (
      component.frame !== index ||
      component.minX < 5 ||
      component.minY < 5 ||
      component.maxX > width - 6 ||
      component.maxY > height - 6 ||
      component.pixels < ((width * height) / (columns * rows)) * 0.035
    )
      throw new Error(
        `Pose ${index + 1}: orden incorrecto, recortada o incompleta`,
      );
  const scale = Math.min(
    440 / (components[0].maxY - components[0].minY + 5),
    ...components.map((c) =>
      Math.min(450 / (c.maxX - c.minX + 5), 450 / (c.maxY - c.minY + 5)),
    ),
  );
  const layers = [],
    signatures = new Set<string>();
  for (const component of components) {
    const left = component.minX - 2,
      top = component.minY - 2;
    const w = component.maxX - component.minX + 5,
      h = component.maxY - component.minY + 5;
    const pixels = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sx = left + x,
          sy = top + y,
          p = sy * width + sx;
        let own = labels[p] === component.label;
        if (!own && data[p * 4 + 3] < 40)
          for (let dy = -2; dy <= 2 && !own; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const nx = sx + dx,
                ny = sy + dy;
              if (
                nx >= 0 &&
                nx < width &&
                ny >= 0 &&
                ny < height &&
                labels[ny * width + nx] === component.label
              ) {
                own = true;
                break;
              }
            }
        if (own) data.copy(pixels, (y * w + x) * 4, p * 4, p * 4 + 4);
      }
    const signature = `${w}:${h}:${hash(pixels)}`;
    if (signatures.has(signature))
      throw new Error("Hay poses de café repetidas");
    signatures.add(signature);
    const outW = Math.max(1, Math.round(w * scale)),
      outH = Math.max(1, Math.round(h * scale));
    layers.push({
      input: await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
        .resize(outW, outH)
        .png()
        .toBuffer(),
      left:
        (component.frame % columns) * ACTOR_CELL +
        Math.floor((ACTOR_CELL - outW) / 2),
      top:
        Math.floor(component.frame / columns) * ACTOR_CELL +
        ACTOR_BASELINE -
        outH,
    });
  }
  return sharp({
    create: {
      width: columns * ACTOR_CELL,
      height: rows * ACTOR_CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

export async function validateActorAtlas(
  png: Buffer,
  webp: Buffer,
  columns: number,
  rows: number,
  sameActor = false,
  anchor: "head" | "dance" = "head",
) {
  const source = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const runtime = await sharp(webp)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    source.info.width !== columns * ACTOR_CELL ||
    source.info.height !== rows * ACTOR_CELL ||
    runtime.info.width !== source.info.width ||
    runtime.info.height !== source.info.height
  )
    throw new Error("Dimensiones de atlas de actor inesperadas");
  const alpha = Buffer.alloc(source.info.width * source.info.height);
  for (let p = 0; p < alpha.length; p++) {
    alpha[p] = source.data[p * 4 + 3];
    if (alpha[p] !== runtime.data[p * 4 + 3])
      throw new Error("El WebP cambió el canal alpha");
  }
  if (!source.data.equals(runtime.data))
    throw new Error("El WebP no conserva los píxeles RGBA exactos");
  const frames: ActorGeometry[] = [];
  for (let index = 0; index < columns * rows; index++) {
    const slotX = (index % columns) * ACTOR_CELL,
      slotY = Math.floor(index / columns) * ACTOR_CELL;
    const frame = bounds(
      source.data,
      source.info.width,
      slotX,
      slotY,
      ACTOR_CELL,
    );
    if (
      frame.x <= slotX + 4 ||
      frame.x + frame.width >= slotX + ACTOR_CELL - 4 ||
      frame.y <= slotY + 4 ||
      frame.y + frame.height !== slotY + ACTOR_BASELINE
    )
      throw new Error(`Pose ${index + 1}: borde o baseline incorrectos`);
    frames.push({
      frame,
      bodyHeight: frame.height,
      anchorX: (anchor === "dance" ? actorDanceAnchor : actorHeadAnchor)(
        source.data,
        source.info.width,
        frame,
      ),
    });
  }
  // Preserve one actor's scale across gestures; a bent pose keeps its own crop.
  if (sameActor)
    for (const frame of frames) frame.bodyHeight = frames[0].frame.height;
  return { frames, alphaSha256: hash(alpha), rgbaSha256: hash(source.data) };
}

async function optionalRead(file: string) {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
async function writeChanged(file: string, data: Buffer | string) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if ((await optionalRead(file))?.equals(bytes)) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export async function prepareFinaleActors(
  root = process.cwd(),
  options: { only?: readonly string[] } = {},
) {
  const auditPath = path.join(root, "docs/finales/actor-packing.json");
  const priorBytes = await optionalRead(auditPath);
  const prior = priorBytes
    ? (JSON.parse(priorBytes.toString()) as {
        version: number;
        fingerprint: string;
        assets: PackingAudit[];
      })
    : undefined;
  const refreshRaw = await optionalRead(
    path.join(
      root,
      `assets/source/finales/${SEATED_IDENTITY_REFRESH.file}-generated.png`,
    ),
  );
  const allInputs = [
    ...FINALE_ASSET_GROUPS.map((ids, index) => ({
      file: `finales-seated-v1-${index + 1}`,
      ids: [...ids],
      columns: 4,
      rows: 2,
      anchor: "head" as const,
    })),
    {
      file: "finales-capriles-cafe",
      ids: [],
      columns: 2,
      rows: 2,
      anchor: "head" as const,
    },
    ...PERFORMER_ATLASES.map(({ file }) => ({
      file,
      ids: [],
      columns: 4,
      rows: 2,
      anchor: "head" as const,
    })),
    ...(refreshRaw ||
    prior?.assets.some(({ file }) => file === SEATED_IDENTITY_REFRESH.file) ||
    options.only?.includes(SEATED_IDENTITY_REFRESH.file)
      ? [
          {
            ...SEATED_IDENTITY_REFRESH,
            columns: 2,
            rows: 2,
            anchor: "head" as const,
          },
        ]
      : []),
  ];
  if (options.only?.length === 0)
    throw new Error("La selección de atlas no puede estar vacía");
  for (const file of options.only ?? [])
    if (!allInputs.some((input) => input.file === file))
      throw new Error(`Atlas de actores desconocido: ${file}`);
  const inputs = options.only
    ? allInputs.filter(({ file }) => options.only!.includes(file))
    : allInputs;
  // Explicit selections may arrive independently. Every requested raw must
  // exist and pass; missing or malformed selections never get silently skipped.
  const raws = await Promise.all(
    inputs.map(({ file }) =>
      readFile(path.join(root, `assets/source/finales/${file}-generated.png`)),
    ),
  );
  const fingerprint = hash(
    Buffer.concat([
      await readFile(fileURLToPath(import.meta.url)),
      await readFile(
        new URL("../server/creator/normalize-atlas.ts", import.meta.url),
      ),
      Buffer.from(JSON.stringify(sharp.versions)),
    ]),
  );
  const selectedAssets: PackingAudit[] = [],
    pending: { source: string; runtime: string; png: Buffer; webp: Buffer }[] =
      [];
  let converted = 0;
  for (const [index, spec] of inputs.entries()) {
    const raw = `assets/source/finales/${spec.file}-generated.png`,
      source = `assets/source/finales/${spec.file}.png`,
      runtime = `public/assets/${spec.file}.webp`;
    const inputSha256 = hash(raws[index]);
    const cached =
      prior?.version === VERSION
        ? prior.assets.find(
            (entry) =>
              entry.file === spec.file &&
              entry.inputSha256 === inputSha256 &&
              (entry.fingerprint ?? prior.fingerprint) === fingerprint,
          )
        : undefined;
    if (cached) {
      const [png, webp] = await Promise.all([
        optionalRead(path.join(root, source)),
        optionalRead(path.join(root, runtime)),
      ]);
      if (
        png &&
        webp &&
        hash(png) === cached.sourceSha256 &&
        hash(webp) === cached.runtimeSha256
      ) {
        selectedAssets.push({ ...cached, fingerprint });
        continue;
      }
    }
    try {
      const normalized =
        spec.columns === 4
          ? (await normalizeGeneratedAtlas(raws[index])).png
          : await normalizeActorPoses(raws[index], spec.columns, spec.rows);
      const png = await alignActorAtlas(normalized, spec.columns, spec.rows);
      const webp = await sharp(png)
        .webp({ lossless: true, exact: true, effort: 6 })
        .toBuffer();
      const geometry = await validateActorAtlas(
        png,
        webp,
        spec.columns,
        spec.rows,
        spec.ids.length === 0,
        spec.anchor,
      );
      selectedAssets.push({
        file: spec.file,
        raw,
        source,
        runtime,
        columns: spec.columns,
        rows: spec.rows,
        inputSha256,
        sourceSha256: hash(png),
        runtimeSha256: hash(webp),
        fingerprint,
        ...geometry,
      });
      pending.push({ source, runtime, png, webp });
      converted++;
    } catch (error) {
      throw new Error(
        `${spec.file}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
  // Retain unselected published actors byte-for-byte. Cache fingerprints belong
  // to each atlas so preparing one cannot mark untouched older output current.
  const assets = allInputs.flatMap(({ file }) => {
    const updated = selectedAssets.find((entry) => entry.file === file);
    if (updated) return [updated];
    const retained = prior?.assets.find((entry) => entry.file === file);
    return retained
      ? [
          {
            ...retained,
            fingerprint: retained.fingerprint ?? prior!.fingerprint,
          },
        ]
      : [];
  });
  const seated: Record<string, { file: string } & ActorGeometry> = {};
  for (const [index, ids] of FINALE_ASSET_GROUPS.entries())
    for (const [slot, id] of ids.entries()) {
      const asset = assets.find(
        (entry) => entry.file === `finales-seated-v1-${index + 1}`,
      );
      if (asset) seated[id] = { file: asset.file, ...asset.frames[slot] };
    }
  const refreshedSeats = assets.find(
    ({ file }) => file === SEATED_IDENTITY_REFRESH.file,
  );
  if (refreshedSeats)
    for (const [slot, id] of SEATED_IDENTITY_REFRESH.ids.entries())
      seated[id] = {
        file: refreshedSeats.file,
        ...refreshedSeats.frames[slot],
      };
  const flattenFrames = (asset: PackingAudit) =>
    asset.frames.map(({ frame, bodyHeight, anchorX }) => ({
      ...frame,
      bodyHeight,
      anchorX,
    }));
  const cafe = assets.find((entry) => entry.file === "finales-capriles-cafe");
  const performers = Object.fromEntries(
    PERFORMER_ATLASES.flatMap(({ id, file }) => {
      const asset = assets.find((entry) => entry.file === file);
      return asset ? [[id, { file, frames: flattenFrames(asset) }]] : [];
    }),
  );
  const manifest = {
    seated,
    caprilesCafe: cafe
      ? { file: cafe.file, frames: flattenFrames(cafe) }
      : undefined,
    performers,
  };
  for (const item of pending) {
    await writeChanged(path.join(root, item.source), item.png);
    await writeChanged(path.join(root, item.runtime), item.webp);
  }
  await writeChanged(
    path.join(root, "shared/finale-actor-assets.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await writeChanged(
    auditPath,
    JSON.stringify(
      {
        version: VERSION,
        fingerprint,
        cell: ACTOR_CELL,
        baseline: ACTOR_BASELINE,
        assets,
      },
      null,
      2,
    ) + "\n",
  );
  return { converted, cached: inputs.length - converted, manifest, assets };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  prepareFinaleActors(process.cwd(), {
    only: (() => {
      const args = process.argv.slice(2);
      if (!args.length) return undefined;
      const files: string[] = [];
      for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        const selection =
          arg === "--only"
            ? args[++index]
            : arg.startsWith("--only=")
              ? arg.slice("--only=".length)
              : undefined;
        if (!selection)
          throw new Error(
            "Uso: prepare-finale-actors.ts [--only atlas[,atlas]]",
          );
        files.push(...selection.split(",").filter(Boolean));
      }
      return files;
    })(),
  })
    .then(({ converted, cached }) =>
      console.log(
        `Actores finales: ${converted} atlas procesados, ${cached} en caché.`,
      ),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
