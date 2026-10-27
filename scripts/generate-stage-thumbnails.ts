import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { STAGES } from "../shared/content";

const manifestPath = "shared/stage-thumbnails.json";
const variants = { strip: 360, gallery: 1100 } as const;
const quality = 85;
const check = process.argv.includes("--check");
const sha256 = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");
type Entry = {
  sourceSha256: string;
  quality: number;
  files: Record<string, { file: string; width: number; sha256: string }>;
};
const previous: Record<string, Entry> = JSON.parse(
  await readFile(manifestPath, "utf8").catch(() => "{}"),
);
const next: Record<string, Entry> = {};
let stale = 0;
for (const stage of STAGES) {
  const source = await readFile(`public/assets/${stage.id}.webp`);
  const sourceSha256 = sha256(source);
  const old = previous[stage.id];
  const entry: Entry = { sourceSha256, quality, files: {} };
  for (const [variant, width] of Object.entries(variants)) {
    const file = `stage-thumb-${variant}-${stage.id}`;
    const prior = old?.files?.[variant];
    const current =
      old?.sourceSha256 === sourceSha256 &&
      old.quality === quality &&
      prior?.file === file &&
      prior.width === width &&
      sha256(
        await readFile(`public/assets/${file}.webp`).catch(() =>
          Buffer.alloc(0),
        ),
      ) === prior.sha256;
    if (current) {
      entry.files[variant] = prior;
      continue;
    }
    stale++;
    if (check) {
      console.error(`stale stage thumbnail: ${stage.id} (${variant})`);
    } else {
      const image = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer();
      await writeFile(`public/assets/${file}.webp`, image);
      entry.files[variant] = { file, width, sha256: sha256(image) };
    }
  }
  next[stage.id] = entry;
}
if (Object.keys(previous).length !== Object.keys(next).length) stale++;
if (check) {
  if (stale) {
    console.error("Run: npm run assets:stage-thumbs");
    process.exit(1);
  }
  console.log(`${STAGES.length} stage thumbnails are current.`);
} else {
  await writeFile(manifestPath, JSON.stringify(next, null, 2) + "\n");
  console.log(`${STAGES.length} stages, ${stale} thumbnails rewritten.`);
}
