import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch, type Input } from "./helpers/charged-finale-engine";
function setup(side: 0 | 1 = 0) {
  const emilio = { name: "Emilio", fighter: "emilio" as const, wins: 3 };
  const rival = { name: "Rival", fighter: "javier" as const, wins: 3 };
  const state = createMatch(
    "poliedro",
    side ? [rival, emilio] : [emilio, rival],
  );
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 800 : 280;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * 500;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  return { state, source, target, inputs, advance, side };
}
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("El Chunior activates at tick9 out of range in either slot with cost and no enemy damage/freeze", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.inputs[side].actions.super++;
    r.advance(8);
    assert.equal(Boolean(r.source.transformation), false);
    r.advance(1);
    assert.equal(r.source.transformation?.ticks, 360);
    assert.equal(r.source.transformation?.id, "el-chunior");
    assert.equal(r.state.finale, undefined);
    assert.equal(r.target.hp, 100);
    assert.equal(r.source.hits, 0);
    close(r.source.energy, 10.28);
    const tick = r.state.tick,
      x = r.target.x;
    r.inputs[1 - side].left = true;
    r.advance(12);
    assert.ok(r.target.x < x);
    assert.equal(r.state.tick, tick + 12);
    assert.equal(r.source.transformation?.ticks, 348);
  }
});
