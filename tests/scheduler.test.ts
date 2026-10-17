import test from "node:test";
import assert from "node:assert/strict";
import { FixedStepTicker } from "../server/ticker";

test("fixed-step ticker sustains 60 simulation steps per second independent of callback cadence", () => {
  for (const callbackMs of [8, 10, 16, 17, 33]) {
    const ticker = new FixedStepTicker();
    let steps = ticker.advance(0);
    for (let now = callbackMs; now <= 60_000; now += callbackMs)
      steps += ticker.advance(now);
    steps += ticker.advance(60_000);
    assert.equal(steps, 3_600, `callback cadence ${callbackMs}ms`);
  }
});

test("fixed-step ticker caps catch-up and drops excess whole ticks after a stall", () => {
  const ticker = new FixedStepTicker(1000 / 60, 5);
  assert.equal(ticker.advance(0), 0);
  assert.equal(ticker.advance(10_000), 5);
  assert.equal(ticker.advance(10_001), 0);
  assert.equal(ticker.advance(10_017), 1);
  assert.equal(ticker.advance(10_034), 1);
});

test("fixed-step ticker ignores non-finite and backwards clock samples", () => {
  const ticker = new FixedStepTicker();
  assert.equal(ticker.advance(100), 0);
  assert.equal(ticker.advance(Number.NaN), 0);
  assert.equal(ticker.advance(90), 0);
  assert.equal(ticker.advance(116.666667), 1);
});
