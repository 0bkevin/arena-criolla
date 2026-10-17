import sharp from "sharp";
import { copyFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
const manifest = JSON.parse(await readFile("docs/stage-art-v4.json", "utf8"));
await mkdir("assets/references/stages-v4", { recursive: true });
await mkdir("assets/source", { recursive: true });
await mkdir("public/assets", { recursive: true });
for (const stage of manifest.stages) {
  const original = `assets/references/stages-v4/${stage.id}-generated.png`;
  await copyFile(stage.generatedPath, original);
  const source = `assets/source/${stage.id}.png`;
  const webp = `public/assets/${stage.id}.webp`;
  await sharp(original)
    .resize(540, 320, { fit: "fill", kernel: "nearest" })
    .png({ palette: true, colours: 256, dither: 0 })
    .toFile(source);
  await sharp(source).webp({ lossless: true, effort: 6 }).toFile(webp);
  stage.original = original;
  stage.source = source;
  stage.runtime = webp;
  stage.dimensions = [540, 320];
  stage.bytes = (await stat(webp)).size;
  stage.sha256 = createHash("sha256")
    .update(await readFile(webp))
    .digest("hex");
}
await writeFile(
  "docs/stage-art-v4.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  manifest.stages
    .map((s) => `${s.name}: ${s.bytes} bytes, pixel art 540×320`)
    .join("\n"),
);
