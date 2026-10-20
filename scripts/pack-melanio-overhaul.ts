import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prepareAttackArt } from "./prepare-attack-art";
const root = "assets/source/finales/attack-overhaul/melanio/",
  docs = "docs/finales/attack-overhaul/melanio/";
const sources = [
  ["record", "v1", 0],
  ["windup", "v1", 1],
  ["strike-high", "high", 0],
  ["strike-low", "v1", 3],
  ["recover", "v1", 4],
  ["signal-windup", "special", 0],
  ["signal-release", "release", 0],
  ["signal", "special", 2],
] as const;
const cell = 1280,
  layers = [],
  objects = [];
for (const [index, [pose, source, slot]] of sources.entries()) {
  const audit = JSON.parse(
    await readFile(docs + source + "-grid-audit.json", "utf8"),
  );
  const object = audit.objects[slot],
    bounds = object.outputBounds;
  const input = await sharp(root + source + "-grid.png")
    .extract(bounds)
    .png()
    .toBuffer();
  const rgba = await sharp(input).ensureAlpha().raw().toBuffer();
  const left = (index % 4) * cell + Math.floor((cell - bounds.width) / 2),
    top = Math.floor(index / 4) * cell + Math.floor((cell - bounds.height) / 2);
  layers.push({ input, left, top });
  objects.push({
    pose,
    source: root + source + "-grid.png",
    sourceBounds: bounds,
    coreHeight: object.coreBounds.height,
    rgbaSha256: createHash("sha256").update(rgba).digest("hex"),
  });
}
await sharp({
  create: {
    width: cell * 4,
    height: cell * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(layers)
  .png()
  .toFile(root + "melanio-grid.png");
await writeFile(
  docs + "assembly.json",
  JSON.stringify(
    {
      method:
        "Complete connected generated silhouettes translated into common cells without resampling; no anatomy editing. Runtime packing uniformly scales complete figures.",
      cell,
      objects,
    },
    null,
    2,
  ) + "\n",
);
const config = {
  fighter: "melanio",
  source: root + "melanio-grid.png",
  file: "melanio-phone-signal-attack-v1",
  columns: 4,
  rows: 2,
  poses: sources.map((x) => x[0]),
  anchorFractions: {
    record: 0.46,
    windup: 0.48,
    "strike-high": 0.452,
    "strike-low": 0.48,
    recover: 0.46,
    "signal-windup": 0.47,
    "signal-release": 0.47,
    signal: 0.5,
  },
};
await writeFile(docs + "pack.json", JSON.stringify(config, null, 2) + "\n");
await prepareAttackArt(config);
