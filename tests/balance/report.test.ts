import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, cpuInput, emptyInput } from "../../shared/engine/engine";
import { FIGHTERS, STAGES } from "../../shared/roster/roster";
import { simulate } from "../../scripts/balance/model";

test("CPU default seat remains equivalent to explicit player 1", () => {
  const state = createMatch(STAGES[0]!.id, [
    { name: "A", fighter: FIGHTERS[0]!.id, wins: 3 },
    { name: "B", fighter: FIGHTERS[1]!.id, wins: 3 },
  ]);
  const previous = emptyInput();
  assert.deepEqual(
    cpuInput(state, previous, "hard"),
    cpuInput(state, previous, "hard", 1),
  );
});

test("CPU seat 0 approaches and attacks player 1", () => {
  const state = createMatch(STAGES[0]!.id, [
    { name: "A", fighter: FIGHTERS[0]!.id, wins: 3 },
    { name: "B", fighter: FIGHTERS[0]!.id, wins: 3 },
  ]);
  state.players[0].x = 300;
  state.players[1].x = 500;
  state.tick = 0;
  assert.equal(cpuInput(state, emptyInput(), "hard", 0).right, true);
  assert.equal(cpuInput(state, emptyInput(), "hard", 1).left, true);
  state.players[1].x = 400;
  const a = cpuInput(state, emptyInput(), "hard", 0);
  const b = cpuInput(state, emptyInput(), "hard", 1);
  assert.equal(a.actions.heavy, 1);
  assert.equal(b.actions.heavy, 1);
});

test("match recording is deterministic", () => {
  const options = {
    stages: [STAGES[0]!.id],
    difficulty: "hard" as const,
    limit: 10000,
  };
  assert.deepEqual(
    simulate(FIGHTERS[0]!, FIGHTERS[1]!, STAGES[0]!.id, options),
    simulate(FIGHTERS[0]!, FIGHTERS[1]!, STAGES[0]!.id, options),
  );
});
