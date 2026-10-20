import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "assets/source/finales/attack-overhaul/george/";
const docs = "docs/finales/attack-overhaul/george/";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const original = await sharp(root + "george-grid.png")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const grid = JSON.parse(await readFile(docs + "grid-audit.json", "utf8"));
const supportGrid = JSON.parse(
  await readFile(docs + "support-grid-audit.json", "utf8"),
);
const { width, height } = original.info;
const cell = grid.cellWidth;
if (width !== cell * 3 || height !== cell * 2) throw Error("Unexpected grid");
// Extract the complete object bounds INCLUDING soft alpha. Only this prop is
// uniformly resized; the five original cells remain exact RGBA byte copies.
const support = await sharp(root + "support-grid.png")
  .extract(supportGrid.objects[0].outputBounds)
  .resize({ width: 530 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (support.info.width > cell - 40 || support.info.height > cell - 40)
  throw Error("Support does not fit");
const output = Buffer.from(original.data);
for (let y = cell; y < cell * 2; y++)
  output.fill(0, (y * width + cell * 2) * 4, (y * width + cell * 3) * 4);
const x0 = cell * 2 + Math.floor((cell - support.info.width) / 2);
const y0 = cell + Math.floor((cell - support.info.height) / 2);
for (let y = 0; y < support.info.height; y++)
  support.data
    .subarray(y * support.info.width * 4, (y + 1) * support.info.width * 4)
    .copy(output, ((y0 + y) * width + x0) * 4);
const cells = [];
for (let i = 0; i < 5; i++) {
  const before = [],
    after = [];
  for (let y = 0; y < cell; y++) {
    const start = ((Math.floor(i / 3) * cell + y) * width + (i % 3) * cell) * 4;
    before.push(original.data.subarray(start, start + cell * 4));
    after.push(output.subarray(start, start + cell * 4));
  }
  const expected = sha(Buffer.concat(before)),
    actual = sha(Buffer.concat(after));
  if (actual !== expected) throw Error("Original cell altered");
  cells.push({
    pose: grid.poses[i],
    source: "raw-v1.png",
    expected,
    actual,
    exact: true,
  });
}
await sharp(output, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(root + "accepted-grid.png");
await writeFile(
  docs + "assembly.json",
  JSON.stringify(
    {
      method:
        "Five whole cells copied byte-exactly; complete generated support uniformly scaled to530px width, no masking or painting",
      width,
      height,
      cells,
      support: {
        source: "support-raw-v2.png",
        bounds: supportGrid.objects[0].outputBounds,
        width: support.info.width,
        height: support.info.height,
        rgbaSha256: sha(support.data),
      },
    },
    null,
    2,
  ) + "\n",
);
await sharp(root + "accepted-grid.png")
  .flatten({ background: "#777777" })
  .png()
  .toFile(docs + "accepted-gray.png");
