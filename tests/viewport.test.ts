import test from "node:test";
import assert from "node:assert/strict";
import {
  arenaBounds,
  arenaCanvasSize,
  sceneryCover,
} from "../src/game/viewport";
import { WORLD } from "../shared/engine";
import { STAGES, platformsAtTick } from "../shared/content";

test("immersive landscape viewports retain the complete arena with uniform fighter scale", () => {
  for (const [width, height] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [932, 430],
    [1024, 768],
    [1366, 768],
  ]) {
    const size = arenaCanvasSize(width, height, true);
    const bounds = arenaBounds(size.width, size.height);
    assert.ok(
      Math.abs(width / size.width - height / size.height) < 0.001,
      "sprites must not stretch",
    );
    assert.ok(bounds.x <= 0 && bounds.y <= 0);
    assert.ok(bounds.x + bounds.width >= WORLD.width);
    assert.ok(bounds.y + bounds.height >= WORLD.height);
    for (const stage of STAGES)
      for (const platform of platformsAtTick(stage.id, 100)) {
        assert.ok(
          platform.x >= bounds.x &&
            platform.x + platform.width <= bounds.x + bounds.width,
          stage.id,
        );
        assert.ok(
          platform.y >= bounds.y && platform.y < bounds.y + bounds.height,
          stage.id,
        );
      }
  }
});

test("scenery covers the entire expanded viewport without gaps or distortion", () => {
  for (const [width, height] of [
    [1385, 640],
    [1080, 810],
    [1138, 640],
  ]) {
    const bounds = arenaBounds(width, height);
    const cover = sceneryCover(1080, 640, bounds);
    assert.ok(cover.x <= bounds.x && cover.y <= bounds.y);
    assert.ok(cover.x + cover.width >= bounds.x + bounds.width);
    assert.ok(cover.y + cover.height >= bounds.y + bounds.height);
    assert.ok(Math.abs(cover.width / cover.height - 1080 / 640) < 1e-9);
  }
});

test("desktop and the portrait orientation gate retain the original canvas size", () => {
  for (const [width, height, immersive] of [
    [1920, 1080, false],
    [390, 844, true],
    [0, 0, true],
    [Infinity, 390, true],
  ] as const)
    assert.deepEqual(arenaCanvasSize(width, height, immersive), {
      width: WORLD.width,
      height: WORLD.height,
    });
});
