import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, cpuInput, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Chataing", fighter: "chataing" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ];
  const state = createMatch(
    "poliedro",
    side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]],
    "chataing-v28-audit",
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}
function emit(check: string, value: unknown) {
  console.log(
    JSON.stringify({ character: "chataing", check, evidence: value }),
  );
}
test("the wired microphone turns at age24 and is caught instead of passing through its owner", () => {
  for (const side of [0, 1] as const) {
    const direction = side === 0 ? 1 : -1,
      r = setup(side, 400);
    r.player.x = side === 0 ? 400 : 680;
    r.rival.x = r.player.x + direction * 400;
    const origin = r.player.x,
      path: { age: number; x: number; y: number; returning: boolean }[] = [];
    r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles)
        path.push({
          age: p.age ?? 0,
          x: p.x,
          y: p.y,
          returning: !!p.returning,
        });
    }
    assert.equal(path[0].age, 1);
    close(path[0].x, origin + direction * 85);
    const peak = path.find((p) => p.age === 23)!;
    close(peak.x, origin + direction * 305);
    const turn = path.find((p) => p.age === 24)!;
    assert.equal(turn.returning, true);
    assert.ok((turn.x - peak.x) * direction < 0);
    assert.ok(path.every((p) => (p.x - origin) * direction > -10));
    assert.equal(r.player.x, origin);
    assert.equal(r.player.hp, 100);
    assert.equal(r.rival.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.player.attack, null);
    emit("tether-return", {
      side,
      origin,
      first: path[0],
      peak,
      turn,
      last: path.at(-1),
    });
  }
});

test("CPU approaches before using the returning microphone", () => {
  const r = setup(1, 500);
  r.advance(90);
  const chosen = cpuInput(r.state, emptyInput(), "normal");
  assert.equal(r.state.tick, 600);
  assert.equal(chosen.actions.special, 0);
  assert.equal(chosen.left, true);
  const start = {
    tick: r.state.tick,
    casterX: r.player.x,
    targetX: r.rival.x,
    energy: r.player.energy,
  };
  r.inputs[1] = chosen;
  r.advance(120);
  assert.equal(r.rival.hp, 100);
  assert.equal(r.player.hits, 0);
  const inReach = setup(1, 280);
  inReach.advance(90);
  assert.equal(
    cpuInput(inReach.state, emptyInput(), "normal").actions.special,
    1,
  );
  emit("cpu-range-probe", {
    start,
    input: chosen,
    finalCasterX: r.player.x,
    finalEnergy: r.player.energy,
    targetHp: r.rival.hp,
    hits: r.player.hits,
  });
});
