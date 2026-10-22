import assert from "node:assert/strict";
import test from "node:test";
import { simonSpecialPose } from "../src/game/finales/simon";
import { writeFinaleMusic } from "../src/game/finale-sounds";
test("Simón's release stroke matches the first visible emission rather than a floating overlay", () => {
  assert.equal(simonSpecialPose(11), "ready");
  assert.equal(simonSpecialPose(12), "downstroke");
  assert.equal(simonSpecialPose(20), "upstroke");
  assert.equal(simonSpecialPose(32), "ready");
});

test("Simón's original synthesized score is deterministic, audible and ends in silence", () => {
  const rate = 12000,
    length = 3 * rate;
  const left = new Float32Array(length),
    right = new Float32Array(length),
    repeat = new Float32Array(length),
    repeatR = new Float32Array(length);
  writeFinaleMusic(left, right, rate, "simon");
  writeFinaleMusic(repeat, repeatR, rate, "simon");
  assert.deepEqual(left, repeat);
  assert.deepEqual(right, repeatR);
  assert.ok(left.some((v) => Math.abs(v) > 0.05));
  assert.ok(left.every(Number.isFinite));
  assert.equal(left[length - 1], 0);
  assert.equal(right[length - 1], 0);
});
