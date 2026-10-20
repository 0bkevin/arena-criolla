import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  brotliCompressSync,
  brotliDecompressSync,
  gzipSync,
  gunzipSync,
  constants,
} from "node:zlib";
import { pathToFileURL, fileURLToPath } from "node:url";
import sharp from "sharp";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const imageTypes = new Set([".webp", ".png", ".avif"]);
export async function walkFiles(directory, excludedDirectories = []) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (
      entry.isDirectory() &&
      !excludedDirectories.includes(path.resolve(file))
    )
      result.push(...(await walkFiles(file, excludedDirectories)));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}
// Published derivatives have already been verified against these source files.
// Auditing them as fresh sources would recursively generate derivative variants.
export function sourceFiles(directory) {
  return walkFiles(directory, [path.resolve(directory, "assets/optimized")]);
}
export function webpChunks(bytes) {
  if (
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  )
    return [];
  const chunks = [];
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4);
    chunks.push(bytes.toString("ascii", at, at + 4));
    at += 8 + size + (size % 2);
  }
  return chunks;
}
export async function decodedImage(bytes) {
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { metadata, data, info };
}
export function assertIdenticalImage(before, after) {
  for (const key of [
    "width",
    "height",
    "space",
    "depth",
    "orientation",
    "pages",
    "pageHeight",
    "loop",
  ])
    if (before.metadata[key] !== after.metadata[key])
      throw Error(`Image metadata changed: ${key}`);
  for (const key of ["icc", "exif", "xmp"]) {
    const a = before.metadata[key],
      b = after.metadata[key];
    if (Boolean(a) !== Boolean(b) || (a && !a.equals(b)))
      throw Error(`Image metadata changed: ${key}`);
  }
  if (
    JSON.stringify(before.metadata.delay) !==
    JSON.stringify(after.metadata.delay)
  )
    throw Error("Animation timing changed");
  if (
    before.info.width !== after.info.width ||
    before.info.height !== after.info.height ||
    before.info.channels !== after.info.channels ||
    !before.data.equals(after.data)
  )
    throw Error("Decoded RGBA differs");
}
export async function auditAsset(file, { candidateDirectory }) {
  const original = await fs.readFile(file),
    extension = path.extname(file).toLowerCase();
  const gzip = gzipSync(original, { level: 9 });
  const brotli = brotliCompressSync(original, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
  });
  if (
    !gunzipSync(gzip).equals(original) ||
    !brotliDecompressSync(brotli).equals(original)
  )
    throw Error(`Transport roundtrip failed: ${file}`);
  const row = {
    file,
    extension,
    originalBytes: original.length,
    sourceSha256: sha(original),
    gzipBytes: gzip.length,
    brotliBytes: brotli.length,
    transportRoundtripExact: true,
    candidates: [],
    selectedBytes: original.length,
    selectedSha256: sha(original),
    savedBytes: 0,
    decision: "Keep original; no image transcoding applicable",
  };
  if (!imageTypes.has(extension)) return row;
  const before = await decodedImage(original),
    meta = before.metadata;
  Object.assign(row, {
    width: meta.width,
    height: meta.height,
    decodedRgbaBytes: before.data.length,
    rgbaSha256: sha(before.data),
    encoding:
      meta.format === "webp"
        ? webpChunks(original).includes("VP8L")
          ? "WebP lossless"
          : "WebP lossy (existing input)"
        : meta.format,
    hasIcc: Boolean(meta.icc),
    hasExif: Boolean(meta.exif),
    hasXmp: Boolean(meta.xmp),
    tested: true,
  });
  if ((meta.pages ?? 1) !== 1 || meta.depth !== "uchar") {
    row.decision =
      "Keep original; animation/high-bit-depth encoding requires separate proof";
    return row;
  }
  const candidates =
    extension === ".avif"
      ? [
          {
            name: "avif-lossless-444-e4",
            options: {
              lossless: true,
              chromaSubsampling: "4:4:4",
              bitdepth: 8,
              effort: 4,
            },
          },
        ]
      : extension === ".webp"
        ? [
            {
              name: "webp-lossless-q100-e6-exact",
              options: {
                quality: 100,
                lossless: true,
                nearLossless: false,
                exact: true,
                alphaQuality: 100,
                effort: 6,
              },
            },
            {
              name: "webp-lossless-q80-e6-exact",
              options: {
                quality: 80,
                lossless: true,
                nearLossless: false,
                exact: true,
                alphaQuality: 100,
                effort: 6,
              },
            },
          ]
        : [
            {
              name: "png-deflate9-adaptive",
              options: {
                compressionLevel: 9,
                adaptiveFiltering: true,
                palette: false,
              },
            },
            {
              name: "png-deflate9",
              options: {
                compressionLevel: 9,
                adaptiveFiltering: false,
                palette: false,
              },
            },
          ];
  let selected;
  for (const candidate of candidates) {
    const started = performance.now();
    const pipeline = sharp(original);
    // Copy only metadata that exists. keepMetadata() can invent EXIF.
    if (meta.icc) pipeline.keepIccProfile();
    if (meta.exif) pipeline.keepExif();
    if (meta.xmp) pipeline.keepXmp();
    const output = await (
      extension === ".webp"
        ? pipeline.webp(candidate.options)
        : extension === ".avif"
          ? pipeline.avif(candidate.options)
          : pipeline.png(candidate.options)
    ).toBuffer();
    const record = {
      name: candidate.name,
      options: candidate.options,
      bytes: output.length,
      encodeMs: Math.round((performance.now() - started) * 10) / 10,
      exactRgbaAndMetadata: false,
      smaller: output.length < original.length,
    };
    try {
      assertIdenticalImage(before, await decodedImage(output));
      record.exactRgbaAndMetadata = true;
    } catch (error) {
      record.rejection = error.message;
    }
    if (record.exactRgbaAndMetadata && output.length < row.selectedBytes) {
      row.selectedBytes = output.length;
      row.selectedSha256 = sha(output);
      row.selectedEncoding = candidate.name;
      selected = output;
    }
    row.candidates.push(record);
  }
  if (selected) {
    const destination = path.join(candidateDirectory, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, selected);
    row.candidateFile = destination;
    row.savedBytes = original.length - selected.length;
    row.decision =
      "Verified smaller lossless candidate; original not changed by audit";
  } else
    row.decision =
      "Keep original; no smaller candidate with identical RGBA and metadata";
  return row;
}
export async function runAudit({
  directory = "public",
  output = path.join(os.tmpdir(), "arena-per-asset-audit.json"),
  candidateDirectory,
  workers = 2,
} = {}) {
  candidateDirectory ??= await fs.mkdtemp(
    path.join(os.tmpdir(), "arena-lossless-assets-"),
  );
  const files = await sourceFiles(directory),
    rows = new Array(files.length),
    began = performance.now();
  const checkpointPolicy = sha(
    Buffer.from(
      JSON.stringify({
        schema: 2,
        node: process.version,
        sharp: sharp.versions,
        implementation: sha(await fs.readFile(fileURLToPath(import.meta.url))),
      }),
    ),
  );
  let cursor = 0,
    complete = 0;
  await fs.mkdir(path.dirname(output), { recursive: true });
  const checkpoint = new Map();
  try {
    for (const line of (await fs.readFile(output + ".progress.jsonl", "utf8"))
      .split("\n")
      .filter(Boolean)) {
      const row = JSON.parse(line);
      checkpoint.set(row.file, row);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.writeFile(output + ".progress.jsonl", "");
  sharp.concurrency(1);
  sharp.cache({ memory: 64, items: 32, files: 0 });
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < files.length) {
        const index = cursor++;
        const file = files[index],
          cached = checkpoint.get(file);
        let reusable = Boolean(
          cached &&
          cached.checkpointPolicy === checkpointPolicy &&
          cached.sourceSha256 === sha(await fs.readFile(file)),
        );
        if (reusable && cached.candidateFile) {
          try {
            reusable =
              sha(await fs.readFile(cached.candidateFile)) ===
              cached.selectedSha256;
          } catch {
            reusable = false;
          }
        }
        rows[index] = reusable
          ? cached
          : await auditAsset(file, { candidateDirectory });
        rows[index].checkpointPolicy = checkpointPolicy;
        await fs.appendFile(
          output + ".progress.jsonl",
          JSON.stringify(rows[index]) + "\n",
        );
        complete++;
        if (complete % 20 === 0)
          console.log(`Audited ${complete}/${files.length} assets`);
      }
    }),
  );
  const images = rows.filter((row) => row.tested),
    smaller = rows.filter((row) => row.savedBytes > 0);
  const report = {
    schema: 1,
    checkpointPolicy,
    createdAtUtc: new Date().toISOString(),
    scope:
      "Every source file shipped from public, excluding generated assets/optimized derivatives (verified separately against their sources). Source/research archives and the separately published portable guide remain untouched.",
    policy:
      "No resizing, quantization, near-lossless, chroma changes or quality reduction. Keep original unless same-format candidate is smaller with identical full decoded RGBA (including invisible RGB) and identical color/orientation metadata. Audit does not modify originals.",
    tools: { node: process.version, sharp: sharp.versions },
    sources: [
      "https://sharp.pixelplumbing.com/api-output/#webp",
      "https://developers.google.com/speed/webp/docs/cwebp",
    ],
    candidateDirectory,
    seconds: Math.round((performance.now() - began) / 100) / 10,
    summary: {
      files: rows.length,
      rasterImages: images.length,
      originalBytes: rows.reduce((n, r) => n + r.originalBytes, 0),
      selectedBytes: rows.reduce((n, r) => n + r.selectedBytes, 0),
      savedBytes: rows.reduce((n, r) => n + r.savedBytes, 0),
      smallerExactImages: smaller.length,
      unchangedFiles: rows.length - smaller.length,
      allTransportRoundtripsExact: rows.every(
        (row) => row.transportRoundtripExact,
      ),
    },
    assets: rows,
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary));
  return report;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      if (!arg.startsWith("--") || !arg.includes("="))
        throw Error(
          "Use --directory=, --output=, --candidate-directory= or --workers=",
        );
      const at = arg.indexOf("=");
      return [arg.slice(2, at), arg.slice(at + 1)];
    }),
  );
  for (const name of Object.keys(args))
    if (
      !["directory", "output", "candidate-directory", "workers"].includes(name)
    )
      throw Error(`Unknown option: ${name}`);
  const workers = Number(args.workers ?? 2);
  if (!Number.isInteger(workers) || workers < 1 || workers > 4)
    throw Error("workers must be1..4");
  await runAudit({
    directory: args.directory,
    output: args.output,
    candidateDirectory: args["candidate-directory"],
    workers,
  });
}
