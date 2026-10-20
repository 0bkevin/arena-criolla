import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// The image tool recolored B/D. Keep the other four complete generated cells
// byte-for-byte from v2; do not paint, mask, crop silhouettes or resize anatomy.
const root = "assets/source/finales/attack-overhaul/puma/";
const docs = "docs/finales/attack-overhaul/puma/";
const [v2, v3] = await Promise.all(
  ["grid-v2.png", "grid-v3.png"].map((file) =>
    sharp(root + file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ),
);
if (JSON.stringify(v2.info) !== JSON.stringify(v3.info))
  throw Error("Mismatched grids");
const audit = JSON.parse(await readFile(docs + "grid-audit.json", "utf8"));
const cell = audit.cellWidth,
  width = v2.info.width,
  height = v2.info.height;
if (width !== cell * 3 || height !== cell * 2)
  throw Error("Invalid normalized cells");
const output = Buffer.from(v2.data),
  cells = [];
for (let index = 0; index < 6; index++) {
  const replacement = index === 3 || index === 5;
  const source = replacement ? v3.data : v2.data;
  const rows = [];
  for (let y = 0; y < cell; y++) {
    const start =
      ((Math.floor(index / 3) * cell + y) * width + (index % 3) * cell) * 4;
    const row = source.subarray(start, start + cell * 4);
    row.copy(output, start);
    rows.push(row);
  }
  cells.push({
    cell: index,
    source: replacement ? "grid-v3.png" : "grid-v2.png",
    rgbaSha256: createHash("sha256").update(Buffer.concat(rows)).digest("hex"),
  });
}
await sharp(output, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(root + "puma-grid.png");
await writeFile(
  docs + "assembly.json",
  JSON.stringify(
    {
      method:
        "Whole normalized cells copied without resize or repaint; v2 actor/A/C retained byte-exactly, v3 B/D dress recolor by built-in imagegen.",
      width,
      height,
      cell,
      cells,
    },
    null,
    2,
  ) + "\n",
);
await sharp(root + "puma-grid.png")
  .flatten({ background: "#777777" })
  .png()
  .toFile(docs + "accepted-gray.png");
