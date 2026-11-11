import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, cpuInput, emptyInput } from "../../shared/engine/engine";
import { FIGHTERS, STAGES } from "../../shared/roster/roster";
import { simulate } from "../../scripts/balance/model";
import {
  MIN_RING_OUT_DAMAGE,
  ringOutDamage,
} from "../../shared/engine/damage-values";
import { removeFallHpDrop } from "../../scripts/balance/model";

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

test("falls are recorded apart from hits and keep the stock", () => {
  const options = {
    stages: [STAGES[0]!.id],
    difficulty: "hard" as const,
    limit: 10000,
  };
  const result = simulate(FIGHTERS[0]!, FIGHTERS[1]!, STAGES[0]!.id, options);
  assert.ok(result.falls.length > 0);
  for (const fall of result.falls) {
    assert.ok(fall.hp > MIN_RING_OUT_DAMAGE);
    assert.ok(Math.abs(fall.damage - ringOutDamage(fall.hp)) < 1e-9);
    assert.ok(
      !result.stocks.some(
        (stock) => stock.tick === fall.tick && stock.loser === fall.loser,
      ),
    );
  }
  for (const [side, totals] of result.sides.entries()) {
    assert.ok(
      Math.abs(
        totals.damage -
          result.hits
            .filter((hit) => hit.attacker === side)
            .reduce((sum, hit) => sum + hit.damage, 0),
      ) < 1e-9,
      "opponent DPS includes hit drops only, excluding fall losses",
    );
    let previousStockTick = 0;
    for (const stock of result.stocks.filter((stock) => stock.loser === side)) {
      const hitLoss = result.hits
        .filter(
          (hit) =>
            hit.victim === side &&
            hit.tick > previousStockTick &&
            hit.tick <= stock.tick,
        )
        .reduce((sum, hit) => sum + hit.damage, 0);
      const fallLoss = result.falls
        .filter(
          (fall) =>
            fall.loser === side &&
            fall.tick > previousStockTick &&
            fall.tick <= stock.tick,
        )
        .reduce((sum, fall) => sum + fall.damage, 0);
      assert.ok(
        Math.abs(100 - hitLoss - fallLoss - stock.hp) < 1e-7,
        "hit damage, surviving falls and HP left account for the whole stock",
      );
      previousStockTick = stock.tick;
    }
  }
});

test("fall accounting removes its exact HP drop and keeps an equal same-step hit", () => {
  const earlier = {
    tick: 12,
    damage: 10,
    hpBefore: 100,
    attacker: 1 as const,
    victim: 0 as const,
    source: "unknown" as const,
  };
  const sameTickHit = { ...earlier };
  const fallDrop = { ...earlier };
  const hits: Parameters<typeof removeFallHpDrop>[0] = [
    earlier,
    sameTickHit,
    fallDrop,
  ];
  assert.equal(removeFallHpDrop(hits, 1, 0), fallDrop);
  assert.deepEqual(hits, [earlier, sameTickHit]);
});
