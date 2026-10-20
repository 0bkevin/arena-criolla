import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = "docs/performance/runtime";
export async function verifyRuntimeProof(expectedBaselineLoaderSha256) {
  const provenance = JSON.parse(
    await fs.readFile(`${root}/provenance.json`, "utf8"),
  );
  const baseline = execFileSync("git", [
    "show",
    `${provenance.baselineCommit}:src/game/assets.ts`,
  ]);
  assert.equal(sha(baseline), provenance.baselineLoaderSha256);
  if (expectedBaselineLoaderSha256)
    assert.equal(provenance.baselineLoaderSha256, expectedBaselineLoaderSha256);
  for (const [file, fingerprint] of Object.entries(provenance.fingerprints))
    assert.equal(
      sha(await fs.readFile(file)),
      fingerprint,
      `Stale runtime proof: ${file}`,
    );
  const quality = JSON.parse(
    await fs.readFile(`${root}/quality-proof.json`, "utf8"),
  );
  const sprite = JSON.parse(
    await fs.readFile(`${root}/sprite-proof.json`, "utf8"),
  );
  for (const proof of [quality, sprite]) {
    assert.equal(proof.complete, true);
    assert.deepEqual(proof.errors, []);
  }
  const qa = JSON.parse(
    await fs.readFile("docs/character-sprite-qa.json", "utf8"),
  );
  const ids = qa.sprites.map((row) => row.id).sort();
  assert.deepEqual(quality.sprites.map((row) => row.id).sort(), ids);
  assert.deepEqual(sprite.portraits.map((row) => row.id).sort(), ids);
  for (const row of quality.sprites) {
    assert.equal(row.differingChannels, 0);
    assert.equal(row.hashes.length, 16);
    assert.equal(row.portraitCenters.length, 8);
  }
  for (const row of sprite.portraits) {
    assert.equal(row.comparisons, 32);
    assert.equal(row.differingChannels, 0);
  }
  const expectedAudio = [44100, 48000]
    .flatMap((rate) => [
      `ambience:ambience:${rate}`,
      `draw:victory:${rate}`,
      ...ids.flatMap((id) => [`${id}:victory:${rate}`, `${id}:finale:${rate}`]),
    ])
    .sort();
  assert.deepEqual(
    quality.audio
      .map((row) => `${row.fighter}:${row.kind}:${row.sampleRate}`)
      .sort(),
    expectedAudio,
  );
  for (const row of quality.audio) assert.equal(row.differingBytes, 0);
  return {
    sprites: quality.sprites.length,
    portraits: sprite.portraits.length * 32,
    scores: quality.audio.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(await verifyRuntimeProof());
