import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Reuse the authored punch frame; the intro never needs the full combat atlas.
const geometry = JSON.parse(
  await readFile("shared/sprite-geometry.json", "utf8"),
);
const sheet = geometry.sprites.find((sprite) => sprite.id === "capriles")
  .files[0];
const frame = sheet.components[5];
const width = frame.maxX - frame.minX + 1;
const height = frame.maxY - frame.minY + 1;
const source = await sharp(sheet.file)
  .extract({ left: frame.minX, top: frame.minY, width, height })
  .png()
  .toBuffer();
const manifestPath = "src/entrance-assets.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const asset = { width, height };
for (const format of ["avif", "webp"]) {
  const bytes = await sharp(source)
    .toFormat(format, { quality: format === "avif" ? 65 : 90, effort: 6 })
    .toBuffer();
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const filename = `entrance-capriles-${hash}.${format}`;
  await writeFile(`public/assets/${filename}`, bytes);
  asset[format] = `/assets/${filename}`;
}
manifest.capriles = asset;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
