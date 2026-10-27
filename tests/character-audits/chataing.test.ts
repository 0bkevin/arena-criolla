import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0) {
  const configs = [
    { name: "Audit Chataing", fighter: "chataing" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ];
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]], "chataing-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("the wired microphone turns back and is caught by its owner instead of passing through", () => {
  for (const side of [0, 1] as const) {
    const direction = side === 0 ? 1 : -1, r = setup(side);
    r.player.x = side === 0 ? 400 : 680;
    r.rival.x = r.player.x + direction * 400;
    const origin = r.player.x, path: { x: number; returning: boolean }[] = [];
    r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) path.push({ x: p.x, returning: !!p.returning });
    }
    const turn = path.findIndex((p) => p.returning);
    assert.ok(turn > 0, "the microphone must travel out before returning");
    // On the turning frame it already moves back toward the owner.
    assert.ok((path[turn].x - path[turn - 1].x) * direction < 0);
    assert.ok(path.slice(turn).every((p) => p.returning));
    // It is caught in front of the owner and never travels behind them.
    assert.ok(path.every((p) => (p.x - origin) * direction > -10));
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.player.x, origin);
    assert.equal(r.player.hp, 100);
    assert.equal(r.rival.hp, 100);
    assert.equal(r.player.attack, null);
  }
});
