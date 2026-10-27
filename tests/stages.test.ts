import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, platformsAtTick, type StageId } from "../shared/content";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../shared/engine";

function rider(stage: StageId) {
  const state = createMatch(stage, [
    { name: "Uno", fighter: "zavarce", wins: 0 },
    { name: "Dos", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  const index = STAGES.find((s) => s.id === stage)!.platforms.findIndex(
    (p) => p.motion,
  );
  assert.ok(index >= 0);
  const platform = platformsAtTick(stage, 0)[index];
  const p = state.players[0];
  Object.assign(p, {
    x: platform.x + platform.width / 2,
    y: platform.y,
    grounded: true,
    supportPlatform: index,
    invincible: 0,
  });
  state.players[1].x = 970;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, inputs, p, index };
}

test("CPU treats the floor interior as safe and still recovers at the real edges", () => {
  const state = createMatch("poliedro", [
    { name: "A", fighter: "zavarce", wins: 0 },
    { name: "CPU", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.tick = 34;
  for (const x of [WORLD.left + 60, WORLD.right - 60]) {
    state.players[1].x = x;
    const input = cpuInput(state, emptyInput(), "normal");
    assert.equal(input.actions.jump, 0, "safe added floor is not an edge");
  }
  for (const x of [WORLD.left + 10, WORLD.right - 10]) {
    state.players[1].x = x;
    const input = cpuInput(state, emptyInput(), "normal");
    assert.equal(
      input.actions.jump,
      1,
      "CPU must still recover at the real edge",
    );
  }
});

test("all platform motion stays within the floor throughout its cycle", () => {
  for (const stage of STAGES) {
    for (let tick = 0; tick <= 1200; tick += 5) {
      for (const platform of platformsAtTick(stage.id, tick)) {
        assert.ok(platform.x >= WORLD.left, stage.id);
        assert.ok(platform.x + platform.width <= WORLD.right, stage.id);
        assert.ok(platform.y < WORLD.floor, stage.id);
      }
    }
  }
});

test("projectiles keep travelling beyond the floor edges inside the arena", () => {
  for (const [x, vx] of [
    [-60, -5],
    [1140, 5],
  ]) {
    const state = createMatch("poliedro", [
      { name: "A", fighter: "vallenilla", wins: 0 },
      { name: "B", fighter: "javier", wins: 0 },
    ]);
    state.phase = "playing";
    state.projectiles.push({
      id: 1,
      owner: 0,
      x,
      y: 250,
      vx,
      life: 60,
      kind: "installments",
      damage: 1,
    });
    stepMatch(state, [emptyInput(), emptyInput()]);
    assert.equal(state.projectiles.length, 1);
    assert.equal(state.projectiles[0].x, x + vx);
  }
});
test("impact pauses hold platform positions and recover without losing support", () => {
  const { state, inputs, p, index } = rider("merida");
  state.hitstop = 5;
  const start = { x: p.x, y: p.y, tick: state.tick };
  for (let i = 0; i < 5; i++) stepMatch(state, inputs);
  assert.deepEqual({ x: p.x, y: p.y, tick: state.tick }, start);
  assert.equal(state.remaining, 120 * 60 - 5);
  stepMatch(state, inputs);
  assert.ok(p.grounded);
  assert.equal(p.y, platformsAtTick(state.stage, state.tick)[index].y);
});
test("heavy hits include their attacker and pause before continuing knockback", () => {
  const state = createMatch("poliedro", [
    { name: "Uno", fighter: "zavarce", wins: 0 },
    { name: "Dos", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => (p.invincible = 0));
  state.players[1].x = 430;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.heavy++;
  for (let i = 0; i < 11; i++) stepMatch(state, inputs);
  const hit = state.effects.find((e) => e.kind === "hit");
  assert.ok(hit);
  assert.equal(hit.owner, 0);
  assert.equal(hit.impact, "heavy");
  assert.ok(hit.strength! > 1);
  const pause = state.hitstop;
  assert.ok(pause > 0, "a heavy hit starts an impact pause");
  assert.equal(state.players[0].hits, 1);
  const x = state.players[1].x;
  for (let i = 0; i < pause; i++) stepMatch(state, inputs);
  assert.equal(state.players[1].x, x);
  stepMatch(state, inputs);
  assert.ok(state.players[1].x > x);
});
