import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, WORLD } from "../shared/engine";
import { STAGES } from "../shared/content";
import { advanceArenaCamera, cameraBounds } from "../src/game/arena-camera";

function fight() {
  const state = createMatch("caracas", [
    { name: "A", fighter: "zavarce", wins: 0 },
    { name: "B", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  return state;
}

test("close combat uses a closer view with room to pan left and right", () => {
  const state = fight();
  const center = advanceArenaCamera(undefined, state, 1440, 800);
  const centerBounds = cameraBounds(center, 1440, 800);
  assert.ok(center.zoom > 1.2);
  assert.ok(centerBounds.width < WORLD.width);
  for (const [a, b, direction] of [
    [WORLD.left + 15, WORLD.left + 255, -1],
    [WORLD.right - 255, WORLD.right - 15, 1],
  ]) {
    state.players[0].x = a;
    state.players[1].x = b;
    let camera = center;
    for (let frame = 0; frame < 90; frame++)
      camera = advanceArenaCamera(camera, state, 1440, 800);
    const bounds = cameraBounds(camera, 1440, 800);
    assert.ok((camera.x - center.x) * direction > 60);
    assert.ok(a >= bounds.x + 60 && b <= bounds.x + bounds.width - 60);
  }
});

test("separation and high jumps open the shot so both fighters remain visible", () => {
  const state = fight();
  const close = advanceArenaCamera(undefined, state, 1440, 800);
  state.players[0].x = WORLD.left;
  state.players[1].x = WORLD.right;
  const wide = advanceArenaCamera(close, state, 1440, 800);
  const bounds = cameraBounds(wide, 1440, 800);
  assert.ok(wide.zoom < close.zoom);
  assert.ok(bounds.x + 64 <= WORLD.left);
  assert.ok(bounds.x + bounds.width - 64 >= WORLD.right);
  state.players[0].x = 420;
  state.players[1].x = 660;
  state.players[0].y = 180;
  const jump = advanceArenaCamera(close, state, 1440, 800);
  assert.ok(cameraBounds(jump, 1440, 800).y <= 180 - 177 - 64);
});

test("every stage keeps both recovery zones visible across desktop and mobile aspect ratios", () => {
  for (const stage of STAGES)
    for (const [width, height] of [
      [1440, 800],
      [1731, 800],
      [1440, 1080],
    ]) {
      const state = fight();
      state.stage = stage.id;
      let camera = advanceArenaCamera(undefined, state, width, height);
      for (let frame = 0; frame < 100; frame++) {
        state.players[0].x = 330 + ((WORLD.x - 110 - 330) * frame) / 99;
        state.players[1].x =
          750 + ((WORLD.x + WORLD.width + 110 - 750) * frame) / 99;
        camera = advanceArenaCamera(camera, state, width, height);
        const bounds = cameraBounds(camera, width, height);
        assert.ok(
          Number.isFinite(camera.x) && Number.isFinite(camera.zoom),
          stage.id,
        );
        for (const player of state.players) {
          assert.ok(player.x >= bounds.x + 63.99, stage.id);
          assert.ok(player.x <= bounds.x + bounds.width - 63.99, stage.id);
        }
      }
    }
});

test("knocked-out fighters do not steer the camera and a finished fight holds its shot", () => {
  const state = fight();
  state.players[0].stocks = 0;
  state.players[0].x = -10000;
  const camera = advanceArenaCamera(undefined, state, 1440, 800);
  assert.ok(camera.zoom > 1.2);
  assert.ok(camera.x > 400);
  state.phase = "finished";
  assert.deepEqual(advanceArenaCamera(camera, state, 1440, 800), camera);
  assert.deepEqual(advanceArenaCamera(camera, state, 1440, 800, 16, true), {
    x: WORLD.x + WORLD.width / 2,
    zoom: 1,
  });
});

test("camera smoothing takes the same time at 30 and 60 frames per second", () => {
  const state = fight();
  const start = advanceArenaCamera(undefined, state, 1440, 800);
  state.players[0].x = 100;
  state.players[1].x = 400;
  const run = (frames: number) => {
    let camera = start;
    for (let frame = 0; frame < frames; frame++)
      camera = advanceArenaCamera(camera, state, 1440, 800, 1000 / frames);
    return camera;
  };
  assert.ok(Math.abs(run(30).x - run(60).x) < 1e-8);
  assert.ok(Math.abs(run(30).zoom - run(60).zoom) < 1e-8);
});
