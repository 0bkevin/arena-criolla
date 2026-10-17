import test from "node:test";
import assert from "node:assert/strict";
import {
  arenaBounds,
  arenaCanvasSize,
  sceneryCover,
  sceneryTiles,
} from "../src/game/viewport";
import { WORLD } from "../shared/engine";
import { ARENA_VIEW } from "../shared/arena";
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
    assert.ok(bounds.x <= WORLD.x && bounds.y <= WORLD.y);
    assert.ok(bounds.x + bounds.width >= WORLD.x + WORLD.width);
    assert.ok(bounds.y + bounds.height >= WORLD.y + WORLD.height);
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

test("desktop and the portrait orientation gate retain the complete world size", () => {
  for (const [width, height, immersive] of [
    [1920, 1080, false],
    [390, 844, true],
    [0, 0, true],
    [Infinity, 390, true],
  ] as const)
    assert.deepEqual(arenaCanvasSize(width, height, immersive), {
      width: ARENA_VIEW.width,
      height: ARENA_VIEW.height,
    });
});

test("mirrored scenery covers recovery and resized views without gaps or changing scale", () => {
  for (const source of [
    [1080, 640],
    [540, 320],
  ]) {
    const cover = sceneryCover(
      ...(source as [number, number]),
      arenaBounds(WORLD.width, WORLD.height),
    );
    for (const bounds of [
      { x: -275, y: -141, width: 1455, height: 808 },
      { x: -195, y: -141, width: 1455, height: 808 },
      { x: -1000, y: -800, width: 3100, height: 2500 },
    ]) {
      const tiles = sceneryTiles(cover, bounds);
      for (const tile of tiles) {
        assert.equal(tile.width, cover.width);
        assert.equal(tile.height, cover.height);
      }
      for (let row = 0; row <= 20; row++) {
        for (let column = 0; column <= 20; column++) {
          const x = bounds.x + (bounds.width * column) / 20;
          const y = bounds.y + (bounds.height * row) / 20;
          assert.ok(
            tiles.some(
              (tile) =>
                x >= tile.x &&
                x <= tile.x + tile.width &&
                y >= tile.y &&
                y <= tile.y + tile.height,
            ),
          );
        }
      }
      // Adjacent mirrored copies meet at the same source edge in both axes.
      for (const tile of tiles) {
        const right = tiles.find(
          (next) => next.x === tile.x + tile.width && next.y === tile.y,
        );
        const below = tiles.find(
          (next) => next.y === tile.y + tile.height && next.x === tile.x,
        );
        if (right) assert.notEqual(tile.mirrorX, right.mirrorX);
        if (below) assert.notEqual(tile.mirrorY, below.mirrorY);
      }
    }
  }
});
