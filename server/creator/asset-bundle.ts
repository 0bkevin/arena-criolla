import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CharacterInputSchema } from "./input";
import { DesignSchema } from "./provider";

export const AssetBundleSchema = z.object({
  version: z.literal(1),
  generator: z.literal("codex-chatgpt"),
  id: z.string().regex(/^custom_[a-f0-9]{32}$/),
  input: CharacterInputSchema,
  design: DesignSchema,
  source: z.literal("generated.png"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AssetBundle = z.infer<typeof AssetBundleSchema>;
export const sha256 = (source: Buffer) =>
  createHash("sha256").update(source).digest("hex");

export function isInside(parent: string, target: string) {
  const relative = path.relative(parent, target);
  return (
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative)
  );
}

export async function readLimited(file: string, maxBytes: number) {
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxBytes)
      throw new Error(`Invalid or oversized file: ${path.basename(file)}`);
    // Read through the checked descriptor, with a hard allocation/read bound
    // even if another process grows or replaces the pathname during the read.
    const chunks: Buffer[] = [];
    let length = 0;
    while (length <= maxBytes) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - length));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (!bytesRead) return Buffer.concat(chunks, length);
      chunks.push(chunk.subarray(0, bytesRead));
      length += bytesRead;
    }
    throw new Error("File exceeded the size limit.");
  } finally {
    await handle.close();
  }
}

export const openDirectory = (directory: string) =>
  open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );

// Pin directory authority while inspecting/packing local operator files. Opening
// children through the descriptor prevents a renamed parent or symlink swap
// from redirecting subsequent reads, writes or cleanup to another directory.
export const directoryPath = (handle: FileHandle) =>
  `${process.platform === "linux" ? "/proc/self/fd" : "/dev/fd"}/${handle.fd}`;

export async function readAssetBundle(folder: string) {
  const directory = await openDirectory(path.resolve(folder));
  try {
    const root = directoryPath(directory);
    const bundle = AssetBundleSchema.parse(
      JSON.parse(
        (await readLimited(path.join(root, "manifest.json"), 32_768)).toString(
          "utf8",
        ),
      ),
    );
    const source = await readLimited(
      path.join(root, "generated.png"),
      32 * 1024 * 1024,
    );
    if (sha256(source) !== bundle.sha256)
      throw new Error("Generated image checksum does not match the bundle.");
    return { bundle, source };
  } finally {
    await directory.close();
  }
}
