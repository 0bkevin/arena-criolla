import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeAttackGridFile } from "./normalize-attack-grid";
import { prepareAttackArt } from "./prepare-attack-art";
const base = "assets/source/finales/attack-overhaul/lorenzo";
const docs = "docs/finales/attack-overhaul/lorenzo";
const groups = [
  ["windup", "throw", "recover", "bag"],
  ["ride-right", "ride-left", "truck-right", "truck-left"],
];
const parts: {
  pose: string;
  source: string;
  bounds: any;
  coreHeight: number;
}[] = [];
for (const [index, poses] of groups.entries()) {
  const v = index + 1;
  await sharp(`${base}/raw-v${v}.png`)
    .extend({
      top: 32,
      bottom: 32,
      left: 32,
      right: 32,
      background: "#00000000",
    })
    .png()
    .toFile(`${base}/padded-v${v}.png`);
  const config = {
    source: `${base}/padded-v${v}.png`,
    destination: `${base}/v${v}-grid.png`,
    auditPath: `${docs}/normalize-v${v}.json`,
    columns: 2,
    rows: 2,
    poseCount: 4,
    poses,
  };
  await writeFile(
    `${docs}/normalize-v${v}-config.json`,
    JSON.stringify(config, null, 2) + "\n",
  );
  const report = await normalizeAttackGridFile(config);
  for (const object of report.objects)
    parts.push({
      pose: object.pose!,
      source: config.destination,
      bounds: object.outputBounds,
      coreHeight: object.coreBounds.height,
    });
}
// Root approved the full top-right cell: all border alpha <=1, no visible anatomy crosses it.
const cellSource = `${base}/v3-left-cell.png`;
const raw3 = await sharp(`${base}/raw-v3.png`)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = raw3.info.width / 2,
  h = raw3.info.height / 2;
const cellPixels = Buffer.alloc(w * h * 4);
let maxBorderAlpha = 0;
for (let y = 0; y < h; y++) {
  raw3.data.copy(
    cellPixels,
    y * w * 4,
    (y * raw3.info.width + w) * 4,
    (y * raw3.info.width + 2 * w) * 4,
  );
  for (let x = 0; x < w; x++)
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1)
      maxBorderAlpha = Math.max(
        maxBorderAlpha,
        cellPixels[(y * w + x) * 4 + 3],
      );
}
if (maxBorderAlpha > 1)
  throw Error("Source cell would cut a meaningful alpha edge");
await sharp(cellPixels, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toFile(`${base}/v3-left-exact.png`);
const decoded = await sharp(`${base}/v3-left-exact.png`).raw().toBuffer();
if (!decoded.equals(cellPixels)) throw Error("Cell RGBA roundtrip failed");
await sharp(`${base}/v3-left-exact.png`)
  .extend({ top: 32, bottom: 32, left: 32, right: 32, background: "#00000000" })
  .png()
  .toFile(cellSource);
const config3 = {
  source: cellSource,
  destination: `${base}/v3-left-grid.png`,
  auditPath: `${docs}/normalize-v3-left.json`,
  columns: 1,
  rows: 1,
  poseCount: 1,
  poses: ["ride-left"],
};
await writeFile(
  `${docs}/normalize-v3-left-config.json`,
  JSON.stringify(config3, null, 2) + "\n",
);
const report3 = await normalizeAttackGridFile(config3),
  o3 = report3.objects[0];
parts[5] = {
  pose: "ride-left",
  source: config3.destination,
  bounds: o3.outputBounds,
  coreHeight: o3.coreBounds.height,
};
await writeFile(
  `${docs}/v3-cell-audit.json`,
  JSON.stringify(
    { width: w, height: h, maxBorderAlpha, exactRgbaRoundtrip: true },
    null,
    2,
  ) + "\n",
);
const config4 = {
  source: `${base}/raw-v4.png`,
  destination: `${base}/v4-grid.png`,
  auditPath: `${docs}/normalize-v4.json`,
  columns: 1,
  rows: 1,
  poseCount: 1,
  poses: ["throw"],
};
await writeFile(
  `${docs}/normalize-v4-config.json`,
  JSON.stringify(config4, null, 2) + "\n",
);
const report4 = await normalizeAttackGridFile(config4),
  o4 = report4.objects[0];
parts[1] = {
  pose: "throw",
  source: config4.destination,
  bounds: o4.outputBounds,
  coreHeight: o4.coreBounds.height,
};
await sharp(`${base}/raw-v6.png`)
  .extend({ top: 32, bottom: 32, left: 32, right: 32, background: "#00000000" })
  .png()
  .toFile(`${base}/padded-v6.png`);
const config6 = {
  source: `${base}/padded-v6.png`,
  destination: `${base}/v6-grid.png`,
  auditPath: `${docs}/normalize-v6.json`,
  columns: 2,
  rows: 1,
  poseCount: 2,
  poses: ["front-right", "front-left"],
};
await writeFile(
  `${docs}/normalize-v6-config.json`,
  JSON.stringify(config6, null, 2) + "\n",
);
const report6 = await normalizeAttackGridFile(config6);
for (const o of report6.objects)
  parts.push({
    pose: o.pose!,
    source: config6.destination,
    bounds: o.outputBounds,
    coreHeight: o.coreBounds.height,
  });
const cell = 1600,
  width = cell * 5,
  height = cell * 2;
const rgba = Buffer.alloc(width * height * 4);
for (const [index, part] of parts.entries()) {
  const pixels = await sharp(part.source)
    .extract(part.bounds)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const x = (index % 5) * cell + Math.floor((cell - part.bounds.width) / 2);
  const y = Math.floor(index / 5) * cell + cell - part.bounds.height - 32;
  for (let row = 0; row < part.bounds.height; row++)
    pixels.copy(
      rgba,
      ((y + row) * width + x) * 4,
      row * part.bounds.width * 4,
      (row + 1) * part.bounds.width * 4,
    );
}
await sharp(rgba, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${base}/lorenzo-grid.png`);
await writeFile(
  `${docs}/assembly.json`,
  JSON.stringify(
    {
      method:
        "Complete generated silhouettes, exact RGBA translation; no anatomical edits.",
      parts,
    },
    null,
    2,
  ) + "\n",
);
const config = {
  fighter: "lorenzo",
  source: `${base}/lorenzo-grid.png`,
  file: "lorenzo-polar-attack-v1",
  columns: 5,
  rows: 2,
  poses: parts.map((p) => p.pose),
  anchorFractions: { windup: 0.5, throw: 0.46, recover: 0.5 },
};
await writeFile(`${docs}/pack.json`, JSON.stringify(config, null, 2) + "\n");
await prepareAttackArt(config);
