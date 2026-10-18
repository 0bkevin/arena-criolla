import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

const ids = [
  "capriles",
  "lorenzo",
  "carolina",
  "dayana",
  "bolivar",
  "edgar",
  "capriles-entrance",
  "javier",
  "javier-entrance",
];
const selected = process.argv.slice(2);
if (selected.some((id) => !ids.includes(id)))
  throw new Error("Unknown v39 character");

const packed = [];
// Preflight every requested source before replacing any active artwork.
for (const id of selected.length ? selected : ids) {
  const raw = `assets/source/roster-v39/${id}-generated.png`;
  const normalized = await normalizeGeneratedAtlas(await readFile(raw));
  const webp = await sharp(normalized.png)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  packed.push({ id, raw, ...normalized, webp });
}
await mkdir("docs/roster-expansion-v39", { recursive: true });
for (const { id, raw, png, webp, audit } of packed) {
  const sprite = id.endsWith("-entrance")
    ? `${id.replace("-entrance", "")}-v39-defiant-entrance`
    : `${id}-v39`;
  const source = `assets/source/${sprite}.png`;
  const runtime = `public/assets/${sprite}.webp`;
  await writeFile(source, png);
  await writeFile(runtime, webp);
  await writeFile(
    `docs/roster-expansion-v39/${id}-packing.json`,
    JSON.stringify({ id, raw, source, runtime, ...audit }, null, 2) + "\n",
  );
  if (id.endsWith("-entrance")) {
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const frames = [];
    // The shared fold/hold/release action uses the first six authored poses.
    for (let frame = 0; frame < 6; frame++) {
      const slotX = (frame % 4) * 512,
        slotY = Math.floor(frame / 4) * 512;
      let minX = 512,
        minY = 512,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < 512; y++)
        for (let x = 0; x < 512; x++) {
          if (data[((slotY + y) * info.width + slotX + x) * 4 + 3] < 40)
            continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      frames.push({
        x: slotX + minX,
        y: slotY + minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        slotX,
        slotY,
      });
    }
    const geometry = {
      file: sprite,
      cell: 512,
      bodyHeight: frames[0].height,
      baseline: 482,
      anchorX: 256,
      width: info.width,
      height: info.height,
      frames,
    };
    await writeFile(
      `docs/roster-expansion-v39/${id}-geometry.json`,
      JSON.stringify(geometry, null, 2) + "\n",
    );
  }
  console.log(
    `${id}: eight complete silhouettes, padded cells and lossless WebP.`,
  );
}
