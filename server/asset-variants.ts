import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";

export interface LosslessAssetVariant {
  file: string;
  sha256: string;
  bytes: number;
  contentType: "image/webp" | "image/png" | "image/avif";
}
export interface LosslessAssetEntry {
  source: string;
  sourceSha256: string;
  variants: LosslessAssetVariant[];
}
export interface LosslessAssetManifest {
  schema: number;
  assets: Record<string, LosslessAssetEntry>;
}
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Preserve source URLs and art provenance while serving verified smaller bytes. */
export function losslessAssetDelivery(
  root: string,
  manifest: LosslessAssetManifest,
): RequestHandler {
  const base = path.resolve(root);
  const verified = new Map<
    string,
    { signature: string; valid: Promise<boolean> }
  >();
  const safeFile = (file: string) => {
    const resolved = path.resolve(base, file);
    return resolved.startsWith(base + path.sep) ? resolved : undefined;
  };
  const unchanged = async (
    entry: LosslessAssetEntry,
    variant: LosslessAssetVariant,
  ) => {
    const source = safeFile(entry.source),
      candidate = safeFile(variant.file);
    if (!source || !candidate) return false;
    try {
      const stats = await Promise.all([stat(source), stat(candidate)]);
      if (
        stats.some((s) => !s.isFile()) ||
        stats[1].size !== variant.bytes ||
        stats[1].size >= stats[0].size
      )
        return false;
      const signature = stats
        .map((s) => `${s.size}:${s.mtimeMs}:${s.ctimeMs}`)
        .join("/");
      let cached = verified.get(candidate);
      if (!cached || cached.signature !== signature) {
        const valid = Promise.all([readFile(source), readFile(candidate)])
          .then(
            ([a, b]) =>
              digest(a) === entry.sourceSha256 && digest(b) === variant.sha256,
          )
          .catch(() => false);
        cached = { signature, valid };
        verified.set(candidate, cached);
      }
      return await cached.valid;
    } catch {
      return false;
    }
  };
  return async (req, res, next) => {
    const name = req.params.file;
    if (
      manifest.schema !== 1 ||
      typeof name !== "string" ||
      !Object.hasOwn(manifest.assets, name)
    )
      return next();
    const entry = manifest.assets[name];
    if (entry.source !== `assets/${name}`) return next();
    const originalType = name.endsWith(".avif")
      ? "image/avif"
      : name.endsWith(".png")
        ? "image/png"
        : "image/webp";
    const explicitAvif = req.accepts().includes("image/avif");
    if (
      entry.variants.some((v) => v.contentType === "image/avif") &&
      originalType !== "image/avif"
    )
      res.vary("Accept");
    const candidates = entry.variants
      .filter(
        (v) =>
          v.contentType === originalType ||
          (v.contentType === "image/avif" && explicitAvif),
      )
      .sort((a, b) => a.bytes - b.bytes);
    for (const variant of candidates) {
      if (!(await unchanged(entry, variant))) continue;
      const file = safeFile(variant.file)!;
      if (!res.hasHeader("Cache-Control"))
        res.set("Cache-Control", "public, max-age=0, must-revalidate");
      res.sendFile(file, (error) => {
        if (!error) return;
        if (
          !res.headersSent &&
          ["ENOENT", "ENOTDIR"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          next();
        else next(error);
      });
      return;
    }
    next();
  };
}
