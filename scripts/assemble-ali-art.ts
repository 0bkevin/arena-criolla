import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prepareAttackArt } from "./prepare-attack-art";
const root = "assets/source/finales/attack-overhaul/ali/";
const docs = "docs/finales/attack-overhaul/ali/";
const poses = [
  "ready",
  "upstroke",
  "downstroke",
  "accent",
  "choir-a",
  "choir-b",
  "choir-c",
  "choir-d",
  "choir-e",
  "choir-f",
];
const cell = 768;
const layers = [],
  evidence = [];
for (let i = 0; i < poses.length; i++) {
  const group = i < 4 ? "actor" : "choir";
  const audit = JSON.parse(
    await readFile(docs + group + "-grid-audit.json", "utf8"),
  );
  const obj = audit.objects[i < 4 ? i : i - 4];
  const source = await sharp(root + group + "-grid.png")
    .extract(obj.outputBounds)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  layers.push({
    input: await sharp(source.data, { raw: source.info }).png().toBuffer(),
    left: (i % 5) * cell + Math.floor((cell - source.info.width) / 2),
    top: Math.floor(i / 5) * cell + Math.floor((cell - source.info.height) / 2),
  });
  evidence.push({
    pose: poses[i],
    group,
    sourceBounds: obj.sourceBounds,
    coreHeight: obj.coreBounds.height,
    rgbaSha256: createHash("sha256").update(source.data).digest("hex"),
  });
}
await sharp({
  create: {
    width: cell * 5,
    height: cell * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(layers)
  .png()
  .toFile(root + "accepted-grid.png");
await prepareAttackArt({
  fighter: "ali",
  source: root + "accepted-grid.png",
  file: "ali-cuatro-choir-attack-v1",
  columns: 5,
  rows: 2,
  poses,
});
await writeFile(
  docs + "assembly.json",
  JSON.stringify(
    {
      method:
        "Whole generated silhouettes copied at exact RGBA without resampling into common cells, then uniformly packed; no anatomy painting or masking.",
      objects: evidence,
    },
    null,
    2,
  ) + "\n",
);
