import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { STAGES } from "../shared/content";
import manifest from "../shared/stage-thumbnails.json";
import { stageThumbnail } from "../src/stage-thumbnail";

const sha256 = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");

test("stage thumbnails match the current backgrounds and generated files", async () => {
  assert.deepEqual(
    Object.keys(manifest).sort(),
    STAGES.map((stage) => stage.id).sort(),
  );
  for (const stage of STAGES) {
    const entry = manifest[stage.id];
    const source = await readFile(`public/assets/${stage.id}.webp`);
    assert.equal(
      entry.sourceSha256,
      sha256(source),
      `${stage.id}: run npm run assets:stage-thumbs`,
    );
    const sourceMetadata = await sharp(source).metadata();
    for (const [variant, width] of [
      ["strip", 360],
      ["gallery", 1100],
    ] as const) {
      const thumbnail = entry.files[variant];
      assert.equal(thumbnail.width, width);
      assert.equal(
        stageThumbnail(stage.id, variant),
        `/assets/${thumbnail.file}.webp`,
      );
      const file = await readFile(`public/assets/${thumbnail.file}.webp`);
      assert.equal(sha256(file), thumbnail.sha256, stage.id);
      const metadata = await sharp(file).metadata();
      assert.equal(
        metadata.width,
        Math.min(width, sourceMetadata.width!),
        stage.id,
      );
    }
  }
});
