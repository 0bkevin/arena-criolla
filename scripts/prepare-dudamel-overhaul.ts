import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prepareAttackArt } from "./prepare-attack-art";

const base = "assets/source/finales/attack-overhaul/dudamel";
const docs = "docs/finales/attack-overhaul/dudamel";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const report = await prepareAttackArt(
  JSON.parse(await readFile(`${base}/pack.json`, "utf8")),
);
// V2 already has complete figures in their own cells. Preserve the disconnected
// alpha-2 island in its source cell; do not ask the silhouette normalizer to
// infer anatomical ownership of invisible background pixels.
const source = await readFile(`${base}/orchestra-raw-v2.png`);
const orchestra = await sharp(source)
  .ensureAlpha()
  .resize({ width: 1536 })
  .png()
  .toBuffer();
const meta = await sharp(orchestra).metadata();
const orchestraHeight = meta.height!;
const file = report.file;
const packed = await sharp({
  create: {
    width: 1536,
    height: 1024 + orchestraHeight,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: await readFile(report.normalized), left: 0, top: 0 },
    { input: orchestra, left: 0, top: 1024 },
  ])
  .png()
  .toBuffer();
const runtime = await sharp(packed)
  .webp({ lossless: true, exact: true, effort: 6 })
  .toBuffer();
const rgba = await sharp(packed).raw().toBuffer();
if (!rgba.equals(await sharp(runtime).raw().toBuffer()))
  throw Error("RGBA roundtrip");
const manifestPath = "shared/attack-assets.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
// Entire orchestra uses a large source frame; it is never squeezed into 512px.
manifest.dudamel.frames.orchestra = {
  x: 0,
  y: 1024,
  width: 1536,
  height: orchestraHeight,
  anchorX: 768,
  anchorY: orchestraHeight * 0.92,
  bodyHeight: orchestraHeight * 0.84,
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
await writeFile(report.normalized, packed);
await writeFile(report.destination, runtime);
await writeFile(
  `${docs}/assets.json`,
  JSON.stringify(
    {
      ...report,
      width: 1536,
      height: 1024 + orchestraHeight,
      poses: [...report.poses, "orchestra"],
      alphaSha256: sha(
        await sharp(packed).extractChannel("alpha").raw().toBuffer(),
      ),
      frames: manifest.dudamel.frames,
      normalizedSha256: sha(packed),
      runtimeSha256: sha(runtime),
      rgbaSha256: sha(rgba),
      orchestra: {
        source: `${base}/orchestra-raw-v2.png`,
        sourceSha256: sha(source),
        width: 1536,
        height: orchestraHeight,
      },
      normalization:
        "Conductor v2 already lies fully inside four source cells; direct prepareAttackArt retains alpha-2 island and validates gutters. V1 rejected at outer edge. No anatomy painted or cropped.",
    },
    null,
    2,
  ) + "\n",
);
for (const name of ["conductor-raw-v2", "orchestra-raw-v2"])
  await sharp(`${base}/${name}.png`)
    .flatten({ background: "#777777" })
    .png()
    .toFile(`${docs}/${name}-gray.png`);
const files = [
  "conductor-raw-v1.png",
  "conductor-raw-v2.png",
  "orchestra-raw-v1.png",
  "orchestra-raw-v2.png",
  "references/canonical-main.png",
  "references/laphil-conducting.jpg",
  "references/laphil-orchestra.jpg",
  "prompts.json",
  "prompt-conductor-v2.txt",
  "pack.json",
  "research.md",
];
await writeFile(
  `${docs}/provenance.json`,
  JSON.stringify(
    {
      tool: "image_gen.imagegen",
      accepted: [files[1], files[3]],
      rejected: {
        "conductor-raw-v1.png": "Outer edge contact detected by normalizer",
        "orchestra-raw-v1.png": "Cropped bass scroll and rightmost violin",
      },
      files: await Promise.all(
        files.map(async (path) => ({
          path: `${base}/${path}`,
          sha256: sha(await readFile(`${base}/${path}`)),
        })),
      ),
    },
    null,
    2,
  ) + "\n",
);
