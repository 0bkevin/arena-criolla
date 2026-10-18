import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

const ids = ["javier", "javier-entrance", "nacho", "nacho-entrance"];

const packed = [];
// Preflight all four sources before replacing any active artwork.
for (const id of ids) {
  const raw = `assets/source/identity-v42/${id}-generated.png`;
  const normalized = await normalizeGeneratedAtlas(await readFile(raw));
  const webp = await sharp(normalized.png)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  packed.push({ id, raw, ...normalized, webp });
}
await mkdir("docs/identity-v42", { recursive: true });
for (const { id, raw, png, webp, audit } of packed) {
  const sprite = id.endsWith("-entrance")
    ? `${id.replace("-entrance", "")}-v42-defiant-entrance`
    : `${id}-v42`;
  const source = `assets/source/${sprite}.png`;
  const runtime = `public/assets/${sprite}.webp`;
  await writeFile(source, png);
  await writeFile(runtime, webp);
  await writeFile(
    `docs/identity-v42/${id}-packing.json`,
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
      `docs/identity-v42/${id}-geometry.json`,
      JSON.stringify(geometry, null, 2) + "\n",
    );
  }
  console.log(
    `${id}: eight complete silhouettes, padded cells and lossless WebP.`,
  );
}
