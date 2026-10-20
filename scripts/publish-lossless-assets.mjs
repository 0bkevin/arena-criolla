import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { compareImages } from "./audit-lossless-avif.mjs";
import { sourceFiles } from "./audit-lossless-assets.mjs";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const base = "docs/performance/lossless-assets";
async function decode(bytes) {
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { metadata, data, info };
}
export async function publishLosslessAssets({
  auditFile = `${base}/per-asset-audit.json`,
  avifAuditFile = `${base}/avif-audit.json`,
  minimumBytes = 4096,
  minimumRatio = 0.01,
} = {}) {
  const [auditBytes, avifBytes] = await Promise.all([
    fs.readFile(auditFile),
    fs.readFile(avifAuditFile),
  ]);
  const audit = JSON.parse(auditBytes),
    avif = JSON.parse(avifBytes);
  if (
    audit.schema !== 1 ||
    !audit.summary?.files ||
    !avif.complete ||
    avif.summary.files !== avif.summary.expectedFiles
  )
    throw Error("Complete matching image audits are required");
  const currentFiles = await sourceFiles("public");
  if (
    JSON.stringify(currentFiles.sort()) !==
    JSON.stringify(audit.assets.map((row) => row.file).sort())
  )
    throw Error("Public inventory changed after audit");
  for (const row of audit.assets)
    if (sha(await fs.readFile(row.file)) !== row.sourceSha256)
      throw Error(`Source changed after audit: ${row.file}`);
  const avifRows = new Map(avif.assets.map((row) => [row.file, row]));
  const assets = {},
    selections = [];
  for (const row of audit.assets) {
    if (
      !row.tested ||
      !row.file.startsWith("public/assets/") ||
      row.file.slice("public/assets/".length).includes("/")
    )
      continue;
    const avifRow = avifRows.get(row.file);
    if (!avifRow || avifRow.sourceSha256 !== row.sourceSha256)
      throw Error(`Audits disagree about ${row.file}`);
    const original = await fs.readFile(row.file);
    if (sha(original) !== row.sourceSha256)
      throw Error(`Source changed: ${row.file}`);
    const extension = path.extname(row.file),
      candidates = [];
    if (row.savedBytes > 0 && row.candidateFile)
      candidates.push({
        file: row.candidateFile,
        sha256: row.selectedSha256,
        bytes: row.selectedBytes,
        extension,
        method: row.selectedEncoding,
      });
    for (const candidate of avifRow.candidates)
      if (candidate.accepted && candidate.smaller)
        candidates.push({
          file: candidate.candidateFile,
          sha256: candidate.sha256,
          bytes: candidate.bytes,
          extension: ".avif",
          method: candidate.encoder,
        });
    const eligible = candidates
      .filter(
        (c) =>
          original.length - c.bytes >= minimumBytes &&
          1 - c.bytes / original.length >= minimumRatio,
      )
      .sort((a, b) => a.bytes - b.bytes);
    const selected = [];
    for (const candidate of eligible) {
      if (selected.some((c) => c.extension === candidate.extension)) continue;
      const bytes = await fs.readFile(candidate.file);
      if (sha(bytes) !== candidate.sha256 || bytes.length !== candidate.bytes)
        throw Error(`Candidate changed: ${candidate.file}`);
      const before = await decode(original),
        after = await decode(bytes),
        proof = compareImages(before, after);
      if (!proof.accepted)
        throw Error(`Pixel/metadata proof failed: ${row.file}`);
      // Keep both formats only if AVIF is smaller than the original-format fallback.
      const fallback = eligible.find((c) => c.extension === extension);
      if (
        candidate.extension === ".avif" &&
        extension !== ".avif" &&
        fallback &&
        candidate.bytes >= fallback.bytes
      )
        continue;
      const stem = path.basename(row.file, extension),
        file = `assets/optimized/${stem}-${candidate.sha256.slice(0, 16)}${candidate.extension}`;
      await fs.mkdir("public/assets/optimized", { recursive: true });
      await fs.writeFile(path.join("public", file), bytes);
      selected.push({
        ...candidate,
        publishedFile: file,
        rgbaSha256: proof.beforeRgbaSha256,
      });
    }
    if (!selected.length) {
      selections.push({
        file: row.file,
        decision:
          "Keep original; no exact candidate meets the practical savings threshold",
        originalBytes: row.originalBytes,
        deliveredBytes: row.originalBytes,
      });
      continue;
    }
    const name = path.basename(row.file);
    assets[name] = {
      source: `assets/${name}`,
      sourceSha256: row.sourceSha256,
      rgbaSha256: row.rgbaSha256,
      variants: selected.map((c) => ({
        file: c.publishedFile,
        sha256: c.sha256,
        bytes: c.bytes,
        contentType:
          c.extension === ".avif"
            ? "image/avif"
            : c.extension === ".png"
              ? "image/png"
              : "image/webp",
      })),
    };
    selections.push({
      file: row.file,
      decision: "Serve verified smaller derivative; retain original fallback",
      originalBytes: row.originalBytes,
      deliveredBytes: Math.min(...selected.map((c) => c.bytes)),
      variants: selected.map((c) => ({
        file: c.publishedFile,
        bytes: c.bytes,
        method: c.method,
      })),
    });
  }
  if (avifRows.size !== audit.assets.filter((r) => r.tested).length)
    throw Error("The raster image audit inventories differ");
  const manifest = {
    schema: 1,
    createdAtUtc: new Date().toISOString(),
    policy:
      "Full decoded RGBA including invisible RGB and color/orientation metadata unchanged. Original files retained; explicit AVIF negotiation and verified original-format fallback. Only practical savings above the recorded bytes/ratio thresholds are published.",
    audits: { losslessSha256: sha(auditBytes), avifSha256: sha(avifBytes) },
    assets,
  };
  await fs.writeFile(
    "shared/asset-variants.json.tmp",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await fs.rename(
    "shared/asset-variants.json.tmp",
    "shared/asset-variants.json",
  );
  const report = {
    schema: 1,
    createdAtUtc: manifest.createdAtUtc,
    minimumBytes,
    minimumRatio,
    originalFilesUnchanged: true,
    summary: {
      originalImages: selections.length,
      imagesWithVariants: Object.keys(assets).length,
      variants: Object.values(assets).reduce(
        (n, a) => n + a.variants.length,
        0,
      ),
      avifVariants: Object.values(assets)
        .flatMap((a) => a.variants)
        .filter((v) => v.contentType === "image/avif").length,
      savedBytes: selections.reduce(
        (n, r) => n + r.originalBytes - r.deliveredBytes,
        0,
      ),
    },
    selections,
  };
  await fs.writeFile(
    `${base}/published-variants.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report.summary));
  return report;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  await publishLosslessAssets();
