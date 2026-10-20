import sharp from "sharp";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("assets/source");
const output = path.resolve("public/assets");
await mkdir(output, { recursive: true });
const fighters = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const stages = JSON.parse(await readFile("shared/stages.json", "utf8"));
const entrances = JSON.parse(
  await readFile("shared/entrance-assets.json", "utf8"),
);
const entranceSources = new Set(
  Object.values(entrances).map((asset) => `${asset.file}.png`),
);
const pixelStages = new Set(
  stages.filter((s) => s.artStyle === "pixel").map((s) => s.id + ".png"),
);
const losslessSprites = new Set([
  "enrique-v3.png",
  "jesus-v3.png",
  "carlos-v3.png",
  "victor-v3.png",
  "juan-v3.png",
  "capriles-v39.png",
  "lorenzo-v39.png",
  "carolina-v39.png",
  "bolivar-v39.png",
  "edgar-v39.png",
  "dayana-v40.png",
  "javier-v43.png",
  "nacho-v42.png",
  "melanio-v44.png",
  "knoche-v46.png",
]);
const active = [
  ...fighters.map((fighter) => `${fighter.sprite}.png`),
  ...entranceSources,
  ...stages.map((stage) => stage.id + ".png"),
];
const results = await Promise.all(
  active.map(async (name) => {
    const input = path.join(source, name);
    const destination = path.join(output, name.replace(/\.png$/, ".webp"));
    await sharp(input)
      .webp({
        lossless:
          pixelStages.has(name) ||
          losslessSprites.has(name) ||
          entranceSources.has(name),
        quality: 90,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true,
      })
      .toFile(destination);
    const before = (await stat(input)).size;
    const after = (await stat(destination)).size;
    return {
      name,
      sourceBytes: before,
      outputBytes: after,
      saved: `${Math.round((1 - after / before) * 100)}%`,
    };
  }),
);
const total = results.reduce((sum, item) => sum + item.outputBytes, 0);
console.log(
  `${results.length} assets optimizados: ${(total / 1024 / 1024).toFixed(2)} MB. Los originales PNG se conservan en assets/source.`,
);
