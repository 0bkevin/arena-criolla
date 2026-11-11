import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodedImage, assertIdenticalImage } from "./audit-lossless-assets";

/** Fields an applied audit row must carry; other rows are skipped below. */
interface ApplicableRow {
  file: string;
  candidateFile: string;
  savedBytes: number;
  selectedSha256: string;
  sourceSha256: string;
}
interface AssetVariants {
  assets: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
// The report path is supplied on the command line, so check each row's shape.
function applicableRow(row: unknown): ApplicableRow | null {
  if (!isRecord(row)) throw Error("Audit rows must be objects");
  if (
    !row.candidateFile ||
    !(typeof row.savedBytes === "number" && row.savedBytes > 0)
  )
    return null;
  const { file, candidateFile, savedBytes, selectedSha256, sourceSha256 } = row;
  if (
    typeof file !== "string" ||
    typeof candidateFile !== "string" ||
    typeof selectedSha256 !== "string" ||
    typeof sourceSha256 !== "string"
  )
    throw Error(`Malformed audit row: ${String(file)}`);
  return { file, candidateFile, savedBytes, selectedSha256, sourceSha256 };
}
function reportRows(report: unknown): unknown[] {
  if (!isRecord(report) || !Array.isArray(report.assets))
    throw Error("Audit report must contain an assets array");
  return report.assets;
}

const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Recheck exact pixels/metadata before replacing a larger runtime encoding. */
export async function applyLosslessAssets(
  reportFile: string,
): Promise<{ applied: number; savedBytes: number }> {
  const input = await fs.readFile(reportFile, "utf8");
  const rows: unknown[] = reportFile.endsWith(".jsonl")
    ? input
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line): unknown => JSON.parse(line))
    : reportRows(JSON.parse(input));
  const variants: AssetVariants = JSON.parse(
    await fs.readFile("server/asset-variants.json", "utf8"),
  );
  const publicRoot = path.resolve("public");
  let applied = 0,
    savedBytes = 0;
  for (const entry of rows) {
    const row = applicableRow(entry);
    if (!row) continue;
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
