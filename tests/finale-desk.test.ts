import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  packGiuseppeDesk,
  prepareGiuseppeDesk,
} from "../scripts/prepare-giuseppe-desk";

const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
async function sourceFixture(
  options: {
    extraAlpha?: number;
    clipped?: boolean;
    largeNoise?: boolean;
  } = {},
) {
  const width = 256,
    height = 192,
    rgba = Buffer.alloc(width * height * 4);
  const pixel = (x: number, y: number, alpha = 255) => {
    const at = (y * width + x) * 4;
    rgba[at] = (x * 7) % 256;
    rgba[at + 1] = (y * 11) % 256;
    rgba[at + 2] = (x + y) % 256;
    rgba[at + 3] = alpha;
  };
  for (let y = 30; y < 100; y++) for (let x = 40; x < 200; x++) pixel(x, y);
  for (let y = 20; y < 30; y++) for (let x = 70; x < 140; x++) pixel(x, y);
  for (let y = 100; y < 160; y++)
    for (const left of [45, 182])
      for (let x = left; x < left + 10; x++) pixel(x, y);
  pixel(39, 31, 1);
  pixel(70, 19, 1);
  pixel(69, 20, 12);
  pixel(60, 101, 2);
  pixel(5, 5, options.extraAlpha ?? 1);
  pixel(249, 184, 1);
  pixel(250, 184, 1);
  if (options.clipped) for (let x = 0; x <= 40; x++) pixel(x, 35);
  if (options.largeNoise)
    for (let y = 170; y < 190; y++) for (let x = 5; x < 25; x++) pixel(x, y, 1);
  return {
    png: await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
    rgba,
    width,
    height,
  };
}

test("desk packing preserves the complete object, faint attached edges and colors without rescaling", async () => {
  const source = await sourceFixture();
  const original = Buffer.from(source.png);
  const result = await packGiuseppeDesk(source.png);
  const packed = await sharp(result.png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual(result.audit.sourceBounds, {
    x: 39,
    y: 19,
    width: 161,
    height: 141,
  });
  assert.deepEqual(result.manifest.frame, {
    x: 16,
    y: 16,
    width: 161,
    height: 141,
  });
  assert.equal(packed.info.width, 193);
  assert.equal(packed.info.height, 173);
  for (let y = 0; y < packed.info.height; y++)
    for (let x = 0; x < packed.info.width; x++) {
      const expected =
        x >= 16 && x < 177 && y >= 16 && y < 157
          ? source.rgba.subarray(
              ((y - 16 + 19) * source.width + x - 16 + 39) * 4,
              ((y - 16 + 19) * source.width + x - 16 + 39) * 4 + 4,
            )
          : Buffer.alloc(4);
      assert.deepEqual(
        packed.data.subarray(
          (y * packed.info.width + x) * 4,
          (y * packed.info.width + x) * 4 + 4,
        ),
        expected,
      );
    }
  assert.deepEqual(
    await sharp(result.webp).ensureAlpha().raw().toBuffer(),
    packed.data,
  );
  assert.deepEqual(result.audit.discardedNoise, {
    components: 2,
    pixels: 3,
    maxAlpha: 1,
  });
  assert.deepEqual(result.audit.preservedAntialiasSatellites, [
    { x: 60, y: 101, pixels: 1, maxAlpha: 2 },
  ]);
  assert.equal(result.audit.rgbaSha256, hash(packed.data));
  assert.deepEqual(source.png, original);
});

test("desk packing rejects visible detached fragments, clipped furniture and substantial faint background patches", async () => {
  await assert.rejects(
    packGiuseppeDesk((await sourceFixture({ extraAlpha: 2 })).png),
    /only small disconnected alpha-1 noise/,
  );
  await assert.rejects(
    packGiuseppeDesk((await sourceFixture({ clipped: true })).png),
    /clipped/,
  );
  await assert.rejects(
    packGiuseppeDesk((await sourceFixture({ largeNoise: true })).png),
    /only small disconnected alpha-1 noise/,
  );
  const opaque = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(packGiuseppeDesk(opaque), /transparent PNG/);
});

test("desk preparation keeps the generated original unchanged and writes repeatable audited runtime files", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "arena-giuseppe-desk-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = (await sourceFixture()).png;
  const original = path.join(
    root,
    "assets/source/finales/finales-giuseppe-desk-v2-generated.png",
  );
  await mkdir(path.dirname(original), { recursive: true });
  await writeFile(original, source);
  const first = await prepareGiuseppeDesk(root);
  const runtime = path.join(
    root,
    "public/assets/finales-giuseppe-desk-v2.webp",
  );
  const changedAt = (await stat(runtime)).mtimeMs;
  const second = await prepareGiuseppeDesk(root);
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(
    (await stat(runtime)).mtimeMs,
    changedAt,
    "unchanged assets are not rewritten",
  );
  assert.deepEqual(await readFile(original), source);
  const manifest = JSON.parse(
    await readFile(path.join(root, "shared/finale-desk-assets.json"), "utf8"),
  );
  const audit = JSON.parse(
    await readFile(
      path.join(root, "docs/finales/giuseppe-desk-v2.json"),
      "utf8",
    ),
  );
  assert.deepEqual(manifest, first.manifest);
  assert.equal(audit.sourceSha256, hash(source));
  assert.equal(audit.sha256, hash(await readFile(runtime)));
});

test("the published Giuseppe desk uses complete tight artwork with exact PNG/WebP pixels", async () => {
  const manifest = JSON.parse(
    await readFile("shared/finale-desk-assets.json", "utf8"),
  );
  const audit = JSON.parse(
    await readFile("docs/finales/giuseppe-desk-v2.json", "utf8"),
  );
  const [raw, png, webp] = await Promise.all([
    readFile(audit.source),
    readFile(audit.normalized),
    readFile(audit.destination),
  ]);
  assert.equal(manifest.file, "finales-giuseppe-desk-v2");
  assert.deepEqual(manifest.frame, audit.frame);
  assert.equal(hash(raw), audit.sourceSha256);
  assert.equal(hash(png), audit.normalizedSha256);
  assert.equal(hash(webp), audit.sha256);
  const source = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual(
    await sharp(webp).ensureAlpha().raw().toBuffer(),
    source.data,
  );
  assert.equal(hash(source.data), audit.rgbaSha256);
  let minX = source.info.width,
    minY = source.info.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < source.info.height; y++)
    for (let x = 0; x < source.info.width; x++) {
      if (!source.data[(y * source.info.width + x) * 4 + 3]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  assert.deepEqual(manifest.frame, {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  });
  assert.ok(
    minX >= 16 &&
      minY >= 16 &&
      maxX < source.info.width - 16 &&
      maxY < source.info.height - 16,
  );
  assert.equal(manifest.frame.width, audit.sourceBounds.width);
  assert.equal(manifest.frame.height, audit.sourceBounds.height);
  const repacked = await packGiuseppeDesk(raw);
  assert.deepEqual(repacked.png, png);
  assert.deepEqual(repacked.webp, webp);
});
