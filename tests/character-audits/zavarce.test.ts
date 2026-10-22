import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, cpuInput, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 120, wins = 3) {
  const configs = [
    { name: "Audit Vicente", fighter: "zavarce" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]]);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  for (let n = 0; n < INTRO_TOTAL_TICKS; n++) stepMatch(state, inputs);
  const player = state.players[side];
  const rival = state.players[1 - side];
  player.x = side === 0 ? 250 : 830;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 60;
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  return { state, inputs, player, rival, advance, side };
}
test("motorcycles can be jumped and cannot be summoned in midair", () => {
  for (const side of [0, 1] as const) {
    const dodge = setup(side, 120);
    dodge.inputs[side].actions.special++;
    dodge.inputs[1 - side].actions.jump++;
    dodge.advance(22);
    dodge.inputs[1 - side].actions.jump++;
    dodge.advance(128);
    assert.equal(dodge.rival.hp, 100);
    assert.equal(dodge.player.hits, 0);
    assert.equal(dodge.state.projectiles.length, 0);

    const airborne = setup(side);
    airborne.inputs[side].actions.jump++;
    airborne.advance(4);
    airborne.inputs[side].actions.special++;
    airborne.advance(1);
    assert.equal(airborne.player.attack, null);
    assert.equal(airborne.player.energy, 100);
    assert.equal(airborne.state.projectiles.length, 0);
  }
});
test("the CPU can use Vicente's motorcycle from zero wins", () => {
  for (const wins of [0, 1, 2, 3]) {
    const run = setup(1, 300, wins);
    run.state.tick = 600;
    const input = cpuInput(run.state, emptyInput(), "normal");
    assert.equal(input.actions.special, 1);
  }
});
