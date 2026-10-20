import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import {
  preparePerroMujeriego,
  type PerroFrame,
} from "./prepare-perro-mujeriego";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const IDS = BUILT_IN_FIGHTERS.map(({ id }) => id).sort();
interface Dancer {
  file: string;
  frames: PerroFrame[];
}
interface PackedDancer {
  id: string;
  file: string;
  raw: string;
  source: string;
  runtime: string;
  inputSha256: string;
  sourceSha256: string;
  runtimeSha256: string;
  alphaSha256: string;
  rgbaSha256: string;
  fingerprint: string;
  choreographySha256: string;
  frames: PerroFrame[];
}

/** This strict audit is invoked explicitly only after the full art batch exists. */
export function requireCompleteDancerRoster(
  manifestIds: string[],
  auditIds: string[],
) {
  assert.equal(
    manifestIds.length,
    IDS.length,
    `Runtime manifest requires all ${IDS.length} dancers; generation is incomplete`,
  );
  assert.equal(
    auditIds.length,
    IDS.length,
    `Packing audit requires all ${IDS.length} dancer records`,
  );
  assert.equal(
    new Set(auditIds).size,
    IDS.length,
    "Packing audit contains duplicate identities",
  );
  assert.deepEqual(
    [...manifestIds].sort(),
    IDS,
    "Runtime manifest must contain every built-in fighter exactly once",
  );
  assert.deepEqual(
    [...auditIds].sort(),
    IDS,
    "Packing provenance must contain every built-in fighter exactly once",
  );
}

// Validate the declared torso axis against the actual opaque scanlines, using
// the anatomical middle band rather than a hand-expanded bounding-box center.
function torsoAxis(rgba: Buffer, width: number, frame: PerroFrame) {
  const medians: number[] = [];
  for (
    let y = frame.y + Math.floor(frame.height * 0.45);
    y < frame.y + Math.ceil(frame.height * 0.65);
    y++
  ) {
    const row = Array.from(
      { length: frame.width },
      (_, x) => rgba[(y * width + frame.x + x) * 4 + 3],
    );
    const mass = row.reduce(
      (sum, alpha) => sum + (alpha >= 200 ? alpha : 0),
      0,
    );
    if (!mass) continue;
    let cumulative = 0;
    for (const [x, alpha] of row.entries()) {
      if (alpha < 200) continue;
      if (cumulative + alpha >= mass / 2) {
        medians.push(x + (mass / 2 - cumulative) / alpha);
        break;
      }
      cumulative += alpha;
    }
  }
  assert.ok(medians.length, "Pose has no opaque torso band");
  medians.sort((a, b) => a - b);
  return (
    (medians[Math.floor((medians.length - 1) / 2)] +
      medians[Math.floor(medians.length / 2)]) /
    2
  );
}

export async function auditPerroMujeriego(root = process.cwd()) {
  const manifestFile = "shared/perro-mujeriego-assets.json";
  const auditFile = "docs/finales/perro-mujeriego-v3.json";
  const manifest = JSON.parse(
    await readFile(path.join(root, manifestFile), "utf8"),
  ) as { dancers: Record<string, Dancer> };
  const audit = JSON.parse(
    await readFile(path.join(root, auditFile), "utf8"),
  ) as {
    version: number;
    cell: number;
    baseline: number;
    choreography: { file: string; sha256: string };
    assets: PackedDancer[];
  };
  requireCompleteDancerRoster(
    Object.keys(manifest.dancers),
    audit.assets.map(({ id }) => id),
  );
  assert.equal(audit.version, 3);
  assert.equal(audit.cell, 512);
  assert.equal(audit.baseline, 482);
  assert.equal(
    audit.choreography.file,
    "docs/finales/perro-mujeriego-v3/choreography.json",
  );
  const choreography = await readFile(path.join(root, audit.choreography.file));
  assert.equal(
    sha(choreography),
    audit.choreography.sha256,
    "Choreography provenance changed since packing",
  );
  const fingerprint = sha(
    Buffer.concat([
      await readFile(new URL("./prepare-perro-mujeriego.ts", import.meta.url)),
      await readFile(new URL("./prepare-finale-actors.ts", import.meta.url)),
      await readFile(
        new URL("../server/creator/normalize-atlas.ts", import.meta.url),
      ),
      Buffer.from(JSON.stringify(sharp.versions)),
    ]),
  );
  const files = [manifestFile, auditFile, audit.choreography.file];
  const originalDigests = new Set<string>(),
    silhouetteDigests = new Set<string>();
  let runtimeBytes = 0,
    originalBytes = 0,
    poses = 0,
    alphaPixels = 0;
  // Sequential decoding bounds memory while visiting all authored atlases.
  for (const id of IDS) {
    const record = audit.assets.find((asset) => asset.id === id)!;
    const actor = manifest.dancers[id];
    const context = `${id}: `;
    assert.equal(
      record.file,
      `perro-mujeriego-v3-${id}`,
      context + "runtime identity",
    );
    assert.equal(
      record.raw,
      `assets/source/finales/perro-mujeriego-v3/${id}-generated.png`,
    );
    assert.equal(
      record.source,
      `assets/source/finales/perro-mujeriego-v3/${id}.png`,
    );
    assert.equal(record.runtime, `public/assets/${record.file}.webp`);
    assert.equal(actor.file, record.file);
    assert.deepEqual(
      actor.frames,
      record.frames,
      context + "manifest and packing geometry disagree",
    );
    assert.equal(
      record.frames.length,
      8,
      context + "exactly eight authored poses",
    );
    assert.equal(
      record.fingerprint,
      fingerprint,
      context + "run the current full packer before strict audit",
    );
    assert.equal(
      record.choreographySha256,
      audit.choreography.sha256,
      context + "run the full packer to update choreography provenance",
    );
    const [raw, png, webp] = await Promise.all(
      [record.raw, record.source, record.runtime].map((file) =>
        readFile(path.join(root, file)),
      ),
    );
    assert.equal(
      sha(raw),
      record.inputSha256,
      context + "generated original changed",
    );
    assert.equal(
      sha(png),
      record.sourceSha256,
      context + "normalized PNG changed",
    );
    assert.equal(
      sha(webp),
      record.runtimeSha256,
      context + "runtime WebP changed",
    );
    assert.ok(
      !originalDigests.has(record.inputSha256),
      context + "another identity uses the identical generated source",
    );
    originalDigests.add(record.inputSha256);
    const sourceInfo = await sharp(raw).metadata();
    assert.equal(sourceInfo.format, "png");
    assert.ok(sourceInfo.hasAlpha, context + "generated source requires alpha");
    const [pngInfo, webpInfo] = await Promise.all([
      sharp(png).metadata(),
      sharp(webp).metadata(),
    ]);
    assert.equal(pngInfo.format, "png", context + "normalized format");
    assert.equal(webpInfo.format, "webp", context + "runtime format");
    assert.ok(
      pngInfo.hasAlpha && webpInfo.hasAlpha,
      context + "both packed formats retain transparency",
    );
    const packed = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const runtime = await sharp(webp)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(packed.info.width, 2048);
    assert.equal(packed.info.height, 1024);
    assert.equal(packed.info.channels, 4);
    assert.equal(runtime.info.width, packed.info.width);
    assert.equal(runtime.info.height, packed.info.height);
    assert.deepEqual(
      runtime.data,
      packed.data,
      context + "lossless RGBA mismatch",
    );
    assert.equal(sha(packed.data), record.rgbaSha256);
    assert.ok(
      !silhouetteDigests.has(record.rgbaSha256),
      context + "another identity uses identical runtime artwork",
    );
    silhouetteDigests.add(record.rgbaSha256);
    const alpha = Buffer.alloc(packed.info.width * packed.info.height);
    for (let p = 0; p < alpha.length; p++) alpha[p] = packed.data[p * 4 + 3];
    assert.equal(
      sha(alpha),
      record.alphaSha256,
      context + "alpha provenance mismatch",
    );
    const poseDigests = new Set<string>();
    for (const [index, frame] of actor.frames.entries()) {
      const left = (index % 4) * 512,
        top = Math.floor(index / 4) * 512;
      let minX = left + 512,
        minY = top + 512,
        maxX = -1,
        maxY = -1,
        visible = 0;
      for (let y = top; y < top + 512; y++)
        for (let x = left; x < left + 512; x++) {
          if (!alpha[y * packed.info.width + x]) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          visible++;
        }
      assert.ok(
        visible > 512 * 512 * 0.01,
        context + `pose ${index} is empty or incomplete`,
      );
      assert.deepEqual(
        { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
        { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        context + `pose ${index} crop is not the complete tight silhouette`,
      );
      assert.ok(
        minX > left + 4 && maxX < left + 512 - 4 && minY > top + 4,
        context + `pose ${index} touches a cell edge`,
      );
      assert.equal(maxY + 1, top + 482, context + `pose ${index} baseline`);
      assert.equal(
        frame.bodyHeight,
        actor.frames[0].height,
        context + "raised hands must not change display scale",
      );
      assert.ok(
        Number.isFinite(frame.anchorX) &&
          frame.anchorX > 0 &&
          frame.anchorX < frame.width,
        context + "invalid torso axis",
      );
      assert.ok(
        Math.abs(
          frame.anchorX - torsoAxis(packed.data, packed.info.width, frame),
        ) < 1e-8,
        context + `pose ${index} axis drifts from opaque torso`,
      );
      const pixels = Buffer.alloc(frame.width * frame.height * 4);
      for (let y = 0; y < frame.height; y++)
        packed.data.copy(
          pixels,
          y * frame.width * 4,
          ((frame.y + y) * packed.info.width + frame.x) * 4,
          ((frame.y + y) * packed.info.width + frame.x + frame.width) * 4,
        );
      const poseHash = sha(pixels);
      assert.ok(
        !poseDigests.has(poseHash),
        context + "two choreography keys use identical artwork",
      );
      poseDigests.add(poseHash);
      poses++;
      alphaPixels += visible;
    }
    runtimeBytes += webp.length;
    originalBytes += raw.length;
    files.push(record.raw, record.source, record.runtime);
  }
  const before = await Promise.all(
    files.map(async (file) => ({
      file,
      hash: sha(await readFile(path.join(root, file))),
      modifiedAt: (await stat(path.join(root, file))).mtimeMs,
    })),
  );
  const repeated = await preparePerroMujeriego(root);
  assert.equal(
    repeated.converted,
    0,
    "an unchanged complete roster must not be reconverted",
  );
  assert.equal(repeated.cached, IDS.length);
  assert.deepEqual(repeated.manifest, manifest);
  for (const file of before) {
    assert.equal(
      sha(await readFile(path.join(root, file.file))),
      file.hash,
      `${file.file}: repeat packing mutated bytes`,
    );
    assert.equal(
      (await stat(path.join(root, file.file))).mtimeMs,
      file.modifiedAt,
      `${file.file}: repeat packing rewrote the file`,
    );
  }
  return {
    fighters: IDS.length,
    poses,
    cached: repeated.cached,
    alphaPixels,
    originalBytes,
    runtimeBytes,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  auditPerroMujeriego()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
