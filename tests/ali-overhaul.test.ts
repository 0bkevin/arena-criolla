import assert from "node:assert/strict";
import test from "node:test";
import type { FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, type Input, type MatchState } from "./helpers/charged-finale-engine";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Alí", fighter: "ali" as const, wins: 3 },
    b = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [b, a] : [a, b]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const cast = (move: "special" | "super") => {
    inputs[side].actions[move]++;
    advance(1);
    assert.equal(source.energy, move === "special" ? 75 : 10);
  };
  return { state, source, target, inputs, advance, cast };
}
test("live Alí serializes and resumes identically through all three contacts and release", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.cast("super");
    r.advance(8 + 30);
    const clone = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 180; n++) {
      stepMatch(clone, r.inputs);
      r.advance(1);
      assert.deepEqual(clone, r.state);
    }
  }
});
