import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { FINALE_ASSET_GROUPS } from "../shared/finales";
import { prepareCafeFurniture } from "./prepare-cafe-furniture";

const report = [];
await mkdir("public/assets", { recursive: true });
for (const [group, fighters] of FINALE_ASSET_GROUPS.entries()) {
  const stem = `finales-v1-${group + 1}`;
  const source = `assets/source/finales/${stem}.png`;
  const destination = `public/assets/${stem}.webp`;
  const png = await readFile(source);
  const metadata = await sharp(png).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width % 4 ||
    metadata.height % 2 ||
    !metadata.hasAlpha
  )
    throw new Error(`${source}: expected a transparent 4×2 atlas`);
  await sharp(png)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(destination);
  const webp = await readFile(destination);
  report.push({
    group: group + 1,
    source,
    destination,
    width: metadata.width,
    height: metadata.height,
    fighters,
    sha256: createHash("sha256").update(webp).digest("hex"),
    bytes: webp.length,
  });
  console.log(
    `${stem}: ${fighters.length} kits, ${Math.round(webp.length / 1024)} KiB`,
  );
}
await writeFile(
  "docs/finales/assets.json",
  JSON.stringify(
    {
      tool: "image_gen.imagegen",
      transparentBackground: true,
      columns: 4,
      rows: 2,
      assets: report,
    },
    null,
    2,
  ) + "\n",
);

// Also runnable alone without converting the six other prop sheets again.
await prepareCafeFurniture();
