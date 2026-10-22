import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { applyLosslessAssets } from "../scripts/apply-lossless-assets.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("recompression preserves original pixels and rejects changed or visually different candidates", async () => {
  const previous = process.cwd();
  const folder = await fs.mkdtemp(
    path.join(os.tmpdir(), "arena-publish-exact-"),
  );
  try {
    await fs.mkdir(path.join(folder, "public/assets"), { recursive: true });
    await fs.mkdir(path.join(folder, "shared"));
    await fs.writeFile(
      path.join(folder, "shared/asset-variants.json"),
      JSON.stringify({ schema: 1, assets: {} }),
    );
    const pixels = Buffer.alloc(16 * 16 * 4, 160);
    const encode = (data, compressionLevel) =>
      sharp(data, { raw: { width: 16, height: 16, channels: 4 } })
        .png({ compressionLevel })
        .toBuffer();
    const original = await encode(pixels, 0);
    const candidate = await encode(pixels, 9);
    assert.ok(candidate.length < original.length);
    const file = path.join(folder, "public/assets/demo.png");
    const candidateFile = path.join(folder, "candidate.png");
    const report = path.join(folder, "audit.json");
    await fs.writeFile(file, original);
    await fs.writeFile(candidateFile, candidate);
    const row = {
      file,
      candidateFile,
      sourceSha256: digest(original),
      selectedSha256: digest(candidate),
      savedBytes: original.length - candidate.length,
    };
    const writeReport = () =>
      fs.writeFile(report, JSON.stringify({ assets: [row] }));
    await writeReport();
    process.chdir(folder);
    assert.deepEqual(await applyLosslessAssets(report), {
      applied: 1,
      savedBytes: row.savedBytes,
    });
    assert.deepEqual(await fs.readFile(file), candidate);
    const proof = JSON.parse(
      await fs.readFile("shared/asset-recompression.json", "utf8"),
    );
    assert.equal(proof.assets["demo.png"].beforeSha256, digest(original));
    assert.equal(proof.assets["demo.png"].afterSha256, digest(candidate));
    assert.deepEqual(await applyLosslessAssets(report), {
      applied: 0,
      savedBytes: 0,
    });
    await fs.writeFile(candidateFile, Buffer.from("changed"));
    await assert.rejects(applyLosslessAssets(report), /Audit input changed/);
    await fs.writeFile(file, original);
    pixels[0]++;
    const different = await encode(pixels, 9);
    await fs.writeFile(candidateFile, different);
    row.selectedSha256 = digest(different);
    await writeReport();
    await assert.rejects(applyLosslessAssets(report), /Decoded RGBA differs/);
    await fs.writeFile(candidateFile, candidate);
    row.selectedSha256 = digest(candidate);
    await writeReport();
    await fs.writeFile(file, different);
    await assert.rejects(applyLosslessAssets(report), /Audit input changed/);
    assert.deepEqual(
      await fs.readFile("shared/asset-recompression.json", "utf8"),
      JSON.stringify(proof, null, 2) + "\n",
    );
  } finally {
    process.chdir(previous);
    await fs.rm(folder, { recursive: true, force: true });
  }
});
