import sharp from "sharp";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "assets/source/finales/attack-overhaul/mcm/";
const docs = "docs/finales/attack-overhaul/mcm/";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const hashFiles = async (paths: string[]) =>
  Object.fromEntries(
    await Promise.all(paths.map(async (p) => [p, sha(await readFile(p))])),
  );
const objects = [];
for (const [name, raw] of [
  ["truck", "truck-low-grip-raw-v1.png"],
  ["empty", "truck-empty-raw-v1.png"],
  ["people", "people-raw-v2.png"],
  ["flag", "flag-raw-v1.png"],
]) {
  const source = root + raw,
    padded = root + name + "-padded.png";
  const a = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const inverse = await sharp(padded)
    .extract({ left: 40, top: 40, width: a.info.width, height: a.info.height })
    .ensureAlpha()
    .raw()
    .toBuffer();
  if (!a.data.equals(inverse)) throw Error(`Padding changed ${source}`);
  const b = await sharp(padded)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < b.info.height; y++)
    for (let x = 0; x < b.info.width; x++)
      if (
        (x < 40 ||
          y < 40 ||
          x >= b.info.width - 40 ||
          y >= b.info.height - 40) &&
        b.data[(y * b.info.width + x) * 4 + 3] !== 0
      )
        throw Error("Opaque padding");
  objects.push({
    source,
    padded,
    margin: 40,
    width: a.info.width,
    height: a.info.height,
    sourceRgbaSha256: sha(a.data),
    inverseRgbaSha256: sha(inverse),
    exactInverse: true,
  });
}
await writeFile(
  docs + "padding-audit.json",
  JSON.stringify(
    {
      method:
        "Exact40px translation of all RGBA; inverse extraction equals raw including RGB beneath alpha0. Normalizer guards unchanged. Contours visually inspected before padding.",
      objects,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  docs + "provenance.json",
  JSON.stringify(
    {
      tool: "image_gen.imagegen",
      accepted: {
        truck: "truck-low-grip-raw-v1.png",
        empty: "truck-empty-raw-v1.png",
        people: "people-raw-v2.png",
        flag: "flag-raw-v1.png",
      },
      rawFiles: await hashFiles(
        (await readdir(root))
          .filter((n) => n.includes("raw-"))
          .map((n) => root + n),
      ),
      canonicalSha256: await hashFiles([
        "assets/source/mcm-v3.png",
        "public/assets/mcm-v3.webp",
        "docs/characters-v3/mcm.json",
      ]),
      referenceSha256: await hashFiles(
        (await readdir(root + "references")).map(
          (n) => root + "references/" + n,
        ),
      ),
      promptSha256: await hashFiles(
        (await readdir(docs + "prompts")).map((n) => docs + "prompts/" + n),
      ),
    },
    null,
    2,
  ) + "\n",
);
await sharp(root + "truck-low-grip-raw-v1.png")
  .flatten({ background: "#777777" })
  .resize({ width: 1200 })
  .png()
  .toFile(docs + "truck-final-gray.png");
await sharp(root + "flag-raw-v1.png")
  .flatten({ background: "#777777" })
  .resize({ width: 1200 })
  .png()
  .toFile(docs + "flag-final-gray.png");
console.log(
  "Four exact inverse RGBA checks and transparent margins passed; provenance recorded.",
);
