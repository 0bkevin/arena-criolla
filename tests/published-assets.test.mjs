import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodedImage } from "../scripts/audit-lossless-assets.mjs";
import { compareImages } from "../scripts/audit-lossless-avif.mjs";

test("all published compressed images retain exact original pixels and metadata", async () => {
  const manifest = JSON.parse(
    await fs.readFile("shared/asset-variants.json", "utf8"),
  );
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  let checked = 0;
  for (const entry of Object.values(manifest.assets)) {
    const bytes = await fs.readFile(`public/${entry.source}`);
    assert.equal(sha(bytes), entry.sourceSha256, entry.source);
    const original = await decodedImage(bytes);
    assert.equal(sha(original.data), entry.rgbaSha256, entry.source);
    for (const variant of entry.variants) {
      const candidate = await fs.readFile(`public/${variant.file}`);
      assert.equal(candidate.length, variant.bytes, variant.file);
      assert.equal(sha(candidate), variant.sha256, variant.file);
      assert.equal(
        compareImages(original, await decodedImage(candidate)).accepted,
        true,
        variant.file,
      );
      checked++;
    }
  }
  assert.equal(checked, 40);
});
