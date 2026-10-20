import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { prepareAttackArt } from "./prepare-attack-art";
const base = "assets/source/finales/attack-overhaul/llorona/";
const poses = [
  "lure",
  "cast",
  "reveal",
  "embrace-high",
  "embrace-low",
  "recover",
  "portal",
  "wave",
];
const size = { width: 1500, height: 800 };
const layers = [];
for (let i = 0; i < 6; i++)
  layers.push({
    input: await sharp(base + "poses-normalized-v1.png")
      .extract({
        left: (i % 2) * 608,
        top: Math.floor(i / 2) * 576,
        width: 608,
        height: 576,
      })
      .png()
      .toBuffer(),
    left: (i % 2) * size.width + 446,
    top: Math.floor(i / 2) * size.height + 112,
  });
// The raw effects have an unequal composition. The empty x=1350..1433 gutter
// separates the COMPLETE portal and ALL wave droplets. No visible pixel is cut.
for (const [i, left, width] of [
  [6, 0, 1392],
  [7, 1392, 780],
])
  layers.push({
    input: await sharp(base + "effects-raw-v1.png")
      .extract({ left, top: 0, width, height: 724 })
      .png()
      .toBuffer(),
    left: (i % 2) * size.width + Math.floor((size.width - width) / 2),
    top: 2400 + 38,
  });
// Exact RGBA translation, including semitransparent edge pixels: compositing
// against alpha0 would premultiply/unpremultiply and round the painted colors.
const assembled = Buffer.alloc(3000 * 3200 * 4);
for (const layer of layers) {
  const { data, info } = await sharp(layer.input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++)
    data.copy(
      assembled,
      ((layer.top + y) * 3000 + layer.left) * 4,
      y * info.width * 4,
      (y + 1) * info.width * 4,
    );
}
await sharp(assembled, { raw: { width: 3000, height: 3200, channels: 4 } })
  .png()
  .toFile(base + "combined-v1.png");
const report = await prepareAttackArt({
  fighter: "llorona",
  source: base + "combined-v1.png",
  file: "llorona-underworld-attack-v1",
  columns: 2,
  rows: 4,
  poses,
  anchorFractions: {
    lure: 0.52,
    cast: 0.53,
    reveal: 0.52,
    "embrace-high": 0.52,
    "embrace-low": 0.52,
    recover: 0.52,
    portal: 0.5,
    wave: 0.5,
  },
});
await writeFile(
  base + "body-metrics.json",
  JSON.stringify(
    Object.fromEntries(
      report.objects.map((o) => [
        o.pose,
        {
          height: o.coreBounds.bottom - o.coreBounds.top,
          width: o.sourceBounds.width,
        },
      ]),
    ),
    null,
    2,
  ) + "\n",
);
await sharp(base + "effects-raw-v1.png")
  .flatten({ background: "#777777" })
  .png()
  .toFile("docs/finales/attack-overhaul/llorona/effects-v1-gray.png");
