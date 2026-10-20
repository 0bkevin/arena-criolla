import { separateBolivarV4 } from "./prepare-bolivar-v4";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeAttackGridFile } from "./normalize-attack-grid";
import { prepareAttackArt } from "./prepare-attack-art";
const base = "assets/source/finales/attack-overhaul/bolivar",
  docs = "docs/finales/attack-overhaul/bolivar";
await separateBolivarV4();
const groups = [
  ["draw", "slash", "cut", "thrust"],
  ["ready", "gallop-a", "gallop-b", "horse"],
  ["llanero-1", "llanero-2", "llanero-3", "llanero-4"],
  ["llanero-5", "llanero-6"],
];
const parts: {
  pose: string;
  source: string;
  bounds: any;
  coreHeight: number;
}[] = [];
for (const [i, poses] of groups.entries()) {
  const v = [1, 2, 4, 5][i];
  await sharp(v === 4 ? `${base}/separated-v4.png` : `${base}/raw-v${v}.png`)
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
    rows: v === 5 ? 1 : 2,
    poseCount: poses.length,
    poses,
  };
  await writeFile(
    `${docs}/normalize-v${v}-config.json`,
    JSON.stringify(config, null, 2) + "\n",
  );
  const report = await normalizeAttackGridFile(config);
  for (const o of report.objects)
    parts.push({
      pose: o.pose!,
      source: config.destination,
      bounds: o.outputBounds,
      coreHeight: o.coreBounds.height,
    });
}
const cell = 1200,
  width = cell * 7,
  height = cell * 2,
  rgba = Buffer.alloc(width * height * 4);
for (const [i, p] of parts.entries()) {
  const pixels = await sharp(p.source)
      .extract(p.bounds)
      .ensureAlpha()
      .raw()
      .toBuffer(),
    x = (i % 7) * cell + Math.floor((cell - p.bounds.width) / 2),
    y = Math.floor(i / 7) * cell + cell - p.bounds.height - 32;
  for (let row = 0; row < p.bounds.height; row++)
    pixels.copy(
      rgba,
      ((y + row) * width + x) * 4,
      row * p.bounds.width * 4,
      (row + 1) * p.bounds.width * 4,
    );
}
await sharp(rgba, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${base}/bolivar-grid.png`);
await writeFile(
  `${docs}/assembly.json`,
  JSON.stringify(
    {
      method: "Complete generated figures; exact RGBA translation only",
      parts,
    },
    null,
    2,
  ) + "\n",
);
const config = {
  fighter: "bolivar",
  source: `${base}/bolivar-grid.png`,
  file: "bolivar-llaneros-attack-v1",
  columns: 7,
  rows: 2,
  poses: parts.map((p) => p.pose),
  anchorFractions: { draw: 0.51, slash: 0.34, cut: 0.5, thrust: 0.34 },
};
await writeFile(`${docs}/pack.json`, JSON.stringify(config, null, 2) + "\n");
await prepareAttackArt(config);
