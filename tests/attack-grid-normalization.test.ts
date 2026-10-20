import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  normalizeAttackGrid,
  normalizeAttackGridFile,
  type AttackGridNormalizationAudit,
} from "../scripts/normalize-attack-grid";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const grid = { columns: 2, rows: 1, poseCount: 2 };
type Color = readonly [number, number, number, number];
const red: Color = [191, 52, 38, 255];
const blue: Color = [29, 79, 181, 255];

function rectangle(
  pixels: Buffer,
  imageWidth: number,
  left: number,
  top: number,
  width: number,
  height: number,
  color: Color,
) {
  for (let y = top; y < top + height; y++)
    for (let x = left; x < left + width; x++)
      pixels.set(color, (y * imageWidth + x) * 4);
}

function png(pixels: Buffer, width = 320, height = 200) {
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

function completeSource() {
  const pixels = Buffer.alloc(320 * 200 * 4);
  rectangle(pixels, 320, 30, 35, 150, 24, red);
  rectangle(pixels, 320, 215, 110, 50, 50, blue);
  return pixels;
}

/** Reverse the published translations, independently of the normalizer's labels. */
async function reconstructSource(
  normalized: Buffer,
  audit: AttackGridNormalizationAudit,
) {
  const { data, info } = await sharp(normalized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const restored = Buffer.alloc(audit.sourceWidth * audit.sourceHeight * 4);
  let retained = 0;
  for (const object of audit.objects) {
    const from = object.outputBounds,
      to = object.sourceBounds;
    assert.equal(from.width, to.width);
    assert.equal(from.height, to.height);
    for (let y = 0; y < from.height; y++)
      for (let x = 0; x < from.width; x++) {
        const sourcePixel = ((from.top + y) * info.width + from.left + x) * 4;
        if (!data[sourcePixel + 3]) continue;
        const restoredPixel =
          ((to.top + y) * audit.sourceWidth + to.left + x) * 4;
        assert.equal(
          restored[restoredPixel + 3],
          0,
          "a source pixel belongs to only one complete silhouette",
        );
        data.copy(restored, restoredPixel, sourcePixel, sourcePixel + 4);
        retained++;
      }
  }
  let outputPixels = 0;
  for (let index = 3; index < data.length; index += 4)
    if (data[index]) outputPixels++;
  assert.equal(
    outputPixels,
    retained,
    "no output pixels exist outside the isolated frames",
  );
  assert.equal(retained, audit.retainedPixels);
  return restored;
}

test("complete silhouettes may cross source grid lines and reverse translation preserves their exact RGBA", async () => {
  const source = completeSource();
  // An 8-neighbor-only alpha-1 tail remains attached to the red core.
  source.set([253, 87, 19, 1], (59 * 320 + 180) * 4);
  source.set([251, 85, 17, 1], (60 * 320 + 181) * 4);
  source.set([255, 255, 255, 1], (8 * 320 + 8) * 4);
  const encoded = await png(source);
  const untouched = Buffer.from(encoded);
  const { png: normalized, audit } = await normalizeAttackGrid(encoded, grid);

  assert.ok(encoded.equals(untouched), "input bytes remain unchanged");
  assert.deepEqual(audit.objects[0].sourceBounds, {
    left: 30,
    top: 35,
    width: 152,
    height: 26,
  });
  assert.deepEqual(audit.objects[0].coreBounds, {
    left: 30,
    top: 35,
    width: 150,
    height: 24,
  });
  assert.deepEqual(
    audit.objects.map((object) => object.cell),
    [0, 1],
  );
  assert.deepEqual(audit.discardedNoise, {
    components: 1,
    pixels: 1,
    maxAlpha: 1,
  });
  assert.equal(audit.sourceSha256, sha(encoded));
  assert.equal(audit.normalizedSha256, sha(normalized));
  assert.equal(audit.width % grid.columns, 0);
  assert.equal(audit.height % grid.rows, 0);
  const expected = Buffer.from(source);
  expected.fill(0, (8 * 320 + 8) * 4, (8 * 320 + 8) * 4 + 4);
  assert.ok((await reconstructSource(normalized, audit)).equals(expected));
});

test("overlapping source bounding boxes never borrow another silhouette or isolated alpha-1 noise", async () => {
  const source = Buffer.alloc(320 * 200 * 4);
  // Two separated hooks overlap in both x and y bounds without touching.
  rectangle(source, 320, 20, 20, 190, 8, red);
  rectangle(source, 320, 20, 20, 8, 130, red);
  rectangle(source, 320, 20, 100, 130, 8, red);
  rectangle(source, 320, 70, 165, 230, 8, blue);
  rectangle(source, 320, 292, 60, 8, 113, blue);
  rectangle(source, 320, 170, 130, 130, 8, blue);
  source.set([255, 255, 255, 1], (90 * 320 + 190) * 4);
  const { png: normalized, audit } = await normalizeAttackGrid(
    await png(source),
    grid,
  );
  assert.deepEqual(
    audit.objects.map((object) => object.sourceBounds),
    [
      { left: 20, top: 20, width: 190, height: 130 },
      { left: 70, top: 60, width: 230, height: 113 },
    ],
  );
  const expected = Buffer.from(source);
  expected.fill(0, (90 * 320 + 190) * 4, (90 * 320 + 190) * 4 + 4);
  assert.ok((await reconstructSource(normalized, audit)).equals(expected));
});

test("core centers preserve pose order even when long alpha-1 tails cross several source cells", async () => {
  const source = Buffer.alloc(400 * 200 * 4);
  rectangle(source, 400, 50, 40, 40, 40, red);
  rectangle(source, 400, 65, 80, 1, 41, [253, 87, 19, 1]);
  rectangle(source, 400, 65, 120, 290, 1, [253, 87, 19, 1]);
  rectangle(source, 400, 280, 40, 40, 40, blue);
  const { png: normalized, audit } = await normalizeAttackGrid(
    await png(source, 400),
    grid,
  );
  assert.deepEqual(
    audit.objects.map((object) => object.cell),
    [0, 1],
  );
  assert.ok((await reconstructSource(normalized, audit)).equals(source));
});

test("detached soft pixels are retained exactly with their unique containing silhouette and audited separately", async () => {
  for (const alpha of [2, 39]) {
    const source = Buffer.alloc(320 * 200 * 4);
    rectangle(source, 320, 30, 20, 140, 10, red);
    rectangle(source, 320, 30, 20, 10, 120, red);
    rectangle(source, 320, 30, 130, 140, 10, red);
    rectangle(source, 320, 215, 110, 50, 50, blue);
    rectangle(source, 320, 100, 80, 2, 3, [253, 87, 19, alpha]);
    const { png: normalized, audit } = await normalizeAttackGrid(
      await png(source),
      grid,
    );
    assert.deepEqual(
      audit.retainedSoftComponents.map((component) => ({
        cell: component.cell,
        sourceBounds: component.sourceBounds,
        pixels: component.pixels,
        maxAlpha: component.maxAlpha,
      })),
      [
        {
          cell: 0,
          sourceBounds: { left: 100, top: 80, width: 2, height: 3 },
          pixels: 6,
          maxAlpha: alpha,
        },
      ],
    );
    assert.equal(audit.discardedNoise.pixels, 0);
    assert.ok((await reconstructSource(normalized, audit)).equals(source));
  }
});

test("soft components with ambiguous containment or a different source cell and tiny visible fragments reject", async () => {
  const ambiguous = Buffer.alloc(320 * 200 * 4);
  rectangle(ambiguous, 320, 20, 20, 190, 8, red);
  rectangle(ambiguous, 320, 20, 20, 8, 130, red);
  rectangle(ambiguous, 320, 70, 165, 230, 8, blue);
  rectangle(ambiguous, 320, 292, 60, 8, 113, blue);
  ambiguous.set([253, 87, 19, 2], (90 * 320 + 190) * 4);
  await assert.rejects(
    normalizeAttackGrid(await png(ambiguous), grid),
    /exactly one|contain/i,
  );

  const wrongCell = Buffer.alloc(320 * 200 * 4);
  rectangle(wrongCell, 320, 20, 20, 200, 8, red);
  rectangle(wrongCell, 320, 20, 20, 8, 130, red);
  rectangle(wrongCell, 320, 20, 142, 200, 8, red);
  rectangle(wrongCell, 320, 260, 90, 40, 40, blue);
  wrongCell.set([253, 87, 19, 2], (80 * 320 + 190) * 4);
  await assert.rejects(
    normalizeAttackGrid(await png(wrongCell), grid),
    /source cell|center cell/i,
  );
  const visible = Buffer.from(wrongCell);
  visible.fill(0, (80 * 320 + 190) * 4, (80 * 320 + 190) * 4 + 4);
  visible.set([253, 87, 19, 40], (80 * 320 + 100) * 4);
  await assert.rejects(
    normalizeAttackGrid(await png(visible), grid),
    /1 core pixels.*maxAlpha 40.*bounds/i,
  );
});

test("complete silhouettes crossing horizontal grid lines preserve all rows in order", async () => {
  const source = Buffer.alloc(200 * 320 * 4);
  rectangle(source, 200, 35, 30, 24, 150, red);
  rectangle(source, 200, 110, 215, 50, 50, blue);
  const { png: normalized, audit } = await normalizeAttackGrid(
    await png(source, 200, 320),
    {
      columns: 1,
      rows: 2,
      poseCount: 2,
      poses: ["upper", "lower"],
    },
  );
  assert.deepEqual(
    audit.objects.map((object) => [object.column, object.row, object.pose]),
    [
      [0, 0, "upper"],
      [0, 1, "lower"],
    ],
  );
  assert.ok((await reconstructSource(normalized, audit)).equals(source));
});

test("missing cells, duplicate cell centers and every extra visible or soft component reject", async () => {
  const missing = Buffer.alloc(320 * 200 * 4);
  rectangle(missing, 320, 30, 35, 50, 50, red);
  await assert.rejects(
    normalizeAttackGrid(await png(missing), grid),
    /exactly|missing|silhouette/i,
  );
  const duplicate = Buffer.from(missing);
  rectangle(duplicate, 320, 100, 110, 50, 50, blue);
  await assert.rejects(
    normalizeAttackGrid(await png(duplicate), grid),
    /cell|center|duplicate/i,
  );
  for (const alpha of [2, 39, 40, 255]) {
    const extra = completeSource();
    extra.set([255, 220, 80, alpha], (90 * 320 + 190) * 4);
    await assert.rejects(
      normalizeAttackGrid(await png(extra), grid),
      /fragment|component|core|silhouette/i,
    );
  }
});

test("bad grid requests, truly clipped silhouettes, opaque backgrounds and non-PNG input reject", async () => {
  const encoded = await png(completeSource());
  for (const invalid of [
    { columns: 0, rows: 1, poseCount: 0 },
    { columns: -1, rows: -1, poseCount: 1 },
    { columns: 1.5, rows: 2, poseCount: 3 },
    { columns: 9, rows: 1, poseCount: 9 },
    { columns: 2, rows: 1, poseCount: 1 },
    { columns: 2, rows: 1, poseCount: 2, poses: ["same", "same"] },
  ])
    await assert.rejects(
      normalizeAttackGrid(encoded, invalid),
      /grid|pose|integer/i,
    );
  for (const alpha of [1, 255]) {
    const clipped = completeSource();
    rectangle(clipped, 320, 0, 40, 30, 1, [255, 80, 30, alpha]);
    await assert.rejects(
      normalizeAttackGrid(await png(clipped), grid),
      /edge|clipp|gutter/i,
    );
  }
  const opaque = Buffer.alloc(320 * 200 * 4, 255);
  await assert.rejects(
    normalizeAttackGrid(await png(opaque), grid),
    /transparen|opaque/i,
  );
  const jpeg = await sharp(encoded).flatten().jpeg().toBuffer();
  await assert.rejects(normalizeAttackGrid(jpeg, grid), /PNG|transparen/i);
});

test("file normalization writes verifiable provenance and cannot overwrite the raw source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "attack-grid-normalization-"));
  try {
    const source = join(directory, "raw.png"),
      destination = join(directory, "output/normalized.png"),
      auditPath = join(directory, "audit/normalization.json");
    const original = await png(completeSource());
    await writeFile(source, original);
    const report = await normalizeAttackGridFile({
      ...grid,
      source,
      destination,
      auditPath,
    });
    assert.ok((await readFile(source)).equals(original));
    assert.equal(report.source, source);
    assert.equal(report.normalized, destination);
    assert.equal(report.sourceSha256, sha(original));
    assert.equal(report.normalizedSha256, sha(await readFile(destination)));
    assert.deepEqual(JSON.parse(await readFile(auditPath, "utf8")), report);
    await assert.rejects(
      normalizeAttackGridFile({
        ...grid,
        source,
        destination: source,
        auditPath,
      }),
      /distinct|overwrite|source/i,
    );
    await assert.rejects(
      normalizeAttackGridFile({
        ...grid,
        source,
        destination,
        auditPath: source,
      }),
      /distinct|overwrite|source/i,
    );
    await assert.rejects(
      normalizeAttackGridFile({
        ...grid,
        source,
        destination,
        auditPath: destination,
      }),
      /distinct|overwrite|source/i,
    );
    const alias = join(directory, "raw-alias.png");
    await symlink(source, alias);
    await assert.rejects(
      normalizeAttackGridFile({
        ...grid,
        source,
        destination: alias,
        auditPath,
      }),
      /distinct|overwrite|source/i,
    );
    await rm(alias);
    await link(source, alias);
    await normalizeAttackGridFile({
      ...grid,
      source,
      destination: alias,
      auditPath,
    });
    const realDirectory = join(directory, "real-output"),
      aliasDirectory = join(directory, "alias-output");
    await mkdir(realDirectory);
    await symlink(realDirectory, aliasDirectory);
    await assert.rejects(
      normalizeAttackGridFile({
        ...grid,
        source,
        destination: join(realDirectory, "missing/same.png"),
        auditPath: join(aliasDirectory, "missing/same.png"),
      }),
      /distinct|overwrite|source/i,
    );
    const childDirectory = join(realDirectory, "child"),
      nestedSource = join(realDirectory, "raw-copy.png"),
      aliasChild = join(directory, "alias-child");
    await mkdir(childDirectory);
    await writeFile(nestedSource, original);
    await symlink(childDirectory, aliasChild);
    await assert.rejects(
      normalizeAttackGridFile({
        ...grid,
        source: nestedSource,
        destination: `${aliasChild}/../raw-copy.png`,
        auditPath,
      }),
      /distinct|overwrite|source/i,
    );
    assert.ok((await readFile(nestedSource)).equals(original));
    assert.ok((await readFile(source)).equals(original));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a tiny alpha2 island within three contour pixels is retained with an explicit distance audit", async () => {
  const source = completeSource();
  source.set([121, 99, 78, 2], (61 * 320 + 100) * 4);
  const result = await normalizeAttackGrid(await png(source), grid);
  assert.ok((await reconstructSource(result.png, result.audit)).equals(source));
  const island = result.audit.retainedSoftComponents[0];
  assert.equal(island.assignment, "adjacent-alpha2");
  assert.equal(island.contourDistance, 3);
  assert.equal(result.audit.objects[0].sourceBounds.height, 27);
});

test("adjacent island exception rejects distance, higher alpha, excess size and ambiguous contours", async () => {
  for (const [y, alpha, count] of [
    [62, 2, 1],
    [61, 3, 1],
    [61, 2, 9],
  ]) {
    const source = completeSource();
    rectangle(source, 320, 100, y, count, 1, [121, 99, 78, alpha]);
    await assert.rejects(
      normalizeAttackGrid(await png(source), grid),
      /Detached soft/,
    );
  }
  const ambiguous = Buffer.alloc(320 * 200 * 4);
  rectangle(ambiguous, 320, 80, 40, 78, 50, red);
  rectangle(ambiguous, 320, 162, 40, 80, 50, blue);
  ambiguous.set([121, 99, 78, 2], (55 * 320 + 159) * 4);
  await assert.rejects(
    normalizeAttackGrid(await png(ambiguous), grid),
    /Detached soft/,
  );
});
