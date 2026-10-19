import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

// Move and scale complete generated figures; never patch facial pixels.
const source = "assets/source/knoche-v46/combat-generated.png";
const { png, audit } = await normalizeGeneratedAtlas(await readFile(source));
const webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
await writeFile("assets/source/knoche-v46.png", png);
await writeFile("public/assets/knoche-v46.webp", webp);
await writeFile(
  "docs/knoche-v46/packing.json",
  JSON.stringify(
    {
      id: "knoche",
      source,
      output: "assets/source/knoche-v46.png",
      runtime: "public/assets/knoche-v46.webp",
      lossless: true,
      ...audit,
    },
    null,
    2,
  ) + "\n",
);
console.log("Knoche: eight complete padded poses, transparent lossless WebP.");
