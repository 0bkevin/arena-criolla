import assert from "node:assert/strict";
import test from "node:test";
import { writeFinaleMusic } from "../src/game/finale-sounds";
test("the original bass cue is deterministic, finite, audible and fades to silence", () => {
  const rate = 12000,
    length = 3 * rate;
  const left = new Float32Array(length),
    right = new Float32Array(length),
    repeat = new Float32Array(length),
    repeatR = new Float32Array(length);
  writeFinaleMusic(left, right, rate, "oscar");
  writeFinaleMusic(repeat, repeatR, rate, "oscar");
  assert.deepEqual(left, repeat);
  assert.deepEqual(right, repeatR);
  assert.ok(left.every(Number.isFinite));
  assert.ok(left.some((v) => Math.abs(v) > 0.05));
  assert.equal(left[length - 1], 0);
  assert.equal(right[length - 1], 0);
});
