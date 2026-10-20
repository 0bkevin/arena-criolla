import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { base, guideInputs, sha256, validateDrawAudit } from "./build-tools.mjs";

export async function compactGuideImage(original, { pruned = false, quality = 34 } = {}) {
  const before = await sharp(original).metadata();
  if (!before.width || !before.height) throw Error("Invalid guide source dimensions");
  const bytes = pruned
    ? await sharp({ create: { width: before.width, height: before.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp({ lossless: true, alphaQuality: 100, effort: 5 }).toBuffer()
    : await sharp(original).webp({ quality, alphaQuality: 100, effort: 5 }).toBuffer();
  const after = await sharp(bytes).metadata();
  if (before.width !== after.width || before.height !== after.height) throw Error("Guide image dimensions changed");
  if (pruned) {
    const rgba = await sharp(bytes).ensureAlpha().raw().toBuffer();
    if (rgba.some(value => value !== 0)) throw Error("Guide unused-image placeholder is not exact zero RGBA");
  } else if (before.hasAlpha) {
    const alphaBefore = await sharp(original).extractChannel("alpha").raw().toBuffer();
    const alphaAfter = await sharp(bytes).extractChannel("alpha").raw().toBuffer();
    if (!alphaBefore.equals(alphaAfter)) throw Error("Guide image alpha changed");
  }
  return { bytes, width: before.width, height: before.height };
}

/** Writes only after a fresh exhaustive audit passes. An alternate output is useful for dry runs. */
export async function prepareMedia({ auditFile = path.join(base, "draw-audit.json"), outputDirectory = base, legacyQuality = 34 } = {}) {
  if (!Number.isInteger(legacyQuality) || legacyQuality < 1 || legacyQuality > 100) throw Error("legacyQuality must be an integer 1..100");
  const inputs = await guideInputs(), auditBytes = await fs.readFile(auditFile);
  const audit = JSON.parse(auditBytes), { prunable } = validateDrawAudit(audit, inputs);
  const omitted = new Set(prunable), rows = [];
  await fs.mkdir(outputDirectory, { recursive: true });
  const staging = await fs.mkdtemp(path.join(outputDirectory, ".media-staging-"));
  try {
    for (const asset of inputs.assets) {
      const original = await fs.readFile(asset.source);
      if (sha256(original) !== asset.sourceSha256) throw Error(`Guide source changed while preparing: ${asset.id}`);
      const pruned = omitted.has(asset.id), quality = asset.attack ? 34 : legacyQuality;
      const { bytes, width, height } = await compactGuideImage(original, { pruned, quality });
      await fs.writeFile(path.join(staging, `${asset.id}.webp`), bytes);
      rows.push({ ...asset, file: `media/${asset.id}.webp`, width, height, bytes: bytes.length, previewSha256: sha256(bytes), pruned, quality: pruned ? null : quality, alpha: pruned ? "Exact zero RGBA; no draw in exhaustive audited demos" : "Exact source alpha; full source dimensions" });
    }
    if ((await guideInputs()).fingerprint !== inputs.fingerprint) throw Error("Guide inputs changed during media preparation; no output was published.");
    await fs.mkdir(path.join(outputDirectory, "media"), { recursive: true });
    for (const row of rows) await fs.rename(path.join(staging, `${row.id}.webp`), path.join(outputDirectory, row.file));
    const manifest = { schema: 2, scope: "Preview copies only; original game assets untouched. Used assets retain full dimensions and exact alpha. Only optional assets proved never drawn across every frame of every demo become full-dimension zero-RGBA placeholders. All new attack assets retain RGB quality34.", inputFingerprint: inputs.fingerprint, auditSha256: sha256(auditBytes), auditFile: path.relative(outputDirectory, path.resolve(auditFile)), legacyQuality, bytes: rows.reduce((n, row) => n + row.bytes, 0), assets: rows };
    await fs.writeFile(path.join(outputDirectory, "media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    return manifest;
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--audit=")) options.auditFile = path.resolve(arg.slice(8));
    else if (arg.startsWith("--out=")) options.outputDirectory = path.resolve(arg.slice(6));
    else if (arg.startsWith("--legacy-quality=")) options.legacyQuality = Number(arg.slice(17));
    else throw Error(`Unknown guide media argument: ${arg}`);
  }
  const manifest = await prepareMedia(options);
  console.log(`${manifest.assets.length} preview images (${manifest.assets.filter(a => a.pruned).length} audited unused placeholders); ${(manifest.bytes / 1048576).toFixed(2)} MiB before HTML embedding.`);
}
