import test from "node:test";
import assert from "node:assert/strict";
import { entranceWeight } from "../../src/game/render/entrance-renderer";

test("the painted entrance dissolves in from and back out to the stance", () => {
  // Before and after the performance only the combat stance shows.
  assert.equal(entranceWeight(0), 0);
  assert.equal(entranceWeight(1), 0);
  assert.equal(entranceWeight(0.95), 0);
  // It fades in over the first few percent instead of cutting.
  assert.ok(entranceWeight(0.01) > 0 && entranceWeight(0.01) < 1);
  assert.ok(entranceWeight(0.03) > entranceWeight(0.01));
  // The whole authored action plays fully opaque.
  for (const progress of [0.05, 0.3, 0.6, 0.85]) {
    assert.equal(entranceWeight(progress), 1);
  }
  // And hands over gradually around the end instead of snapping.
  const exit = [0.885, 0.9, 0.915].map(entranceWeight);
  assert.ok(exit[0] < 1 && exit[0] > exit[1] && exit[1] > exit[2]);
  assert.ok(exit[2] > 0);
});
