import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "./helpers/charged-finale-engine";
type Side = 0 | 1;
function setup(id: "lorenzo" | "carolina" | "deyna" | "bolivar" | "edgar", side: Side = 0, gap = 140, wins = 3) {
  const state = createMatch(
    "caracas",
    [
      { name: "Uno", fighter: side === 0 ? id : "zavarce", wins },
      { name: "Dos", fighter: side === 1 ? id : "zavarce", wins },
    ],
    "roster-v39",
  );
  state.phase = "playing";
  const actor = state.players[side],
    rival = state.players[1 - side];
  actor.x = side === 0 ? 450 : 750;
  rival.x = actor.x + (side === 0 ? gap : -gap);
  for (const player of state.players) {
    player.y = WORLD.floor;
    player.grounded = true;
    player.invincible = 0;
    player.energy = 100;
    player.facing =
      player === actor ? (side === 0 ? 1 : -1) : side === 0 ? -1 : 1;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let n = 0; n < ticks; n++) stepMatch(state, inputs);
  };
  return { state, actor, rival, inputs, advance, side };
}
test("Édgar's counter intercepts a facing strike once on either side", () => {
  for (const side of [0, 1] as const) {
    const run = setup("edgar", side, 80);
    run.inputs[side].actions.special++;
    run.advance(5);
    run.inputs[1 - side].actions.light++;
    run.advance(6);
    assert.equal(run.actor.hp, 100);
    assert.equal(run.actor.countered, true);
    assert.ok(run.rival.hp < 100);
  }
});
