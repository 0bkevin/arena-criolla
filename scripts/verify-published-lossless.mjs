import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodedImage, sourceFiles } from "./audit-lossless-assets.mjs";
import { compareImages } from "./audit-lossless-avif.mjs";
import { verifyRuntimeProof } from "./verify-runtime-proof.mjs";

const base = "docs/performance/lossless-assets";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
export async function verifyPublishedLossless() {
  const audit = await read(`${base}/per-asset-audit.json`),
    avif = await read(`${base}/avif-audit.json`),
    manifest = await read("shared/asset-variants.json"),
    native = await read(`${base}/native-codec-proof.json`),
    loading = await read(`${base}/loading-visual-proof.json`);
  const tree = execFileSync("git", ["ls-tree", "-r", "HEAD", "--", "public"], {
    encoding: "utf8",
  });
  const blobs = new Map(
    tree
      .trim()
      .split("\n")
      .map((line) => {
        const [metadata, file] = line.split("\t");
        return [file, metadata.split(" ")[2]];
      }),
  );
  assert.deepEqual(
    (await sourceFiles("public")).sort(),
    audit.assets.map((row) => row.file).sort(),
  );
  for (const row of audit.assets) {
    const bytes = await fs.readFile(row.file);
    assert.equal(sha(bytes), row.sourceSha256, row.file);
    const gitHash = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    assert.equal(
      gitHash,
      blobs.get(row.file),
      `Original changed from committed source: ${row.file}`,
    );
  }
  assert.equal(
    sha(await fs.readFile(`${base}/per-asset-audit.json`)),
    manifest.audits.losslessSha256,
  );
  assert.equal(
    sha(await fs.readFile(`${base}/avif-audit.json`)),
    manifest.audits.avifSha256,
  );
  assert.equal(avif.complete, true);
  assert.equal(native.complete, true);
  assert.deepEqual(native.errors, []);
  assert.deepEqual(loading.errors, []);
  assert.equal(loading.status.complete, true);
  let runtimeProof;
  for (const [file, hash] of Object.entries(loading.inputs.fingerprints)) {
    const current = sha(await fs.readFile(file));
    if (file === "src/game/assets.ts" && current !== hash) {
      // Preserve the original compression proof. A later loader is accepted
      // only with a complete, source-bound equivalence proof against that loader.
      runtimeProof = await verifyRuntimeProof(hash);
    } else assert.equal(current, hash, file);
  }
  const proofs = [];
  for (const entry of Object.values(manifest.assets)) {
    const before = await decodedImage(
      await fs.readFile("public/" + entry.source),
    );
    for (const variant of entry.variants) {
      const bytes = await fs.readFile("public/" + variant.file);
      assert.equal(bytes.length, variant.bytes);
      assert.equal(sha(bytes), variant.sha256);
      const proof = compareImages(before, await decodedImage(bytes));
      assert.equal(proof.accepted, true, variant.file);
      assert.equal(proof.beforeRgbaSha256, entry.rgbaSha256);
      const browser = native.rows.find(
        (row) => row.source === entry.source && row.variant === variant.file,
      );
      assert.ok(browser, `Missing native proof: ${variant.file}`);
      assert.equal(browser.differingChannels, 0);
      assert.equal(browser.maxDelta, 0);
      proofs.push({
        source: entry.source,
        variant: variant.file,
        sha256: variant.sha256,
        rgbaSha256: proof.beforeRgbaSha256,
        exactStraightRgbaAndSemantics: true,
        exactNativeCanvasRgba: true,
      });
    }
  }
  assert.equal(native.rows.length, proofs.length);
  const guide = "docs/finales/moveset-guide/ataques-arena-criolla.html";
  const guideHash = sha(await fs.readFile(guide));
  assert.equal(
    guideHash,
    sha(
      execFileSync("git", ["show", `HEAD:${guide}`], {
        maxBuffer: 32 * 1024 * 1024,
      }),
    ),
  );
  const report = {
    schema: 1,
    createdAtUtc: new Date().toISOString(),
    verifierSha256: sha(await fs.readFile(fileURLToPath(import.meta.url))),
    originalFilesUnchanged: audit.assets.length,
    imagesWithVariants: Object.keys(manifest.assets).length,
    exactPublishedVariants: proofs.length,
    allPublishedVariantsExact: true,
    loadingProof: loading.status,
    ...(runtimeProof
      ? {
          runtimeProof: {
            ...runtimeProof,
            directory: "docs/performance/runtime",
          },
        }
      : {}),
    portableGuideArtifactUnchanged: { file: guide, sha256: guideHash },
    proofs,
  };
  await fs.writeFile(
    `${base}/verification.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      originalFilesUnchanged: report.originalFilesUnchanged,
      exactPublishedVariants: report.exactPublishedVariants,
      loadingProofComplete: report.loadingProof.complete,
    }),
  );
  return report;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  await verifyPublishedLossless();
