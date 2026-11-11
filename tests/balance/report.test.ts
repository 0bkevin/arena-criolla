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

test("match recording is deterministic and conserves observed damage", () => {
  const options = {
    stages: [STAGES[0]!.id],
    difficulty: "hard" as const,
    limit: 10000,
  };
  const a = simulate(FIGHTERS[0]!, FIGHTERS[1]!, STAGES[0]!.id, options);
  assert.deepEqual(
    a,
    simulate(FIGHTERS[0]!, FIGHTERS[1]!, STAGES[0]!.id, options),
  );
  assert.ok(a.stocks.length >= 2);
  for (const side of [0, 1] as const) {
    assert.equal(
      a.sides[side]!.damage,
      a.hits
        .filter((hit) => hit.attacker === side)
        .reduce((sum, hit) => sum + hit.damage, 0),
    );
    for (const stock of a.stocks.filter((entry) => entry.loser === side))
      assert.equal(stock.cause, stock.hp <= 0 ? "hp" : "ring-out");
  }
});

test("stock classifications and source attribution conserve recorded damage", () => {
  const options = {
    stages: [STAGES[0]!.id],
    difficulty: "hard" as const,
    limit: 10000,
  };
  for (const variant of [0, 1, 2, 3]) {
    const match = simulate(
      FIGHTERS[0]!,
      FIGHTERS[1]!,
      STAGES[0]!.id,
      options,
      variant,
    );
    for (const stock of match.stocks) {
      assert.equal(stock.cause === "ring-out", stock.ringOutKind !== null);
      if (stock.ringOutKind !== null) {
        const recent = match.hits.some(
          (hit) =>
            hit.attacker !== stock.loser &&
            hit.tick <= stock.tick &&
            hit.tick >= stock.tick - 90 &&
            hit.tick > stock.tick - stock.elapsedTicks,
        );
        assert.equal(stock.ringOutKind === "launched", recent);
      }
    }
    assert.ok(
      match.hits.every((hit) =>
        ["light", "heavy", "special", "super", "unknown"].includes(hit.source),
      ),
    );
  }
});
