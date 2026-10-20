import sharp from "sharp";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Normalize generated animation cells without repainting or replacing their alpha.
const source = "assets/source/yummy-courier-v1.png";
if (process.argv[2]) await copyFile(process.argv[2], source);
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const cellWidth = info.width / 2;
const cellHeight = info.height / 2;
if (!Number.isInteger(cellWidth) || !Number.isInteger(cellHeight))
  throw new Error("The atlas must have four equal cells.");
const frames = [];
const composites = [];
const width = 448,
  height = 320,
  baseline = 306,
  bodyHeight = 284;
for (let index = 0; index < 4; index++) {
  const sx = (index % 2) * cellWidth,
    sy = Math.floor(index / 2) * cellHeight;
  let left = cellWidth,
    top = cellHeight,
    right = -1,
    bottom = -1;
  for (let y = 0; y < cellHeight; y++)
    for (let x = 0; x < cellWidth; x++) {
      if (data[((sy + y) * info.width + sx + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  if (right < left || bottom < top)
    throw new Error(`Empty sprite cell ${index}`);
  if (left < 8 || top < 8 || right > cellWidth - 8 || bottom > cellHeight - 8)
    throw new Error(`Clipped sprite cell ${index}`);
  const crop = {
    left: sx + Math.max(0, left - 3),
    top: sy + Math.max(0, top - 3),
    width: right - left + 7,
    height: bottom - top + 7,
  };
  const image = await sharp(source)
    .extract(crop)
    .resize({ height: bodyHeight, withoutEnlargement: true })
    .png()
    .toBuffer();
  const size = await sharp(image).metadata();
  if (size.width > width - 16)
    throw new Error(`Sprite ${index} exceeds its cell`);
  composites.push({
    input: image,
    left: (index % 2) * width + Math.floor((width - size.width) / 2),
    top: Math.floor(index / 2) * height + baseline - size.height,
  });
  frames.push({
    x: (index % 2) * width,
    y: Math.floor(index / 2) * height,
    width,
    height,
    sourceBounds: crop,
  });
}
const runtime = "public/assets/yummy-courier-v1.webp";
await sharp({
  create: {
    width: width * 2,
    height: height * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .webp({ lossless: true })
  .toFile(runtime);
const bytes = await readFile(runtime);
const sourceBytes = await readFile(source);
const manifest = {
  file: "yummy-courier-v1",
  columns: 2,
  frameCount: 4,
  cellWidth: width,
  cellHeight: height,
  baseline,
  bodyHeight,
  frames,
  runtime,
  source,
  runtimeSha256: createHash("sha256").update(bytes).digest("hex"),
  sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
  alpha: true,
};
await writeFile(
  "shared/courier-assets.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    runtime,
    width: width * 2,
    height: height * 2,
    bytes: bytes.length,
    frames: frames.length,
  }),
);
