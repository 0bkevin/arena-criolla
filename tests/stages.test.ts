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

test("every stage supports fighters at both ends of the compact floor", () => {
  assert.ok(WORLD.right - WORLD.left > 940);
  assert.ok(WORLD.right - WORLD.left <= 1100);
  for (const stage of STAGES) {
    const state = createMatch(stage.id, [
      { name: "Left", fighter: "zavarce", wins: 0 },
      { name: "Right", fighter: "javier", wins: 0 },
    ]);
    state.phase = "playing";
    state.players[0].x = WORLD.left + 30;
    state.players[1].x = WORLD.right - 30;
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    for (let tick = 0; tick < 120; tick++) stepMatch(state, inputs);
    for (const player of state.players) {
      assert.equal(player.stocks, 2, stage.id);
      assert.equal(player.y, WORLD.floor, stage.id);
      assert.equal(player.grounded, true, stage.id);
    }
    state.players[0].x = WORLD.x - 121;
    stepMatch(state, inputs);
    assert.equal(state.players[0].stocks, 1, stage.id);
    state.players[1].x = WORLD.x + WORLD.width + 121;
    stepMatch(state, inputs);
    assert.equal(state.players[1].stocks, 1, stage.id);
  }
});

test("CPU recognizes the expanded safe floor and still recovers at its new edges", () => {
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

test("all platform motion stays within the enlarged floor throughout its cycle", () => {
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

test("projectiles can travel through the additional room on either side", () => {
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
test("a horizontal gondola carries a fighter without sliding or falling", () => {
  const { state, inputs, p, index } = rider("merida");
  const startX = p.x;
  for (let frame = 0; frame < 180; frame++) {
    stepMatch(state, inputs);
    const platform = platformsAtTick(state.stage, state.tick)[index];
    assert.ok(p.grounded);
    assert.equal(p.supportPlatform, index);
    assert.ok(Math.abs(p.x - platform.x - platform.width / 2) < 0.002);
    assert.equal(p.y, platform.y);
  }
  assert.ok(p.x - startX > 100);
  assert.equal(p.stocks, 2);
});
test("a vertical platform carries its rider through a full cycle", () => {
  const { state, inputs, p, index } = rider("canaima");
  let min = p.y,
    max = p.y;
  for (let frame = 0; frame < 720; frame++) {
    stepMatch(state, inputs);
    assert.ok(p.grounded);
    assert.equal(p.y, platformsAtTick(state.stage, state.tick)[index].y);
    assert.equal(p.vy, 0);
    min = Math.min(min, p.y);
    max = Math.max(max, p.y);
  }
  assert.ok(max - min > 85);
  assert.equal(p.stocks, 2);
});
test("jumping releases a fighter from the moving gondola", () => {
  const { state, inputs, p } = rider("merida");
  inputs[0].actions.jump++;
  stepMatch(state, inputs);
  assert.equal(p.grounded, false);
  assert.equal(p.supportPlatform, null);
  const launchX = p.x;
  for (let i = 0; i < 10; i++) stepMatch(state, inputs);
  assert.ok(p.y < 365);
  assert.ok(Math.abs(p.x - launchX) < 0.002);
});
test("a brief down press drops through without snapping back", () => {
  const { state, inputs, p } = rider("canaima");
  inputs[0].down = true;
  stepMatch(state, inputs);
  inputs[0].down = false;
  for (let i = 0; i < 70; i++) stepMatch(state, inputs);
  assert.equal(p.y, WORLD.floor);
  assert.equal(p.supportPlatform, -1);
  assert.equal(p.stocks, 2);
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
  assert.equal(state.hitstop, 5);
  assert.equal(state.players[0].hits, 1);
  const x = state.players[1].x;
  for (let i = 0; i < 5; i++) stepMatch(state, inputs);
  assert.equal(state.players[1].x, x);
  stepMatch(state, inputs);
  assert.ok(state.players[1].x > x);
});
test("fighters land from above on every moving platform", () => {
  for (const stage of STAGES.filter((s) => s.platforms.some((p) => p.motion))) {
    const { state, inputs, p, index } = rider(stage.id);
    p.y -= 8;
    p.vy = 5;
    p.grounded = false;
    p.supportPlatform = null;
    for (let i = 0; i < 10; i++) stepMatch(state, inputs);
    assert.ok(p.grounded, stage.id);
    assert.equal(p.supportPlatform, index, stage.id);
    assert.equal(p.y, platformsAtTick(stage.id, state.tick)[index].y);
  }
});

test("stage physics remains deterministic and finite", () => {
  for (const stage of STAGES) {
    const a = createMatch(stage.id, [
      { name: "A", fighter: "zavarce", wins: 0 },
      { name: "B", fighter: "capriles", wins: 0 },
    ]);
    const b = structuredClone(a);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    for (let frame = 0; frame < 600; frame++) {
      if (frame % 60 === 0) inputs[0].actions.jump++;
      inputs[0].right = frame % 240 < 80;
      inputs[0].left = frame % 240 > 160;
      stepMatch(a, inputs);
      stepMatch(b, inputs);
    }
    assert.deepEqual(a, b);
    a.players.forEach((p) =>
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)),
    );
  }
});
