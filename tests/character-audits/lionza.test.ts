import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280) {
  const configs = [
    { name: "Audit María Lionza", fighter: "lionza" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lionza-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test("a rival who is airborne when the ground-only spirit passes takes no damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.inputs[side].actions.special++; r.advance(42);
    r.inputs[1 - side].actions.jump++; let crossedWhileAirborne = false;
    for (let n = 0; n < 128; n++) {
      r.advance(1);
      const shot = r.state.projectiles[0];
      if (shot && Math.abs(shot.x - r.rival.x) < 42) { assert.equal(r.rival.grounded, false); crossedWhileAirborne = true; }
      assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    }
    assert.equal(crossedWhileAirborne, true); assert.equal(r.rival.grounded, true); assert.equal(r.state.projectiles.length, 0);
  }
});

test("a ground-only special is rejected without cost in the air and never emits if the caster jumps during startup", () => {
  for (const side of [0, 1] as const) {
    for (const delayed of [false, true]) {
      const r = setup(side); r.inputs[side].actions.jump++;
      if (delayed) r.advance(10);
      r.inputs[side].actions.special++; r.advance(1);
      assert.equal(r.player.grounded, false); assert.equal(r.player.attack, null); close(r.player.energy, 100);
      r.advance(150); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100);
    }
    for (const jumpTick of [2, 11, 21]) {
      const r = setup(side); r.inputs[side].actions.special++; r.advance(1);
      assert.equal(r.player.attack, "special"); close(r.player.energy, 75);
      r.advance(jumpTick - 2); r.inputs[side].actions.jump++;
      for (let n = 0; n < 150; n++) { r.advance(1); assert.equal(r.state.projectiles.length, 0); }
      assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.player.attack, null);
    }
  }
});
