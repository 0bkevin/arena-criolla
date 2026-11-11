// Build the opening clash cutouts (Renny's and Capriles' punch, atlas frame 5).
//
// The atlases only hold ~400 px poses, while the loading screen draws each
// fighter up to ~500 CSS px wide: on a 2x or 3x screen that was a 2.5x upscale
// and looked pixelated. No larger art exists, so the 2x cutout is made offline
// with Real-ESRGAN's illustration model (4x, then Lanczos down to 2x). Colour
// and alpha are upscaled separately: transparent pixels are flattened onto the
// outline colour so the model never invents a halo around the silhouette.
// The 1x cutout keeps the atlas pixels untouched.
//
// Usage: npx tsx scripts/assets/prepare-entrance-art.ts --realesrgan <binary>
// <binary> is realesrgan-ncnn-vulkan, with its models/ folder next to it:
// https://github.com/xinntao/Real-ESRGAN/releases (v0.2.5.0).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import atlasManifest from "../../src/game/assets/manifests/sprite-geometry.json";
import type { EntranceArt } from "../../src/components/entrance/entrance-art";

const MANIFEST = "src/components/entrance/entrance-images.json";
const FIGHTERS = ["renny", "capriles"] as const;
const PUNCH_FRAME = 5;
const OUTLINE = "#1b1b1d";

const flag = process.argv.indexOf("--realesrgan");
const binary = flag >= 0 ? process.argv[flag + 1] : undefined;
if (!binary)
  throw new Error("Pass --realesrgan <path to realesrgan-ncnn-vulkan>");
const models = path.join(path.dirname(binary), "models");

const work = await mkdtemp(path.join(tmpdir(), "entrance-art-"));
const previous = JSON.parse(await readFile(MANIFEST, "utf8")) as Record<
  string,
  EntranceArt
>;
const manifest: Record<string, EntranceArt> = {};

async function upscale4x(input: Buffer, name: string) {
  const source = path.join(work, `${name}.png`);
  const output = path.join(work, `${name}-x4.png`);
  await writeFile(source, input);
  execFileSync(binary!, [
    ...["-i", source, "-o", output],
    ...["-n", "realesrgan-x4plus-anime", "-m", models],
  ]);
  return output;
}

async function encode(id: string, rgba: Sharp) {
  const urls = { avif: "", webp: "" };
  for (const format of ["avif", "webp"] as const) {
    const bytes = await (
      format === "avif"
        ? rgba
            .clone()
            .avif({ quality: 72, effort: 9, chromaSubsampling: "4:4:4" })
        : rgba.clone().webp({
            quality: 88,
            alphaQuality: 100,
            effort: 6,
            smartSubsample: true,
          })
    ).toBuffer();
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const file = `entrance-${id}-${hash}.${format}`;
    await writeFile(`public/assets/${file}`, bytes);
    urls[format] = `/assets/${file}`;
  }
  return urls;
}

try {
  for (const id of FIGHTERS) {
    const sheet = atlasManifest.sprites.find((sprite) => sprite.id === id)
      ?.files[0];
    const frame = sheet?.components[PUNCH_FRAME];
    if (!sheet || !frame) throw new Error(`Missing atlas geometry for ${id}`);
    const width = frame.maxX - frame.minX + 1;
    const height = frame.maxY - frame.minY + 1;
    const crop = await sharp(sheet.file)
      .extract({ left: frame.minX, top: frame.minY, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = () => sharp(crop.data, { raw: crop.info });

    const [colour, alpha] = await Promise.all([
      upscale4x(
        await pixels().flatten({ background: OUTLINE }).png().toBuffer(),
        `${id}-colour`,
      ),
      upscale4x(
        await pixels().extractChannel(3).toColourspace("srgb").png().toBuffer(),
        `${id}-alpha`,
      ),
    ]);
    const size = {
      width: width * 2,
      height: height * 2,
      kernel: sharp.kernel.lanczos3,
    };
    const doubled = sharp(
      await sharp(colour).removeAlpha().resize(size).toBuffer(),
    ).joinChannel(await sharp(alpha).extractChannel(0).resize(size).toBuffer());

    const x1 = await encode(id, pixels());
    const x2 = await encode(id, sharp(await doubled.png().toBuffer()));
    manifest[id] = {
      width,
      height,
      avif: [x1.avif, x2.avif],
      webp: [x1.webp, x2.webp],
    };
  }

  // Retire cutouts no longer referenced so public/ only ships live art.
  const live = new Set(
    Object.values(manifest).flatMap((art) => [...art.avif, ...art.webp]),
  );
  const stale = Object.values(previous)
    .flatMap((art) => [art.avif, art.webp].flat())
    .filter((url) => !live.has(url));
  await Promise.all(stale.map((url) => unlink(`public${url}`).catch(() => {})));
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await rm(work, { recursive: true, force: true });
}
