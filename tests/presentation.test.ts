import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import {
  INTRO_COUNTDOWN_START,
  INTRO_TOTAL_TICKS,
} from "../shared/presentation";

test("entrances lock physics and consume queued attacks without spending match time", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "george", wins: 0 },
    { name: "Dos", fighter: "emilio", wins: 0 },
  ]);
  const inputs = [emptyInput(), emptyInput()] as ReturnType<
    typeof emptyInput
  >[];
  inputs[0].right = true;
  inputs[0].actions.special++;
  inputs[1].actions.light++;
  for (let i = 0; i < INTRO_TOTAL_TICKS; i++)
    stepMatch(state, inputs as [(typeof inputs)[0], (typeof inputs)[1]]);
  assert.equal(state.phase, "playing");
  assert.equal(state.remaining, 120 * 60);
  assert.deepEqual(
    state.players.map((p) => [p.x, p.hp, p.facing, p.attack]),
    [
      [330, 100, 1, null],
      [750, 100, -1, null],
    ],
  );
  stepMatch(state, inputs as [(typeof inputs)[0], (typeof inputs)[1]]);
  assert.equal(state.players[0].attack, null);
  assert.equal(state.players[1].attack, null);
});
test("skip is synchronized through existing inputs and retains the countdown", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "simon", wins: 0 },
    { name: "Dos", fighter: "dudamel", wins: 0 },
  ]);
  const inputs: [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>] =
    [emptyInput(), emptyInput()];
  inputs[1].actions.dash++;
  stepMatch(state, inputs);
  assert.equal(state.tick, INTRO_COUNTDOWN_START);
  assert.equal(state.phase, "intro");
  const peer = JSON.parse(JSON.stringify(state));
  for (let i = INTRO_COUNTDOWN_START; i < INTRO_TOTAL_TICKS; i++) {
    stepMatch(state, inputs);
    stepMatch(peer, inputs);
    assert.deepEqual(state, peer);
  }
  assert.equal(state.phase, "playing");
  assert.equal(state.players[1].dash, 0);
});
