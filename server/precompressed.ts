import { stat } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";

const ENCODINGS = [
  { name: "br", extension: ".br" },
  { name: "gzip", extension: ".gz" },
] as const;
const COMPRESSIBLE = /\.(?:js|mjs|css|svg|json|webmanifest)$/i;

/**
 * Serve `file.br` / `file.gz` written at build time in place of text assets.
 * The request is rewritten to the compressed file, so express.static keeps its
 * ETag, range and conditional-request handling. Images and fonts are already
 * compressed and are never touched.
 */
export function precompressedAssets(root: string): RequestHandler {
  const base = path.resolve(root);
  const exists = new Map<string, Promise<boolean>>();
  const has = (file: string) => {
    let known = exists.get(file);
    if (!known) {
      known = stat(file).then(
        (stats) => stats.isFile(),
        () => false,
      );
      exists.set(file, known);
    }
    return known;
  };
  return async (req, res, next) => {
    if (
      (req.method !== "GET" && req.method !== "HEAD") ||
      !COMPRESSIBLE.test(req.path)
    )
      return next();
    try {
      const requested = path.resolve(base, "." + decodeURIComponent(req.path));
      if (!requested.startsWith(base + path.sep)) return next();
      // The compressed variant changes the body for the same URL.
      res.vary("Accept-Encoding");
      // Browsers list gzip before br at equal weight, so rank by size here.
      let encoding: (typeof ENCODINGS)[number] | undefined;
      for (const candidate of ENCODINGS) {
        if (
          req.acceptsEncodings(candidate.name) &&
          (await has(requested + candidate.extension))
        ) {
          encoding = candidate;
          break;
        }
      }
      if (!encoding) return next();
      res.type(path.extname(req.path));
      res.set("Content-Encoding", encoding.name);
      const query = req.url.indexOf("?");
      req.url =
        req.path +
        encoding.extension +
        (query === -1 ? "" : req.url.slice(query));
      next();
    } catch {
      next();
    }
  };
}
