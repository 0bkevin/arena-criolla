import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../../shared/engine/engine";
import { recordMatch } from "../../src/app/progress";
import type { Progress } from "../../src/app/storage";

const empty = (): Progress => ({
  wins: {},
  played: 0,
  bestCombo: 0,
  recent: [],
});

function finished(winner: 0 | 1) {
  const state = createMatch("caracas", [
    { name: "A", fighter: "ali", wins: 0 },
    { name: "B", fighter: "zavarce", wins: 0 },
  ]);
  state.phase = "finished";
  state.winner = winner;
  state.players[0].peakCombo = 4;
  return state;
}

test("a win credits the local fighter and leads the history", () => {
  const before = empty();
  const after = recordMatch(before, finished(0), 0, "practice");
  assert.deepEqual(after.wins, { ali: 1 });
  assert.equal(after.played, 1);
  assert.equal(after.bestCombo, 4);
  assert.deepEqual(
    { ...after.recent[0], date: undefined },
    { fighter: "ali", rival: "zavarce", won: true, date: undefined },
  );
  assert.deepEqual(before, empty(), "the previous progress is not mutated");
});

test("local versus credits player 2's win; online credits only the local seat", () => {
  assert.deepEqual(recordMatch(empty(), finished(1), 0, "local").wins, {
    zavarce: 1,
  });
  const online = recordMatch(empty(), finished(1), 1, "online");
  assert.deepEqual(online.wins, { zavarce: 1 });
  assert.equal(online.recent[0]?.fighter, "zavarce");
  assert.equal(online.recent[0]?.won, true);
});

test("the history keeps the latest eight matches", () => {
  let progress = empty();
  for (let i = 0; i < 10; i++)
    progress = recordMatch(progress, finished(0), 0, "practice");
  assert.equal(progress.recent.length, 8);
  assert.equal(progress.played, 10);
});
