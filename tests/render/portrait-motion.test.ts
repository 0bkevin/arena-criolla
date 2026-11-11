import assert from "node:assert/strict";
import test from "node:test";
import { samplePortraitLoop } from "../../src/game/render/portrait-motion";
import { drawPresentation } from "../../src/game/render/presentation-renderer";
import type { SpriteAsset } from "../../src/game/assets/assets";

test("victory portraits repeat the full sequence continuously", () => {
  const duration = 2800;

  assert.equal(samplePortraitLoop(0, duration), 0);
  assert.equal(samplePortraitLoop(duration / 2, duration), 0.5);
  assert.equal(
    samplePortraitLoop(duration - 1, duration),
    (duration - 1) / duration,
  );
  assert.equal(samplePortraitLoop(duration, duration), 0);
  assert.equal(samplePortraitLoop(duration * 2 + duration / 4, duration), 0.25);
  assert.equal(samplePortraitLoop(duration * 3 + duration / 2, duration), 0.5);
});

function portrait() {
  const image = { width: 128, height: 16 } as HTMLImageElement;
  const entranceImage = { width: 96, height: 16 } as HTMLImageElement;
  const frame = (index: number) => ({
    x: index * 16,
    y: 0,
    width: 16,
    height: 16,
    slotX: index * 16,
    slotY: 0,
  });
  const sprite: SpriteAsset = {
    image,
    cellWidth: 16,
    cellHeight: 16,
    baseline: 16,
    bodyHeight: 16,
    portraitCenters: Array(8).fill(8),
    frames: Array.from({ length: 8 }, (_, index) => frame(index)),
    frameFacing: Array(8).fill(1),
    battleFrame: 0,
    entrance: {
      image: entranceImage,
      cell: 16,
      bodyHeight: 16,
      baseline: 16,
      anchorX: 8,
      frames: Array.from({ length: 6 }, (_, index) => frame(index)),
    },
  };
  const draws: unknown[][] = [];
  const ctx = new Proxy(
    {
      globalAlpha: 1,
      drawImage: (...args: unknown[]) => draws.push(args),
    },
    { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
  ) as unknown as CanvasRenderingContext2D;
  const paint = (progress: number, repeat: boolean, reduced = false) => {
    draws.length = 0;
    drawPresentation(
      ctx,
      sprite,
      "zavarce",
      progress,
      200,
      491,
      375,
      1,
      "selection",
      reduced,
      repeat,
    );
    assert.equal(draws.length, 1, "each repaint draws exactly one character");
    return draws[0];
  };
  return { image, entranceImage, paint };
}

test("repeated victory rendering stays in the animation across consecutive cycle boundaries", () => {
  const { entranceImage, paint } = portrait();
  const duration = 2800;
  const first = paint(0, true);
  for (let cycle = 0; cycle < 4; cycle++) {
    const crops = new Set<unknown>();
    for (let elapsed = 0; elapsed < duration; elapsed += 1000 / 30) {
      const draw = paint(
        samplePortraitLoop(cycle * duration + elapsed, duration),
        true,
      );
      assert.equal(draw[0], entranceImage, "never substitute the combat atlas");
      crops.add(draw[1]);
    }
    assert.ok(crops.size > 1, "the character keeps animating in each cycle");
    assert.deepEqual(
      paint(samplePortraitLoop((cycle + 1) * duration - 1, duration), true),
      first,
      "the authored release matches the opening pose without a visual cut",
    );
    assert.deepEqual(
      paint(samplePortraitLoop((cycle + 1) * duration, duration), true),
      first,
    );
  }
});

test("one-shot portraits still return to combat stance and reduced motion skips animation", () => {
  const { image, paint } = portrait();
  assert.equal(paint(0, false)[0], image);
  assert.equal(paint(1, false)[0], image);
  assert.equal(paint(0.5, true, true)[0], image);
});
