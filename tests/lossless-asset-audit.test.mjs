import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import {
  auditAsset,
  assertIdenticalImage,
  decodedImage,
  sourceFiles,
} from "../scripts/audit-lossless-assets.mjs";
import {
  compareImages,
  runAvifAudit,
} from "../scripts/audit-lossless-avif.mjs";

const fixture = () => ({
  metadata: { width: 2, height: 1, space: "srgb", depth: "uchar" },
  info: { width: 2, height: 1, channels: 4 },
  data: Buffer.from([100, 80, 60, 255, 20, 30, 40, 0]),
});
test("source inventory stays stable after publishing generated derivatives", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "lossless-inventory-"),
  );
  try {
    await fs.mkdir(path.join(directory, "assets"));
    await fs.writeFile(path.join(directory, "assets/source.webp"), "source");
    const before = await sourceFiles(directory);
    await fs.mkdir(path.join(directory, "assets/optimized"));
    await fs.writeFile(
      path.join(directory, "assets/optimized/variant.webp"),
      "variant",
    );
    assert.deepEqual(await sourceFiles(directory), before);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("AVIF checkpoints invalidate when requested encoder coverage changes", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "lossless-policy-"),
  );
  try {
    const source = path.join(directory, "public"),
      output = path.join(directory, "report.json");
    await fs.mkdir(source);
    await sharp({
      create: { width: 8, height: 8, channels: 4, background: "red" },
    })
      .png()
      .toFile(path.join(source, "image.png"));
    const first = await runAvifAudit({
      directory: source,
      output,
      fallback: "none",
    });
    const second = await runAvifAudit({
      directory: source,
      output,
      fallback: "all",
    });
    assert.notEqual(first.checkpointPolicy, second.checkpointPolicy);
    assert.equal(second.assets[0].checkpointPolicy, second.checkpointPolicy);
    if (second.tools.avifenc)
      assert.ok(
        second.assets[0].candidates.some(
          (c) => c.encoder === "avifenc-identity-s6",
        ),
      );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("lossless checks reject RGB changes even beneath zero alpha", () => {
  const before = fixture(),
    after = fixture();
  after.data[4]++;
  assert.throws(() => assertIdenticalImage(before, after), /RGBA differs/);
  const avif = compareImages(before, after);
  assert.equal(avif.accepted, false);
  assert.equal(avif.differingInvisiblePixels, 1);
});
test("lossless checks reject alpha, geometry and color-profile changes", () => {
  const before = fixture();
  for (const change of [
    (after) => after.data[3]--,
    (after) => {
      after.metadata.width++;
      after.info.width++;
    },
    (after) => (after.metadata.icc = Buffer.from("another profile")),
    (after) => (after.metadata.orientation = 6),
  ]) {
    const after = fixture();
    change(after);
    assert.throws(() => assertIdenticalImage(before, after));
    assert.equal(compareImages(before, after).accepted, false);
  }
});
test("AVIF metadata comparison normalizes single-image container fields without changing pixel requirements", () => {
  const before = fixture(),
    after = fixture();
  after.metadata.pages = 1;
  after.metadata.pageHeight = 1;
  after.metadata.bitsPerSample = 8;
  assert.equal(compareImages(before, after).accepted, true);
  after.data[2]++;
  assert.equal(compareImages(before, after).accepted, false);
});
test("an audit retains original bytes and only proposes a smaller exact PNG", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "lossless-audit-test-"),
  );
  try {
    const file = path.join(directory, "source.png"),
      candidates = path.join(directory, "candidates");
    const original = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 4,
        background: { r: 120, g: 80, b: 40, alpha: 0.5 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    await fs.writeFile(file, original);
    const row = await auditAsset(file, { candidateDirectory: candidates });
    assert.ok(row.savedBytes > 0);
    assert.ok(row.selectedBytes < original.length);
    assert.ok(
      row.candidates.every((candidate) => candidate.exactRgbaAndMetadata),
    );
    assert.equal(row.transportRoundtripExact, true);
    assert.deepEqual(await fs.readFile(file), original);
    assertIdenticalImage(
      await decodedImage(original),
      await decodedImage(await fs.readFile(row.candidateFile)),
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("WebP exact encoding retains nonzero RGB in fully transparent pixels", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "lossless-webp-test-"),
  );
  try {
    const pixels = Buffer.alloc(32 * 32 * 4);
    for (let i = 0; i < pixels.length; i += 4)
      pixels.set([80, 120, 160, i < 512 ? 0 : 255], i);
    const original = await sharp(pixels, {
      raw: { width: 32, height: 32, channels: 4 },
    })
      .webp({ lossless: true, exact: true, effort: 0 })
      .toBuffer();
    const file = path.join(directory, "source.webp");
    await fs.writeFile(file, original);
    const row = await auditAsset(file, {
      candidateDirectory: path.join(directory, "candidates"),
    });
    assert.ok(
      row.candidates.every((candidate) => candidate.exactRgbaAndMetadata),
    );
    assert.deepEqual(await fs.readFile(file), original);
    if (row.candidateFile)
      assertIdenticalImage(
        await decodedImage(original),
        await decodedImage(await fs.readFile(row.candidateFile)),
      );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
