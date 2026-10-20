import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Rebuild with `node scripts/prepare-entrance-assets.mjs`.
// Encode original PNGs, retaining their dimensions and full colour resolution.
// Content hashes let browsers cache cutouts without retaining stale artwork.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "public/assets");
const [fighters, manifest] = await Promise.all(
  ["shared/fighters.json", "docs/character-sprite-qa.json"].map(async (file) =>
    JSON.parse(await readFile(path.join(root, file), "utf8")),
  ),
);
await mkdir(output, { recursive: true });
const assets = {};
const generated = new Set();

for (const { id, frame } of [
  { id: "renny", frame: 5 }, // Punch, original facing.
  { id: "capriles", frame: 1 }, // Guard; the UI mirrors this pose.
]) {
  const fighter = fighters.find((entry) => entry.id === id);
  if (!fighter) throw new Error(`Missing fighter definition: ${id}`);
  const source = `assets/source/${fighter.sprite}.png`;
  const checked = manifest.sprites
    .find((entry) => entry.id === id)
    ?.files.find((entry) => entry.file === source);
  const metadata = await sharp(path.join(root, source)).metadata();
  if (
    !checked?.passed ||
    checked.components.length !== 8 ||
    checked.width !== metadata.width ||
    checked.height !== metadata.height
  ) {
    throw new Error(`Missing or stale validated sprite geometry: ${source}`);
  }
  const bounds = checked.components[frame];
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const crop = sharp(path.join(root, source)).extract({
    left: bounds.minX,
    top: bounds.minY,
    width,
    height,
  });
  assets[id] = { width, height };
  for (const format of ["avif", "webp"]) {
    const image = crop.clone();
    const data = await (
      format === "avif"
        ? image.avif({ quality: 80, effort: 6, chromaSubsampling: "4:4:4" })
        : image.webp({
            quality: 88,
            alphaQuality: 100,
            effort: 6,
            smartSubsample: true,
          })
    ).toBuffer();
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 12);
    const file = `entrance-${id}-${hash}.${format}`;
    await writeFile(path.join(output, file), data);
    generated.add(file);
    assets[id][format] = `/assets/${file}`;
    console.log(`${file}: ${width}×${height}, ${data.length} bytes`);
  }
}

// The server negotiates this shared background at the existing caracas.webp
// URL, so the splash, lobby and game reuse one download. WebP remains intact.
const background = await sharp(path.join(root, "assets/source/caracas.png"))
  .avif({ quality: 75, effort: 6, chromaSubsampling: "4:4:4" })
  .toBuffer();
await writeFile(path.join(output, "caracas.avif"), background);
console.log(`caracas.avif: ${background.length} bytes`);
await writeFile(
  path.join(root, "src/entrance-assets.json"),
  JSON.stringify(assets, null, 2) + "\n",
);

// Only retire this generator's old cutouts after all replacements exist.
for (const file of await readdir(output)) {
  if (
    /^entrance-(?:renny|capriles)(?:-[a-f0-9]{12})?\.(?:avif|webp)$/.test(
      file,
    ) &&
    !generated.has(file)
  ) {
    await rm(path.join(output, file));
  }
}
