import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { prepareAttackArt } from "../scripts/prepare-attack-art";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";

async function inPackingWorkspace(run: () => Promise<void>) {
  const previous = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "attack-art-packing-"));
  await mkdir(join(directory, "shared"));
  await writeFile(join(directory, "shared/attack-assets.json"), "{}\n");
  process.chdir(directory);
  try {
    await run();
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
}

function rectangle(
  pixels: Buffer,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
) {
  for (let row = y; row < y + height; row++)
    for (let column = x; column < x + width; column++)
      pixels.set(rgba, (row * imageWidth + column) * 4);
}

async function writeSource(pixels: Buffer, width = 512, height = 512) {
  await writeFile(
    "fixture.png",
    await sharp(pixels, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
  );
}

const config = {
  fighter: "capriles",
  file: "synthetic-attack",
  source: "fixture.png",
  columns: 1,
  rows: 1,
  poses: ["stand"],
};

test("packing retains attached alpha-1 pixels and discards only disconnected alpha-1 noise", async () => {
  await inPackingWorkspace(async () => {
    const source = Buffer.alloc(512 * 512 * 4);
    rectangle(source, 512, 60, 20, 432, 472, [173, 84, 31, 255]);
    rectangle(source, 512, 20, 256, 40, 1, [255, 80, 30, 1]);
    rectangle(source, 512, 8, 8, 1, 1, [255, 255, 255, 1]);
    rectangle(source, 512, 30, 80, 1, 1, [255, 255, 255, 1]);
    await writeSource(source);
    const original = await readFile("fixture.png");

    const report = await prepareAttackArt(config);
    assert.deepEqual(report.objects[0].sourceBounds, {
      left: 20,
      top: 20,
      width: 472,
      height: 472,
    });
    assert.deepEqual(report.objects[0].discardedNoise, {
      components: 2,
      pixels: 2,
      maxAlpha: 1,
    });
    // This fixture already has the final scale and position. Its raw RGBA is
    // an independent reference. Remove the declared noise inside and outside
    // the retained bounds, so cropping alone cannot satisfy the comparison.
    const expected = Buffer.from(source);
    expected.fill(0, (8 * 512 + 8) * 4, (8 * 512 + 8) * 4 + 4);
    expected.fill(0, (80 * 512 + 30) * 4, (80 * 512 + 30) * 4 + 4);
    const packed = await sharp(report.normalized)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const runtime = await sharp(report.destination)
      .ensureAlpha()
      .raw()
      .toBuffer();
    assert.ok(
      packed.equals(expected),
      "packing preserves all retained source RGBA",
    );
    assert.ok(
      runtime.equals(expected),
      "runtime preserves the source alpha-1 tail",
    );
    assert.ok(
      (await readFile("fixture.png")).equals(original),
      "raw source remains untouched",
    );
  });
});

test("packing keeps row-major poses, aspect ratios and custom anchors through scaling", async () => {
  await inPackingWorkspace(async () => {
    const source = Buffer.alloc(1024 * 512 * 4);
    rectangle(source, 1024, 40, 100, 236, 118, [191, 52, 38, 255]);
    rectangle(source, 1024, 612, 40, 118, 236, [29, 79, 181, 255]);
    await writeSource(source, 1024);
    const report = await prepareAttackArt({
      ...config,
      columns: 2,
      poses: ["wide", "tall"],
      anchorFractions: { wide: 0.25, tall: 0.75 },
    });
    assert.deepEqual(report.frames, {
      wide: {
        x: 20,
        y: 256,
        width: 472,
        height: 236,
        anchorX: 118,
        anchorY: 236,
        bodyHeight: 236,
      },
      tall: {
        x: 650,
        y: 20,
        width: 236,
        height: 472,
        anchorX: 177,
        anchorY: 472,
        bodyHeight: 472,
      },
    });
    const expected = Buffer.alloc(1024 * 512 * 4);
    rectangle(expected, 1024, 20, 256, 472, 236, [191, 52, 38, 255]);
    rectangle(expected, 1024, 650, 20, 236, 472, [29, 79, 181, 255]);
    const packed = await sharp(report.normalized)
      .ensureAlpha()
      .raw()
      .toBuffer();
    assert.ok(
      packed.equals(expected),
      "both complete silhouettes scale uniformly by two",
    );
  });
});

test("packing rejects invalid grids and silhouettes clipped at a source edge", async () => {
  await inPackingWorkspace(async () => {
    const source = Buffer.alloc(512 * 512 * 4);
    rectangle(source, 512, 40, 40, 200, 200, [173, 84, 31, 255]);
    await writeSource(source);
    for (const grid of [
      { columns: 0, rows: 1, poses: [] },
      { columns: -1, rows: -1, poses: ["stand"] },
      { columns: 1.5, rows: 2, poses: ["first", "second", "third"] },
      { columns: 3, rows: 1, poses: ["first", "second", "third"] },
    ]) {
      await assert.rejects(prepareAttackArt({ ...config, ...grid }));
    }

    for (const edgeAlpha of [1, 255]) {
      const clipped = Buffer.from(source);
      rectangle(clipped, 512, 0, 100, 40, 1, [255, 80, 30, edgeAlpha]);
      await writeSource(clipped);
      await assert.rejects(prepareAttackArt(config), /edge|cut|clipp|gutter/i);
    }
    assert.deepEqual(
      JSON.parse(await readFile("shared/attack-assets.json", "utf8")),
      {},
    );
  });
});

test("faint attached alpha below the feet remains packed without lifting or shrinking the visible body", async () => {
  await inPackingWorkspace(async () => {
    const source = Buffer.alloc(512 * 512 * 4);
    rectangle(source, 512, 20, 20, 472, 432, [173, 84, 31, 255]);
    rectangle(source, 512, 256, 452, 1, 40, [255, 80, 30, 1]);
    await writeSource(source);
    const report = await prepareAttackArt(config);
    const frame = report.frames.stand;
    assert.equal(frame.height, 472, "the faint tail is still preserved");
    assert.equal(frame.bodyHeight, 432);
    assert.equal(frame.anchorY, 432);
    const previous = ATTACK_ART.capriles;
    ATTACK_ART.capriles = { file: config.file, frames: report.frames };
    try {
      const calls: unknown[][] = [];
      const ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        translate() {},
        scale() {},
        drawImage(...args: unknown[]) {
          calls.push(args);
        },
      } as unknown as CanvasRenderingContext2D;
      const image = { width: 512, height: 512 } as HTMLImageElement;
      assert.ok(
        drawAttackArt(
          ctx,
          { [config.file]: image },
          "capriles",
          "stand",
          100,
          555,
          177,
        ),
      );
      const top = calls[0][6] as number,
        height = calls[0][8] as number;
      assert.equal(top, -177, "visible body height remains177 world units");
      assert.ok(
        Math.abs(top + (frame.anchorY / frame.height) * height) < 1e-10,
        "visible feet meet the requested baseline",
      );
    } finally {
      if (previous) ATTACK_ART.capriles = previous;
      else delete ATTACK_ART.capriles;
    }
  });
});
