import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

// Preflight all eight complete silhouettes before writing the active files.
// The normalizer moves/scales whole figures; facial pixels are never patched.
const source = "assets/source/melanio-v44/combat-generated.png";
const { png, audit } = await normalizeGeneratedAtlas(await readFile(source));
const webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
await writeFile("assets/source/melanio-v44.png", png);
await writeFile("public/assets/melanio-v44.webp", webp);
await writeFile(
  "docs/melanio-v44/packing.json",
  JSON.stringify(
    {
      id: "melanio",
      source,
      output: "assets/source/melanio-v44.png",
      runtime: "public/assets/melanio-v44.webp",
      lossless: true,
      ...audit,
    },
    null,
    2,
  ) + "\n",
);
console.log("Melanio: eight complete padded poses, transparent lossless WebP.");
