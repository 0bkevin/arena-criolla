import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeAttackGridFile } from "./normalize-attack-grid";
import { prepareAttackArt } from "./prepare-attack-art";
const base = "assets/source/finales/attack-overhaul/dayana",
  docs = "docs/finales/attack-overhaul/dayana";
const specs = [
  { v: 1, columns: 2, rows: 2, poses: ["windup", "follow", "recover", "ball"] },
  { v: 2, columns: 1, rows: 1, poses: ["contact"] },
  {
    v: 4,
    columns: 3,
    rows: 2,
    poses: [
      "a-windup",
      "a-contact",
      "a-recover",
      "b-windup",
      "b-contact",
      "b-recover",
    ],
  },
];
const parts = new Map<
  string,
  { source: string; bounds: any; coreHeight: number }
>();
for (const s of specs) {
  if (s.v === 4) {
    // This generated grid already has complete figures inside its six cells.
    // Preserve detached alpha-2 softness too; no segmentation or thresholding.
    const { data, info } = await sharp(`${base}/raw-v4.png`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width / 3,
      h = info.height / 2;
    for (const [i, pose] of s.poses.entries()) {
      let top = h,
        bottom = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const a =
            data[
              ((Math.floor(i / 3) * h + y) * info.width + ((i % 3) * w + x)) *
                4 +
                3
            ];
          if (a >= 40) {
            if (x < 5 || x >= w - 5 || y < 5 || y >= h - 5)
              throw Error("Visible figure crosses source cell");
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      parts.set(pose, {
        source: `${base}/raw-v4.png`,
        bounds: {
          left: (i % 3) * w,
          top: Math.floor(i / 3) * h,
          width: w,
          height: h,
        },
        coreHeight: bottom - top + 1,
      });
    }
    continue;
  }

  // Raw edges contain only alpha-1 antialias tails; preserve every pixel with a 32px transparent border.
  await sharp(`${base}/raw-v${s.v}.png`)
    .extend({
      top: 32,
      bottom: 32,
      left: 32,
      right: 32,
      background: "#00000000",
    })
    .png()
    .toFile(`${base}/padded-v${s.v}.png`);
  const config = {
    source: `${base}/padded-v${s.v}.png`,
    destination: `${base}/v${s.v}-grid.png`,
    auditPath: `${docs}/normalize-v${s.v}.json`,
    columns: s.columns,
    rows: s.rows,
    poseCount: s.poses.length,
    poses: s.poses,
  };
  await writeFile(
    `${docs}/normalize-v${s.v}-config.json`,
    JSON.stringify(config, null, 2) + "\n",
  );
  const report = await normalizeAttackGridFile(config);
  for (const obj of report.objects)
    parts.set(obj.pose!, {
      source: config.destination,
      bounds: obj.outputBounds,
      coreHeight: obj.coreBounds.height,
    });
}
const poses = [
  "windup",
  "contact",
  "recover",
  "ball",
  "a-windup",
  "a-contact",
  "a-recover",
  "b-windup",
  "b-contact",
  "b-recover",
];
const cell = 1600,
  width = cell * 5,
  height = cell * 2,
  rgba = Buffer.alloc(width * height * 4),
  objects = [];
for (const [i, pose] of poses.entries()) {
  const part = parts.get(pose)!;
  const pixels = await sharp(part.source)
    .extract(part.bounds)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const left = (i % 5) * cell + Math.floor((cell - part.bounds.width) / 2),
    top = Math.floor(i / 5) * cell + cell - part.bounds.height - 30;
  for (let y = 0; y < part.bounds.height; y++)
    pixels.copy(
      rgba,
      ((top + y) * width + left) * 4,
      y * part.bounds.width * 4,
      (y + 1) * part.bounds.width * 4,
    );
  objects.push({ pose, ...part });
}
await sharp(rgba, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${base}/dayana-grid.png`);
await writeFile(
  `${docs}/assembly.json`,
  JSON.stringify(
    {
      method:
        "Exact RGBA whole-silhouette translation; no anatomy edits or resampling. Raw-v1 follow-through retained but not used.",
      cell,
      objects,
    },
    null,
    2,
  ) + "\n",
);
const config = {
  fighter: "dayana",
  source: `${base}/dayana-grid.png`,
  file: "dayana-football-attack-v1",
  columns: 5,
  rows: 2,
  poses,
  anchorFractions: {
    windup: 0.77,
    contact: 0.585,
    recover: 0.49,
    ball: 0.5,
    "a-windup": 0.78,
    "a-contact": 0.65,
    "a-recover": 0.81,
    "b-windup": 0.79,
    "b-contact": 0.55,
    "b-recover": 0.81,
  },
};
await writeFile(`${docs}/pack.json`, JSON.stringify(config, null, 2) + "\n");
await prepareAttackArt(config);
