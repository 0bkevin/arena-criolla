import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp, { type OutputInfo } from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

const inputDirectory = "assets/source/identity-v43";
const documentDirectory = "docs/identity-v43";
const pairNames = [
  "combat-01",
  "combat-23",
  "combat-45",
  "combat-67",
  "entrance-01",
  "entrance-23",
  "entrance-45",
] as const;
type PairName = (typeof pairNames)[number];
type SourceName = PairName | "run-alternate";
type Component = {
  label: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
};
type Figure = Component & { png: Buffer; width: number; height: number };
type FigureSource = {
  name: SourceName;
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  ignoredNoisePixels: number;
  figures: Figure[];
};

async function readFigures(
  name: SourceName,
  expectedFigures: 1 | 2,
): Promise<FigureSource> {
  const source = `${inputDirectory}/javier-${name}${name === "run-alternate" ? "" : "-generated"}.png`;
  const image = sharp(await readFile(source), { limitInputPixels: 16_000_000 });
  const metadata = await image.metadata();
  if (metadata.format !== "png" || !metadata.hasAlpha)
    throw new Error(`${source}: expected a transparent PNG.`);
  const { data, info }: { data: Buffer; info: OutputInfo } = await image
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(labels.length);
  const components: Component[] = [];
  let label = 0,
    noise = 0,
    transparent = 0;
  for (let p = 0; p < labels.length; p++) {
    if (data[p * 4 + 3] < 30) transparent++;
    if (labels[p] || data[p * 4 + 3] < 40) continue;
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
    components.length !== expectedFigures ||
    noise > 128 ||
    transparent < width * height * 0.18
  )
    throw new Error(
      `${source}: expected exactly ${expectedFigures} complete, separate silhouettes; found ${components.length} figures and ${noise} detached noise pixels.`,
    );
  components.sort((a, b) => a.minX + a.maxX - b.minX - b.maxX);
  const figures: Figure[] = [];
  for (const [index, component] of components.entries()) {
    if (
      component.minX < 5 ||
      component.minY < 5 ||
      component.maxX > width - 6 ||
      component.maxY > height - 6 ||
      component.pixels < (width * height * 0.035) / expectedFigures ||
      Math.floor(
        ((component.minX + component.maxX) * expectedFigures) / (width * 2),
      ) !== index
    )
      throw new Error(`${source}: figure ${index} is cropped or out of order.`);
    const left = component.minX - 2,
      top = component.minY - 2,
      w = component.maxX - component.minX + 5,
      h = component.maxY - component.minY + 5;
    const pixels = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sx = left + x,
          sy = top + y,
          p = sy * width + sx;
        let own = labels[p] === component.label;
        // Match the normalizer's alpha-only antialias handling. Invisible RGB
        // outside the silhouette is never interpreted as a background to erase.
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
    figures.push({
      ...component,
      width: w,
      height: h,
      png: await sharp(pixels, {
        raw: { width: w, height: h, channels: 4 },
      })
        .png()
        .toBuffer(),
    });
  }
  return {
    name,
    source,
    sourceWidth: width,
    sourceHeight: height,
    ignoredNoisePixels: noise,
    figures,
  };
}

async function readPair(name: PairName) {
  return readFigures(name, 2);
}

async function readSingle() {
  return readFigures("run-alternate", 1);
}

// Isolate all seven input pairs and the required alternate run before composing
// or writing either output. The rejected second figure of combat-23 is unused.
const sources = {} as Record<SourceName, FigureSource>;
for (const name of pairNames) sources[name] = await readPair(name);
sources["run-alternate"] = await readSingle();
const standingHeight = 880;
const height = (name: SourceName, index: 0 | 1) =>
  sources[name].figures[index].maxY - sources[name].figures[index].minY + 1;
const scales: Record<SourceName, number> = {
  "combat-01": standingHeight / height("combat-01", 0),
  // Running poses inherit the ready source's density. Their crouched
  // silhouettes must not be stretched to full standing height.
  "combat-23": 0,
  // Jump and punch share the punch's standing-body calibration.
  "combat-45": standingHeight / height("combat-45", 1),
  "combat-67": standingHeight / height("combat-67", 0),
  "entrance-01": standingHeight / height("entrance-01", 0),
  "entrance-23": standingHeight / height("entrance-23", 0),
  "entrance-45": standingHeight / height("entrance-45", 0),
  "run-alternate": 0,
};
for (const name of ["combat-23", "run-alternate"] as const)
  scales[name] =
    (scales["combat-01"] * sources["combat-01"].sourceHeight) /
    sources[name].sourceHeight;
const calibrationWarnings: string[] = [];
const readyFraction =
  height("combat-01", 0) / sources["combat-01"].sourceHeight;
for (const [name, index] of [
  ["combat-01", 0],
  ["combat-45", 1],
  ["combat-67", 0],
  ["entrance-01", 0],
  ["entrance-23", 0],
  ["entrance-45", 0],
] as const) {
  const fraction = height(name, index) / sources[name].sourceHeight;
  if (
    fraction < 0.6 ||
    fraction > 0.9 ||
    Math.abs(fraction - readyFraction) > 0.1
  )
    calibrationWarnings.push(
      `${name}: standing control occupies ${(fraction * 100).toFixed(1)}% of canvas height; ready occupies ${(readyFraction * 100).toFixed(1)}%. Review framing and head/body scale before publishing.`,
    );
}
for (const name of ["combat-23", "run-alternate"] as const) {
  const relativeHeight =
    height(name, 0) / sources[name].sourceHeight / readyFraction;
  const minimum = name === "run-alternate" ? 0.9 : 0.76,
    maximum = name === "run-alternate" ? 0.97 : 0.99;
  if (relativeHeight < minimum || relativeHeight > maximum)
    calibrationWarnings.push(
      `${name} figure 0: inherited-density running height is ${(relativeHeight * 100).toFixed(1)}% of ready height; review framing instead of stretching this pose independently.`,
    );
}
for (const warning of calibrationWarnings)
  console.warn(`FRAMING REVIEW: ${warning}`);

type Frame = { pair: SourceName; index: 0 | 1 };
const combatFrames: Frame[] = [
  { pair: "combat-01", index: 0 },
  { pair: "combat-01", index: 1 },
  { pair: "combat-23", index: 0 },
  { pair: "run-alternate", index: 0 },
  { pair: "combat-45", index: 0 },
  { pair: "combat-45", index: 1 },
  { pair: "combat-67", index: 0 },
  { pair: "combat-67", index: 1 },
];
const entranceFrames: Frame[] = [
  { pair: "entrance-01", index: 0 },
  { pair: "entrance-01", index: 1 },
  { pair: "entrance-23", index: 0 },
  { pair: "entrance-23", index: 1 },
  { pair: "entrance-45", index: 0 },
  { pair: "entrance-45", index: 1 },
  // The runtime uses only the six authored entrance poses. Distinct combat
  // strides fill the last two unused cells for the eight-silhouette format.
  combatFrames[2],
  combatFrames[3],
];

async function compose(frames: Frame[]) {
  // A single atlas-wide fit factor protects every limb without changing any
  // pair's relative pose scale or transforming heads independently of bodies.
  const fit = Math.min(
    1,
    ...frames.map(({ pair, index }) => {
      const figure = sources[pair].figures[index],
        scale = scales[pair];
      return Math.min(
        900 / (figure.width * scale),
        900 / (figure.height * scale),
      );
    }),
  );
  const layers = [];
  const frameAudit = [];
  for (const [frame, { pair, index }] of frames.entries()) {
    const figure = sources[pair].figures[index],
      scale = scales[pair] * fit,
      width = Math.max(1, Math.round(figure.width * scale)),
      height = Math.max(1, Math.round(figure.height * scale));
    layers.push({
      input: await sharp(figure.png).resize(width, height).png().toBuffer(),
      left: (frame % 4) * 1024 + Math.floor((1024 - width) / 2),
      top: Math.floor(frame / 4) * 1024 + 964 - height,
    });
    frameAudit.push({
      frame,
      source: sources[pair].source,
      pairIndex: index,
      scale,
      width,
      height,
      bounds: {
        minX: figure.minX,
        minY: figure.minY,
        maxX: figure.maxX,
        maxY: figure.maxY,
        pixels: figure.pixels,
      },
    });
  }
  const png = await sharp({
    create: {
      width: 4096,
      height: 2048,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
  return { png, frameAudit, fit };
}

async function entranceGeometry(png: Buffer, file: string) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frames = [];
  for (let frame = 0; frame < 6; frame++) {
    const slotX = (frame % 4) * 512,
      slotY = Math.floor(frame / 4) * 512;
    let minX = 512,
      minY = 512,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        if (data[((slotY + y) * info.width + slotX + x) * 4 + 3] < 40) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    if (maxX < minX || maxY < minY)
      throw new Error(`Empty entrance frame ${frame}.`);
    frames.push({
      x: slotX + minX,
      y: slotY + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      slotX,
      slotY,
    });
  }
  return {
    file,
    cell: 512,
    bodyHeight: frames[0].height,
    baseline: 482,
    anchorX: 256,
    width: info.width,
    height: info.height,
    frames,
  };
}

const packed = [];
for (const [id, frames] of [
  ["javier", combatFrames],
  ["javier-entrance", entranceFrames],
] as const) {
  const sprite = id === "javier" ? "javier-v43" : "javier-v43-defiant-entrance";
  const composed = await compose(frames);
  const normalized = await normalizeGeneratedAtlas(composed.png);
  const webp = await sharp(normalized.png)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const geometry =
    id === "javier-entrance"
      ? await entranceGeometry(normalized.png, sprite)
      : null;
  packed.push({ id, sprite, composed, ...normalized, webp, geometry });
}

// Both complete atlases, lossless encodings and entrance geometry pass preflight
// before any generated master, normalized source or runtime file is replaced.
await mkdir(documentDirectory, { recursive: true });
await mkdir("public/assets", { recursive: true });
for (const { id, sprite, composed, png, audit, webp, geometry } of packed) {
  const raw = `${inputDirectory}/${id}-composed.png`,
    source = `assets/source/${sprite}.png`,
    runtime = `public/assets/${sprite}.webp`;
  await writeFile(raw, composed.png);
  await writeFile(source, png);
  await writeFile(runtime, webp);
  await writeFile(
    `${documentDirectory}/${id}-packing.json`,
    JSON.stringify(
      {
        id,
        raw,
        source,
        runtime,
        ...audit,
        pairCalibration: {
          standingHeight,
          scales,
          fit: composed.fit,
          runScale: "ready pair scale adjusted for source canvas height",
          warnings: calibrationWarnings,
        },
        inputPairs: pairNames.map((name) => {
          const pair = sources[name];
          return {
            name,
            source: pair.source,
            sourceWidth: pair.sourceWidth,
            sourceHeight: pair.sourceHeight,
            ignoredNoisePixels: pair.ignoredNoisePixels,
          };
        }),
        inputSingles: ["run-alternate" as const].map((name) => {
          const single = sources[name];
          return {
            name,
            source: single.source,
            sourceWidth: single.sourceWidth,
            sourceHeight: single.sourceHeight,
            ignoredNoisePixels: single.ignoredNoisePixels,
          };
        }),
        authoredFrames: composed.frameAudit,
      },
      null,
      2,
    ) + "\n",
  );
  if (geometry)
    await writeFile(
      `${documentDirectory}/${id}-geometry.json`,
      JSON.stringify(geometry, null, 2) + "\n",
    );
  console.log(
    `${id}: paired poses packed whole, normalized and encoded losslessly.`,
  );
}
