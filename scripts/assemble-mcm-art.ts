import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prepareAttackArt } from "./prepare-attack-art";

const root = "assets/source/finales/attack-overhaul/mcm/";
const docs = "docs/finales/attack-overhaul/mcm/";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const poses = [
  "truck",
  "empty",
  "mount",
  "dismount",
  "man-a",
  "man-b",
  "woman-a",
  "woman-b",
  "flag",
];
const cell = 1728;
const layers = [];
const evidence = [];
for (let i = 0; i < poses.length; i++) {
  const name = i < 2 || i === 8 ? poses[i] : "people";
  const audit = JSON.parse(
    await readFile(docs + name + "-grid-audit.json", "utf8"),
  );
  const obj = audit.objects[i < 2 || i === 8 ? 0 : i - 2];
  const source = await sharp(root + name + "-grid.png")
    .extract(obj.outputBounds)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((cell - source.info.width) / 2),
    top = Math.floor((cell - source.info.height) / 2);
  layers.push({
    input: await sharp(source.data, { raw: source.info }).png().toBuffer(),
    left: (i % 3) * cell + left,
    top: Math.floor(i / 3) * cell + top,
  });
  evidence.push({
    pose: poses[i],
    source: name + "-grid.png",
    sourceBounds: obj.outputBounds,
    rgbaSha256: sha(source.data),
    coreHeight: obj.coreBounds.height,
  });
}
await sharp({
  create: {
    width: cell * 3,
    height: cell * 3,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(layers)
  .png()
  .toFile(root + "accepted-grid.png");
const packed = await prepareAttackArt({
  fighter: "mcm",
  source: root + "accepted-grid.png",
  file: "mcm-caravan-attack-v1",
  columns: 3,
  rows: 3,
  poses,
});
// Whole-image coordinates measured in the originals. Wheel contact is the
// lower front tire; depth perspective puts the rear tire slightly farther up.
for (const [pose, rawX, rawY, sourceFile] of [
  ["truck", 500, 972, "truck"],
  ["empty", 500, 943, "empty"],
  ["flag", 1374, 800, "flag"],
] as const) {
  const audit = JSON.parse(
    await readFile(docs + sourceFile + "-grid-audit.json", "utf8"),
  );
  const obj = audit.objects[0];
  const pack = packed.objects.find((o) => o.pose === pose)!;
  const frame = packed.frames[pose];
  frame.anchorX = (rawX + 40 - obj.sourceBounds.left) * pack.uniformScale;
  frame.anchorY = (rawY + 40 - obj.sourceBounds.top) * pack.uniformScale;
  frame.bodyHeight = (pose === "flag" ? 942 : 500) * pack.uniformScale;
}
const manifest = JSON.parse(
  await readFile("shared/attack-assets.json", "utf8"),
);
manifest.mcm.frames = packed.frames;
await writeFile(
  "shared/attack-assets.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(docs + "assets.json", JSON.stringify(packed, null, 2) + "\n");
await writeFile(
  docs + "assembly.json",
  JSON.stringify(
    {
      method:
        "Complete generated objects copied without resampling into common cells; packing uniformly scales whole objects. No anatomy painting or masking.",
      cell,
      objects: evidence,
    },
    null,
    2,
  ) + "\n",
);
