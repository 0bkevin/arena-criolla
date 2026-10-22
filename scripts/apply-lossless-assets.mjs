import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  decodedImage,
  assertIdenticalImage,
} from "./audit-lossless-assets.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Recheck exact pixels/metadata before replacing a larger runtime encoding. */
export async function applyLosslessAssets(reportFile) {
  const input = await fs.readFile(reportFile, "utf8");
  const rows = reportFile.endsWith(".jsonl")
    ? input
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : JSON.parse(input).assets;
  const variants = JSON.parse(
    await fs.readFile("shared/asset-variants.json", "utf8"),
  );
  const publicRoot = path.resolve("public");
  let applied = 0,
    savedBytes = 0;
  for (const row of rows) {
    if (!row.candidateFile || !(row.savedBytes > 0)) continue;
    const source = path.resolve(row.file);
    if (path.dirname(source) !== path.join(publicRoot, "assets"))
      throw Error(`Expected a top-level public asset: ${row.file}`);
    const extension = path.extname(source);
    if (![".webp", ".png", ".avif"].includes(extension))
      throw Error(`Unsupported format: ${extension}`);
    const key = path.basename(source);
    // Those source bytes have a separate verified fallback contract.
    if (variants.assets[key])
      throw Error(`Asset already has published variants: ${key}`);
    const [original, candidate] = await Promise.all([
      fs.readFile(source),
      fs.readFile(row.candidateFile),
    ]);
    const beforeHash = digest(original),
      afterHash = digest(candidate);
    if (afterHash !== row.selectedSha256)
      throw Error(`Audit input changed: ${row.file}`);
    if (beforeHash === afterHash) continue;
    if (beforeHash !== row.sourceSha256)
      throw Error(`Audit input changed: ${row.file}`);
    if (candidate.length >= original.length) continue;
    const before = await decodedImage(original);
    const after = await decodedImage(candidate);
    assertIdenticalImage(before, after);
    if (before.metadata.format !== after.metadata.format)
      throw Error(`Image format changed: ${key}`);
    const temporary = `${source}.${process.pid}.lossless`;
    try {
      await fs.writeFile(temporary, candidate, {
        mode: (await fs.stat(source)).mode & 0o777,
      });
      await fs.rename(temporary, source);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    applied++;
    savedBytes += original.length - candidate.length;
  }
  return { applied, savedBytes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.argv[2])
    throw Error(
      `Usage: node ${path.basename(fileURLToPath(import.meta.url))} <audit.json|audit.jsonl>`,
    );
  console.log(JSON.stringify(await applyLosslessAssets(process.argv[2])));
}
