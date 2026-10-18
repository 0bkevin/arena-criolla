import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

const ids = ["enrique", "jesus", "carlos", "victor", "juan"];
const selected = process.argv.slice(2);
if (selected.some((id) => !ids.includes(id)))
  throw new Error("Unknown founder ID");

const packed = [];
// Validate every requested sheet before replacing any source or runtime asset.
for (const id of selected.length ? selected : ids) {
  const raw = `assets/source/founders-v3/${id}-generated.png`;
  const normalized = await normalizeGeneratedAtlas(await readFile(raw));
  const webp = await sharp(normalized.png)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  packed.push({ id, raw, ...normalized, webp });
}

await mkdir("docs/founders/style-v3", { recursive: true });
for (const { id, raw, png, webp, audit } of packed) {
  const source = `assets/source/${id}-v3.png`;
  const runtime = `public/assets/${id}-v3.webp`;
  await writeFile(source, png);
  await writeFile(runtime, webp);
  await writeFile(
    `docs/founders/style-v3/${id}-packing.json`,
    JSON.stringify({ id, raw, source, runtime, ...audit }, null, 2) + "\n",
  );
  console.log(`${id}: eight complete silhouettes packed with lossless alpha.`);
}
