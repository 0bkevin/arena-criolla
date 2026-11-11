// Cut each fighter's roster-card bust out of its battle atlas.
//
// The lobby draws every card from the full 2048x1024 sprite sheet, so the first
// page of the roster used to download ~8 MB before the cards appeared. This
// writes the one pose the card shows, isolated exactly like the runtime does
// and retains the whole frame for selection portraits, at the atlas's own
// resolution and losslessly. The manifest records the placement
// so Portrait draws the same pixels without the sheet.
//
// Usage: npx tsx scripts/generate-portrait-busts.ts [--check]
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { FIGHTERS, type FighterId } from "../shared/content";
import { presentationById } from "../shared/presentation";
import atlasManifest from "../shared/sprite-geometry.json";
import entranceManifest from "../shared/entrance-assets.json";
import { selectionBodyHeight } from "../src/game/entrance-framing";
import type { EntranceAsset } from "../src/game/assets";
import { isolateFramePixels } from "../src/game/sprite-isolation";
import { type PortraitBust } from "../shared/portrait-busts";

const MANIFEST = "shared/portrait-busts.json";
// Atlas pixels kept around a non-isolated pose for edge filtering.
const EDGE = 2;
const check = process.argv.includes("--check");
const sha256 = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}
const overlaps = (a: Frame, b: Frame) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

/** Same weighted head-band centroid as portraitCenter() in src/game/assets.ts. */
function headCenter(pixels: Buffer, sheetWidth: number, frame: Frame): number {
  const bandHeight = Math.max(1, Math.ceil(frame.height * 0.24));
  let weightedX = 0;
  let weight = 0;
  for (let y = 0; y < bandHeight; y++)
    for (let x = 0; x < frame.width; x++) {
      const alpha = pixels[((frame.y + y) * sheetWidth + frame.x + x) * 4 + 3];
      if (alpha < 40) continue;
      weightedX += x * alpha;
      weight += alpha;
    }
  return frame.x + (weight ? weightedX / weight : frame.width / 2);
}

async function bustFor(id: FighterId) {
  const fighter = FIGHTERS.find((f) => f.id === id)!;
  const sourcePath = `public/assets/${fighter.sprite}.webp`;
  const checked = atlasManifest.sprites
    .find((entry) => entry.id === id)
    ?.files.find((file) => file.file === sourcePath);
  if (!checked?.passed || checked.components.length !== 8)
    throw new Error(`${id}: no verified atlas geometry for ${sourcePath}`);
  const source = await readFile(sourcePath);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== checked.width || info.height !== checked.height)
    throw new Error(`${id}: atlas size differs from sprite-geometry.json`);
  const cellWidth = info.width / 4;
  const cellHeight = info.height / 2;
  const frames = checked.components.map((bounds, index) => ({
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1,
    slotX: (index % 4) * cellWidth,
    slotY: Math.floor(index / 4) * cellHeight,
  }));
  const pose = presentationById(id).battleFrame;
  const frame = frames[pose];
  const bodyHeight = checked.components[0].maxY - checked.components[0].minY;
  const geometry = {
    frame: pose,
    bodyHeight,
    selectionHeight: Object.hasOwn(entranceManifest, id)
      ? selectionBodyHeight({
          entrance: (
            entranceManifest as Record<string, Omit<EntranceAsset, "image">>
          )[id],
          frames,
          battleFrame: pose,
          cellWidth,
          bodyHeight,
          baseline: checked.components[0].maxY + 1,
        })
      : 450,
    left: frame.x - frame.slotX - cellWidth / 2,
    center: headCenter(data, info.width, frame) - frame.slotX - cellWidth / 2,
    width: frame.width,
    height: frame.height,
    mirror: presentationById(id).frameFacing[pose],
  };
  const rows = frame.height;
  const region = (x: number, y: number, width: number, height: number) => {
    const out = Buffer.alloc(width * height * 4);
    for (let row = 0; row < height; row++)
      data.copy(
        out,
        row * width * 4,
        ((y + row) * info.width + x) * 4,
        ((y + row) * info.width + x + width) * 4,
      );
    return out;
  };
  let pixels: Buffer;
  let size: { width: number; height: number };
  let offset: { x: number; y: number };
  // The runtime isolates a pose only when its rectangle overlaps another one,
  // over the whole pose, and then samples that exact-size texture.
  if (frames.some((other, n) => n !== pose && overlaps(frame, other))) {
    const whole = region(frame.x, frame.y, frame.width, frame.height);
    const isolated = isolateFramePixels(
      new Uint8ClampedArray(whole.buffer, whole.byteOffset, whole.length),
      frame.width,
      frame.height,
    );
    pixels = Buffer.from(
      isolated.buffer,
      isolated.byteOffset,
      frame.width * rows * 4,
    );
    size = { width: frame.width, height: rows };
    offset = { x: 0, y: 0 };
  } else {
    // Otherwise it samples the atlas, whose neighbouring pixels soften the
    // pose's edges when scaled. Keep that context around the crop.
    const x0 = Math.max(0, frame.x - EDGE),
      y0 = Math.max(0, frame.y - EDGE),
      x1 = Math.min(info.width, frame.x + frame.width + EDGE),
      y1 = Math.min(info.height, frame.y + rows + EDGE);
    pixels = region(x0, y0, x1 - x0, y1 - y0);
    size = { width: x1 - x0, height: y1 - y0 };
    offset = { x: frame.x - x0, y: frame.y - y0 };
  }
  const image = await sharp(pixels, { raw: { ...size, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const file = `bust-${fighter.sprite}`;
  const entry: PortraitBust = {
    file,
    source: fighter.sprite,
    sourceSha256: sha256(source),
    sha256: sha256(image),
    ...geometry,
    rows,
    ...offset,
  };
  return { entry, image };
}

const previous: Record<string, PortraitBust> = JSON.parse(
  await readFile(MANIFEST, "utf8").catch(() => "{}"),
);
const next: Record<string, PortraitBust> = {};
let stale = 0;
let bytes = 0;
for (const fighter of FIGHTERS) {
  if (fighter.category === "community") continue;
  const { entry, image } = await bustFor(fighter.id);
  bytes += image.length;
  const old = previous[fighter.id];
  // Encoder output may differ between sharp releases: compare the inputs and
  // placement, and verify the committed file against its recorded digest.
  const { sha256: _, ...placement } = entry;
  const current =
    old &&
    JSON.stringify({ ...old, sha256: undefined }) ===
      JSON.stringify({ ...placement, sha256: undefined }) &&
    sha256(
      await readFile(`public/assets/${old.file}.webp`).catch(() =>
        Buffer.alloc(0),
      ),
    ) === old.sha256;
  next[fighter.id] = current ? old : entry;
  if (current) continue;
  stale++;
  if (check) console.error(`stale bust: ${fighter.id}`);
  else await writeFile(`public/assets/${entry.file}.webp`, image);
}
if (Object.keys(previous).length !== Object.keys(next).length) stale++;
if (check) {
  if (stale) {
    console.error("Run: npx tsx scripts/generate-portrait-busts.ts");
    process.exit(1);
  }
  console.log(`${Object.keys(next).length} portrait busts are current.`);
} else {
  await writeFile(MANIFEST, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `${Object.keys(next).length} busts, ${(bytes / 1e6).toFixed(2)} MB, ${stale} rewritten.`,
  );
}
