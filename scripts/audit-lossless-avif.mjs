import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL, fileURLToPath } from "node:url";
import sharp from "sharp";
import { sourceFiles } from "./audit-lossless-assets.mjs";

const runFile = promisify(execFile);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const rounded = (value) => Math.round(value * 100) / 100;
const sharpOptions = Object.freeze({
  lossless: true,
  chromaSubsampling: "4:4:4",
  bitdepth: 8,
  effort: 4,
});
const avifencOptions = Object.freeze([
  "--lossless",
  "--depth",
  "8",
  "--yuv",
  "444",
  "--range",
  "full",
  "--cicp",
  "1/13/0",
  "--speed",
  "6",
  "--jobs",
  "1",
]);

async function imageFiles(directory) {
  return (await sourceFiles(directory)).filter((file) =>
    /\.(webp|png|avif)$/i.test(file),
  );
}

async function decode(bytes) {
  const started = performance.now();
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { metadata, data, info, ms: rounded(performance.now() - started) };
}

// Metadata shape is container-dependent: one PNG/WebP can omit pages/pageHeight,
// while an equivalent single-image HEIF reports pages:1/pageHeight:height.
function imageSemantics(image) {
  const m = image.metadata;
  const pages = m.pages ?? 1;
  return {
    width: image.info.width,
    height: image.info.height,
    channels: image.info.channels,
    space: m.space,
    depth: m.depth,
    bitsPerSample: m.bitsPerSample ?? 8,
    orientation: m.orientation ?? 1,
    pages,
    pageHeight: pages > 1 ? (m.pageHeight ?? m.height) : image.info.height,
    loop: pages > 1 ? (m.loop ?? null) : null,
    delay: pages > 1 ? (m.delay ?? null) : null,
    iccSha256: m.icc ? sha256(m.icc) : null,
    exifSha256: m.exif ? sha256(m.exif) : null,
    xmpSha256: m.xmp ? sha256(m.xmp) : null,
  };
}

export function compareImages(before, after) {
  const a = imageSemantics(before),
    b = imageSemantics(after);
  const metadataDifferences = Object.keys(a).filter(
    (key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]),
  );
  let differingPixels = 0,
    differingVisiblePixels = 0,
    differingInvisiblePixels = 0;
  let differingAlphaPixels = 0,
    differingChannels = 0,
    maximumChannelDifference = 0;
  const equalLayout =
    before.info.width === after.info.width &&
    before.info.height === after.info.height &&
    before.info.channels === after.info.channels &&
    before.data.length === after.data.length;
  if (equalLayout && !before.data.equals(after.data)) {
    for (let at = 0; at < before.data.length; at += 4) {
      let differs = false;
      for (let c = 0; c < 4; c++) {
        const delta = Math.abs(before.data[at + c] - after.data[at + c]);
        if (delta) {
          differs = true;
          differingChannels++;
          maximumChannelDifference = Math.max(maximumChannelDifference, delta);
        }
      }
      if (differs) {
        differingPixels++;
        if (before.data[at + 3] === 0 && after.data[at + 3] === 0)
          differingInvisiblePixels++;
        else differingVisiblePixels++;
      }
      if (before.data[at + 3] !== after.data[at + 3]) differingAlphaPixels++;
    }
  }
  const exactRgba = equalLayout && before.data.equals(after.data);
  return {
    exactRgba,
    exactSemantics: metadataDifferences.length === 0,
    accepted: exactRgba && metadataDifferences.length === 0,
    beforeRgbaSha256: sha256(before.data),
    afterRgbaSha256: sha256(after.data),
    metadataDifferences,
    beforeSemantics: a,
    afterSemantics: b,
    differingPixels,
    differingVisiblePixels,
    differingInvisiblePixels,
    differingAlphaPixels,
    differingChannels,
    maximumChannelDifference,
    rejection:
      exactRgba && !metadataDifferences.length
        ? null
        : [
            !equalLayout
              ? "Decoded RGBA layout differs"
              : !exactRgba
                ? "Full straight RGBA differs (including RGB under zero alpha)"
                : null,
            metadataDifferences.length
              ? `Image semantics changed: ${metadataDifferences.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join("; "),
  };
}

async function candidateRecord(before, originalBytes, bytes, options, started) {
  const encodeMs = rounded(performance.now() - started);
  const after = await decode(bytes);
  const proof = compareImages(before, after);
  return {
    options,
    bytes: bytes.length,
    sha256: sha256(bytes),
    encodeMs,
    decodeMs: after.ms,
    smaller: bytes.length < originalBytes,
    savingBytes: originalBytes - bytes.length,
    ...proof,
  };
}

async function auditOne(file, { candidateDirectory, fallback, avifenc }) {
  const bytes = await fs.readFile(file),
    before = await decode(bytes),
    m = before.metadata;
  const row = {
    file,
    originalBytes: bytes.length,
    sourceSha256: sha256(bytes),
    sourceDecodeMs: before.ms,
    sourceSemantics: imageSemantics(before),
    candidates: [],
  };
  if (
    (m.pages ?? 1) !== 1 ||
    m.depth !== "uchar" ||
    (m.bitsPerSample ?? 8) !== 8 ||
    m.space !== "srgb" ||
    (m.orientation ?? 1) !== 1
  ) {
    row.decision =
      "Keep original; source needs separate animated/high-depth/color/orientation proof";
    return row;
  }
  const stem = path.join(candidateDirectory, file);
  await fs.mkdir(path.dirname(stem), { recursive: true });
  let sharpAccepted = false;
  try {
    const started = performance.now();
    // keepMetadata() can synthesize EXIF even when the source had none. Preserve
    // actual source payloads when present; otherwise emit no invented metadata.
    let pipeline = sharp(bytes);
    if (m.icc || m.exif || m.xmp) pipeline = pipeline.keepMetadata();
    const output = await pipeline.avif(sharpOptions).toBuffer();
    const record = {
      encoder: "sharp-avif-e4",
      ...(await candidateRecord(
        before,
        bytes.length,
        output,
        sharpOptions,
        started,
      )),
    };
    record.candidateFile = `${stem}.sharp-e4.avif`;
    await fs.writeFile(record.candidateFile, output);
    row.candidates.push(record);
    sharpAccepted = record.accepted;
  } catch (error) {
    row.candidates.push({
      encoder: "sharp-avif-e4",
      options: sharpOptions,
      accepted: false,
      rejection: error.message,
    });
  }

  // Identity/GBR avoids an otherwise irreversible RGB→YCbCr→RGB conversion.
  // Run this fallback only when needed, unless explicitly asked to compare both.
  if (
    avifenc &&
    (fallback === "all" || (fallback === "auto" && !sharpAccepted))
  ) {
    const inputFile = `${stem}.rgba-input.png`,
      outputFile = `${stem}.identity-s6.avif`;
    try {
      const png = await sharp(before.data, {
        raw: {
          width: before.info.width,
          height: before.info.height,
          channels: 4,
        },
      })
        .png({ compressionLevel: 1, palette: false })
        .toBuffer();
      const pngProof = compareImages(before, await decode(png));
      // Raw PNG transport does not carry source ICC/Exif/XMP, so attach those
      // original payloads explicitly to avifenc rather than reconstructing them.
      const nonProfileDifferences = pngProof.metadataDifferences.filter(
        (key) => !["iccSha256", "exifSha256", "xmpSha256"].includes(key),
      );
      if (!pngProof.exactRgba || nonProfileDifferences.length)
        throw Error("Intermediate PNG changed RGBA or non-profile semantics");
      await fs.writeFile(inputFile, png);
      const args = [...avifencOptions];
      for (const [key, flag] of [
        ["icc", "--icc"],
        ["exif", "--exif"],
        ["xmp", "--xmp"],
      ])
        if (m[key]) {
          const metadataFile = `${stem}.${key}`;
          await fs.writeFile(metadataFile, m[key]);
          args.push(flag, metadataFile);
        }
      const started = performance.now();
      const command = await runFile(avifenc, [...args, inputFile, outputFile], {
        timeout: 300000,
        maxBuffer: 4 * 1024 * 1024,
      });
      const output = await fs.readFile(outputFile);
      const record = {
        encoder: "avifenc-identity-s6",
        ...(await candidateRecord(
          before,
          bytes.length,
          output,
          avifencOptions,
          started,
        )),
        candidateFile: outputFile,
        intermediatePngRgbaExact: pngProof.exactRgba,
        encoderWarnings: command.stderr.trim() || null,
      };
      row.candidates.push(record);
    } catch (error) {
      row.candidates.push({
        encoder: "avifenc-identity-s6",
        options: avifencOptions,
        accepted: false,
        rejection: error.message,
      });
    } finally {
      await fs.rm(inputFile, { force: true });
    }
  }
  const accepted = row.candidates
    .filter((candidate) => candidate.accepted)
    .sort((a, b) => a.bytes - b.bytes);
  const smaller = accepted.filter((candidate) => candidate.smaller);
  row.decision = smaller.length
    ? "Smaller AVIF with exact full RGBA and metadata semantics; browser verification still required; original untouched"
    : accepted.length
      ? "Exact AVIF is larger; keep original"
      : "No AVIF candidate meets exact full RGBA and metadata semantics; keep original";
  row.bestExactCandidate = accepted[0]?.encoder ?? null;
  row.bestExactBytes = accepted[0]?.bytes ?? null;
  row.savedBytesIfSelected = smaller[0] ? bytes.length - smaller[0].bytes : 0;
  const sourceAfter = await fs.readFile(file);
  if (sha256(sourceAfter) !== row.sourceSha256)
    throw Error(`Source changed during AVIF audit: ${file}`);
  return row;
}

export async function runAvifAudit({
  directory = "public",
  output = path.join(os.tmpdir(), "arena-avif-audit.json"),
  candidateDirectory,
  workers = 1,
  fallback = "auto",
  limit,
} = {}) {
  if (!["auto", "none", "all"].includes(fallback))
    throw Error("fallback must be auto, none or all");
  candidateDirectory ??= await fs.mkdtemp(
    path.join(os.tmpdir(), "arena-lossless-avif-"),
  );
  let avifenc = null,
    avifencVersion = null;
  try {
    const v = await runFile("avifenc", ["--version"]);
    avifenc = "avifenc";
    avifencVersion = v.stdout.trim();
  } catch {
    /* Sharp audit remains available. */
  }
  const allFiles = await imageFiles(directory),
    files = limit ? allFiles.slice(0, limit) : allFiles;
  const checkpointPolicy = sha256(
    Buffer.from(
      JSON.stringify({
        schema: 2,
        node: process.version,
        sharp: sharp.versions,
        fallback,
        avifencVersion,
        sharpOptions,
        avifencOptions,
        implementation: sha256(
          await fs.readFile(fileURLToPath(import.meta.url)),
        ),
        inventoryImplementation: sha256(
          await fs.readFile(
            new URL("./audit-lossless-assets.mjs", import.meta.url),
          ),
        ),
      }),
    ),
  );
  const rows = new Array(files.length),
    started = performance.now();
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
  sharp.cache({ memory: 32, items: 16, files: 0 });
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < files.length) {
        const i = cursor++;
        const file = files[i],
          cached = checkpoint.get(file);
        let reusable = Boolean(
          cached &&
          cached.checkpointPolicy === checkpointPolicy &&
          cached.sourceSha256 === sha256(await fs.readFile(file)),
        );
        if (reusable)
          for (const candidate of cached.candidates ?? []) {
            if (candidate.candidateFile) {
              try {
                if (
                  sha256(await fs.readFile(candidate.candidateFile)) !==
                  candidate.sha256
                )
                  reusable = false;
              } catch {
                reusable = false;
              }
            }
          }
        rows[i] = reusable
          ? cached
          : await auditOne(file, { candidateDirectory, fallback, avifenc });
        rows[i].checkpointPolicy = checkpointPolicy;
        await fs.appendFile(
          output + ".progress.jsonl",
          JSON.stringify(rows[i]) + "\n",
        );
        complete++;
        console.log(
          `AVIF ${complete}/${files.length}: ${rows[i].file} — ${rows[i].decision}`,
        );
      }
    }),
  );
  const exact = rows.filter(
    (row) => row.bestExactBytes !== null && row.bestExactBytes !== undefined,
  );
  const report = {
    schema: 1,
    checkpointPolicy,
    createdAtUtc: new Date().toISOString(),
    complete: !limit || files.length === allFiles.length,
    scope:
      "Every shipped source PNG/WebP/AVIF in public, excluding generated assets/optimized derivatives. Original source files are never modified. Existing lossy inputs are compared against their current decoded pixels, not against an unavailable earlier master.",
    policy:
      "No resize, chroma subsampling, near-lossless encoding, quantization, bit-depth reduction, alpha premultiplication, or invisible-RGB changes. AVIF accepted only with identical full straight decoded RGBA and equivalent dimensions/color-profile/orientation/animation semantics. Candidate selection and browser decoding are separate approvals.",
    method:
      "Sharp lossless AVIF, 4:4:4, 8 bit, effort4 for every image. If exact comparison fails, installed avifenc lossless identity/GBR CICP1/13/0 full-range 4:4:4 speed6 jobs1 is tested via independently exact PNG transport. Single-image pages/pageHeight shape is normalized semantically.",
    sources: [
      "https://sharp.pixelplumbing.com/api-output/#avif",
      "https://sharp.pixelplumbing.com/api-input/",
      "https://github.com/AOMediaCodec/libavif/wiki/CICP",
      "https://github.com/AOMediaCodec/libavif/blob/main/apps/avifenc.c",
    ],
    tools: {
      node: process.version,
      sharp: sharp.versions,
      avifenc: avifencVersion,
    },
    options: {
      directory,
      workers,
      fallback,
      limit: limit ?? null,
      sharpOptions,
      avifencOptions,
    },
    candidateDirectory,
    seconds: rounded((performance.now() - started) / 1000),
    summary: {
      files: rows.length,
      expectedFiles: allFiles.length,
      originalBytes: rows.reduce((n, r) => n + r.originalBytes, 0),
      exactAvifImages: exact.length,
      noExactAvifImages: rows.length - exact.length,
      smallerExactAvifImages: rows.filter((row) => row.savedBytesIfSelected > 0)
        .length,
      exactAvifBytes: exact.reduce((n, r) => n + r.bestExactBytes, 0),
      savedBytesIfSelected: rows.reduce(
        (n, r) => n + (r.savedBytesIfSelected ?? 0),
        0,
      ),
      sourceFilesUnchangedDuringEachAudit: true,
      publishedCandidates: 0,
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
      const at = arg.indexOf("=");
      if (!arg.startsWith("--") || at < 0)
        throw Error("Use --name=value options");
      return [arg.slice(2, at), arg.slice(at + 1)];
    }),
  );
  for (const key of Object.keys(args))
    if (
      ![
        "directory",
        "output",
        "candidate-directory",
        "workers",
        "fallback",
        "limit",
      ].includes(key)
    )
      throw Error(`Unknown option: ${key}`);
  const workers = Number(args.workers ?? 1),
    limit = args.limit === undefined ? undefined : Number(args.limit);
  if (!Number.isInteger(workers) || workers < 1 || workers > 4)
    throw Error("workers must be1..4");
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
    throw Error("limit must be a positive integer");
  await runAvifAudit({
    directory: args.directory,
    output: args.output,
    candidateDirectory: args["candidate-directory"],
    workers,
    fallback: args.fallback,
    limit,
  });
}
