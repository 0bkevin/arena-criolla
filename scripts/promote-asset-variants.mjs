import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  decodedImage,
  assertIdenticalImage,
} from "./audit-lossless-assets.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Move verified same-format variants into the original URL so each image is
 * stored once. Pixels and metadata are rechecked immediately before the swap.
 * AVIF (or any cross-format) variants stay in the manifest for negotiation.
 */
export async function promoteAssetVariants(
  manifestFile = "shared/asset-variants.json",
  { dryRun = false } = {},
) {
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  const publicRoot = path.resolve("public");
  const resolve = (file) => {
    const resolved = path.resolve(publicRoot, file);
    if (!resolved.startsWith(publicRoot + path.sep))
      throw Error(`Path escapes public/: ${file}`);
    return resolved;
  };
  const sameFormat = (name, type) =>
    type ===
    (name.endsWith(".avif")
      ? "image/avif"
      : name.endsWith(".png")
        ? "image/png"
        : "image/webp");
  const promoted = [],
    removable = new Set();
  let savedBytes = 0;
  for (const [name, entry] of Object.entries(manifest.assets)) {
    if (entry.source !== `assets/${name}`)
      throw Error(`Unexpected source for ${name}`);
    const source = resolve(entry.source);
    const original = await fs.readFile(source);
    if (digest(original) !== entry.sourceSha256)
      throw Error(`Source changed since the variant was verified: ${name}`);
    const candidates = entry.variants.filter((v) =>
      sameFormat(name, v.contentType),
    );
    const best = candidates.sort((a, b) => a.bytes - b.bytes)[0];
    if (!best || best.bytes >= original.length) continue;
    const variantFile = resolve(best.file);
    const replacement = await fs.readFile(variantFile);
    if (digest(replacement) !== best.sha256)
      throw Error(`Variant changed: ${best.file}`);
    assertIdenticalImage(
      await decodedImage(original),
      await decodedImage(replacement),
    );
    if (!dryRun) {
      const temporary = `${source}.${process.pid}.promote`;
      try {
        await fs.writeFile(temporary, replacement, {
          mode: (await fs.stat(source)).mode & 0o777,
        });
        await fs.rename(temporary, source);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    savedBytes += original.length - replacement.length;
    promoted.push(name);
    removable.add(variantFile);
    entry.variants = entry.variants.filter((v) => v !== best);
    entry.sourceSha256 = digest(replacement);
  }
  // Drop entries without any remaining cross-format variant, then delete the
  // now-duplicate files nothing else references.
  for (const name of promoted)
    if (!manifest.assets[name].variants.length) delete manifest.assets[name];
  const stillUsed = new Set(
    Object.values(manifest.assets).flatMap((entry) =>
      entry.variants.map((v) => resolve(v.file)),
    ),
  );
  if (!dryRun) {
    for (const file of removable) if (!stillUsed.has(file)) await fs.rm(file);
    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  }
  return { promoted: promoted.length, savedBytes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(
    JSON.stringify(
      await promoteAssetVariants(undefined, {
        dryRun: process.argv.includes("--dry-run"),
      }),
    ),
  );
}
