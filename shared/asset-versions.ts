import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import variants from "./asset-variants.json";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const cache = new Map<string, { signature: string; hash: string }>();

async function fileHash(file: string): Promise<string> {
  try {
    const info = await stat(file);
    if (!info.isFile()) return "missing";
    const signature = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
    const cached = cache.get(file);
    if (cached?.signature === signature) return cached.hash;
    const hash = sha(await readFile(file));
    cache.set(file, { signature, hash });
    return hash;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

export async function assetVersion(
  root: string,
  url: string,
): Promise<string | undefined> {
  if (
    !/^\/(assets|fonts|audio)\//.test(url) ||
    url.includes("..") ||
    url.includes("\\")
  )
    return;
  const file = url.slice(1);
  const source = await fileHash(path.join(root, file));
  if (source === "missing") return;
  const name = file.startsWith("assets/") ? file.slice(7) : "";
  const entry = (
    variants.assets as Record<
      string,
      { source: string; variants: { file: string }[] }
    >
  )[name];
  const related =
    entry?.source === file ? entry.variants.map((v) => v.file) : [];
  if (file === "assets/caracas.webp") related.push("assets/caracas.avif");
  const hashes = await Promise.all(
    [...new Set(related)]
      .sort()
      .map(async (item) => [item, await fileHash(path.join(root, item))]),
  );
  return sha(JSON.stringify([file, source, hashes])).slice(0, 16);
}

export async function assetVersions(
  root: string,
): Promise<Record<string, string>> {
  const paths: string[] = [];
  for (const dir of ["assets", "fonts", "audio"]) {
    for (const file of await readdir(path.join(root, dir), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!file.isFile()) continue;
      const relative = path
        .relative(root, path.join(file.parentPath, file.name))
        .split(path.sep)
        .join("/");
      if (/\.(?:br|gz)$/.test(relative)) continue;
      paths.push(`/${relative}`);
    }
  }
  paths.sort();
  const versions = await Promise.all(
    paths.map((url) => assetVersion(root, url)),
  );
  return Object.fromEntries(paths.map((url, i) => [url, versions[i]!]));
}
