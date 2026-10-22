import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodedImage } from "../scripts/audit-lossless-assets.mjs";
import { imageSemantics } from "../scripts/apply-lossless-assets.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("recompressed runtime art keeps its original full RGBA and metadata fingerprints", async () => {
  const proof = JSON.parse(
    await fs.readFile("shared/asset-recompression.json", "utf8"),
  );
  assert.equal(proof.schema, 1);
  assert.equal(Object.keys(proof.assets).length, 52);
  for (const [file, expected] of Object.entries(proof.assets)) {
    const bytes = await fs.readFile(`public/assets/${file}`);
    assert.equal(bytes.length, expected.afterBytes, file);
    assert.ok(expected.afterBytes < expected.beforeBytes, file);
    assert.equal(digest(bytes), expected.afterSha256, file);
    const decoded = await decodedImage(bytes);
    assert.equal(digest(decoded.data), expected.rgbaSha256, file);
    assert.deepEqual(imageSemantics(decoded.metadata), expected.metadata, file);
  }
});
