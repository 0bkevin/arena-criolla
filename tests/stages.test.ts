import test from "node:test";
import assert from "node:assert/strict";
import { stat, readFile } from "node:fs/promises";
import { STAGES, platformsAtTick, type StageId } from "../shared/content";
import {
  createMatch,
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
  assert.equal(state.remaining, 90 * 60 - 5);
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

test("nine stages have backgrounds and deterministic finite physics", async () => {
  assert.equal(STAGES.length, 9);
  assert.equal(STAGES.filter((s) => s.artStyle === "pixel").length, 6);
  for (const stage of STAGES) {
    const path = `public/assets/${stage.id}.webp`;
    assert.ok((await stat(path)).size > 10000);
    assert.equal((await readFile(path)).toString("ascii", 0, 4), "RIFF");
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
