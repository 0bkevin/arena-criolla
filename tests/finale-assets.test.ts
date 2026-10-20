import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import {
  FINALES,
  FINALE_ASSET_GROUPS,
  CANONICAL_FINALE_FIGHTERS,
  finaleAsset,
} from "../shared/finales";

test("all 46 authored final attacks have their own unique generated prop cell and scene", async () => {
  const report = JSON.parse(await readFile("docs/finales/assets.json", "utf8"));
  const expected = new Set<string>(FINALE_ASSET_GROUPS.flat());
  const roster = BUILT_IN_FIGHTERS.map(({ id }) => id).sort();
  assert.deepEqual(Object.keys(FINALES).sort(), roster);
  assert.deepEqual([...expected, ...CANONICAL_FINALE_FIGHTERS].sort(), roster);
  for (const id of CANONICAL_FINALE_FIGHTERS)
    assert.equal(finaleAsset(id), undefined);
  const cells = new Set<string>();
  assert.equal(Object.keys(FINALES).length, roster.length);
  assert.equal(
    new Set(Object.values(FINALES).map((finale) => finale.title)).size,
    roster.length,
  );
  for (const [group, fighters] of FINALE_ASSET_GROUPS.entries()) {
    const file = `public/assets/finales-v1-${group + 1}.webp`;
    const buffer = await readFile(file);
    assert.equal(
      createHash("sha256").update(buffer).digest("hex"),
      report.assets[group].sha256,
    );
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width % 4, 0);
    assert.equal(info.height % 2, 0);
    const cellWidth = info.width / 4;
    const cellHeight = info.height / 2;
    for (const [index, id] of fighters.entries()) {
      assert.ok(expected.delete(id), `${id}: unique built-in fighter`);
      const asset = finaleAsset(id)!;
      const key = `${asset.file}:${asset.column}:${asset.row}`;
      assert.ok(!cells.has(key), `${id}: unique artwork`);
      cells.add(key);
      let visible = 0;
      let transparent = 0;
      for (let y = 0; y < cellHeight; y++)
        for (let x = 0; x < cellWidth; x++) {
          const alpha =
            data[
              ((Math.floor(index / 4) * cellHeight + y) * info.width +
                (index % 4) * cellWidth +
                x) *
                4 +
                3
            ];
          if (alpha > 128) visible++;
          if (alpha < 16) transparent++;
        }
      assert.ok(
        visible > cellWidth * cellHeight * 0.025,
        `${id}: prop actually present`,
      );
      assert.ok(
        transparent > cellWidth * cellHeight * 0.04,
        `${id}: true transparent background`,
      );
    }
  }
  assert.equal(cells.size, 46);
  assert.equal(expected.size, 0);
});

test("cafe furniture keeps four complete source objects and exact PNG/WebP pixels", async () => {
  const report = JSON.parse(
    await readFile("docs/finales/cafe-furniture.json", "utf8"),
  );
  const manifest = JSON.parse(
    await readFile("shared/finale-cafe-assets.json", "utf8"),
  );
  const [source, normalized, webp] = await Promise.all([
    readFile(report.source),
    readFile(report.normalized),
    readFile(report.destination),
  ]);
  const hash = (bytes: Buffer) =>
    createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(source), report.sourceSha256, "raw source stays untouched");
  assert.equal(hash(normalized), report.normalizedSha256);
  assert.equal(hash(webp), report.sha256);
  assert.deepEqual(Object.keys(manifest.frames), [
    "leftChair",
    "rightChair",
    "table",
    "cup",
  ]);
  assert.deepEqual(manifest.frames, report.frames);
  const [input, packed, runtime] = await Promise.all(
    [source, normalized, webp].map((bytes) =>
      sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ),
  );
  assert.equal(packed.info.width, report.width);
  assert.equal(packed.info.height, report.height);
  assert.deepEqual(runtime.info, packed.info);
  assert.ok(runtime.data.equals(packed.data), "all RGBA and alpha edges match");
  assert.equal(hash(packed.data), report.rgbaSha256);
  const alpha = Buffer.alloc(report.width * report.height);
  for (let index = 0; index < alpha.length; index++)
    alpha[index] = packed.data[index * 4 + 3];
  assert.equal(hash(alpha), report.alphaSha256);

  // Rebuild the output from complete nonzero-alpha source components rather
  // than trusting the reported crops. Isolated alpha-1 noise is the only loss.
  const visited = new Uint8Array(input.info.width * input.info.height);
  const expected = Buffer.alloc(packed.data.length);
  const queue = new Int32Array(visited.length);
  const found = new Set<string>();
  let discardedPixels = 0;
  let discardedComponents = 0;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || !input.data[start * 4 + 3]) continue;
    let head = 0;
    let tail = 1;
    let maxAlpha = 0;
    let minX = input.info.width;
    let minY = input.info.height;
    let maxX = -1;
    let maxY = -1;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % input.info.width;
      const y = Math.floor(pixel / input.info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxAlpha = Math.max(maxAlpha, input.data[pixel * 4 + 3]);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= input.info.width ||
            ny >= input.info.height
          )
            continue;
          const next = ny * input.info.width + nx;
          if (visited[next] || !input.data[next * 4 + 3]) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (maxAlpha === 1) {
      discardedComponents++;
      discardedPixels += tail;
      continue;
    }
    const object = report.objects.find(
      (entry: { sourceBounds: { x: number; y: number } }) =>
        entry.sourceBounds.x === minX && entry.sourceBounds.y === minY,
    );
    assert.ok(object, "every visible source component has one output frame");
    assert.ok(!found.has(object.name), "objects remain separate");
    found.add(object.name);
    const frame = manifest.frames[object.name];
    assert.equal(frame.width, maxX - minX + 1);
    assert.equal(frame.height, maxY - minY + 1);
    assert.equal(object.pixels, tail);
    const column = frame.x < report.cellSize ? 0 : 1;
    const row = frame.y < report.cellSize ? 0 : 1;
    assert.ok(frame.x - column * report.cellSize >= 16);
    assert.ok(frame.y - row * report.cellSize >= 16);
    assert.ok((column + 1) * report.cellSize - frame.x - frame.width >= 16);
    assert.ok((row + 1) * report.cellSize - frame.y - frame.height >= 16);
    for (let index = 0; index < tail; index++) {
      const pixel = queue[index];
      const x = frame.x + (pixel % input.info.width) - minX;
      const y = frame.y + Math.floor(pixel / input.info.width) - minY;
      input.data.copy(
        expected,
        (y * report.width + x) * 4,
        pixel * 4,
        pixel * 4 + 4,
      );
    }
  }
  assert.equal(found.size, 4);
  assert.equal(discardedPixels, report.discardedNoise.pixels);
  assert.equal(discardedComponents, report.discardedNoise.components);
  assert.equal(report.discardedNoise.maxAlpha, 1);
  assert.ok(
    expected.equals(packed.data),
    "no object pixel is cut or repainted",
  );
});
