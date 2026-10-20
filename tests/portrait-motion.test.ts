import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS } from "../shared/content";
import {
  entrancePoseProgress,
  sampleEntranceAction,
} from "../shared/entrance-actions";
import { presentationById } from "../shared/presentation";
import { samplePortraitLoop } from "../src/game/portrait-motion";
import { VICTORY_TRANSITION_MS as reveal } from "../src/game/victory-types";

test("the winner waits for the curtain and visibly folds, holds, and releases its arms", () => {
  const duration = presentationById("melanio").durationMs;
  const hold = entrancePoseProgress("melanio");
  const poseTime = reveal + hold * duration;
  assert.equal(samplePortraitLoop(reveal - 1, duration, hold).progress, 0);
  assert.ok(samplePortraitLoop(reveal + 1, duration, hold).progress > 0);
  const folding = samplePortraitLoop(reveal + duration * 0.32, duration, hold);
  assert.equal(
    sampleEntranceAction("melanio", folding.progress)?.current.phase,
    "fold",
  );
  for (const elapsed of [poseTime, poseTime + 500, poseTime + 1999]) {
    const pose = samplePortraitLoop(elapsed, duration, hold);
    assert.equal(
      sampleEntranceAction("melanio", pose.progress)?.current.frame,
      5,
    );
    assert.ok(pose.waitMs > 0, "the held pose should not run a repaint loop");
  }
  const release = samplePortraitLoop(
    reveal + 2000 + duration * 0.8,
    duration,
    hold,
  );
  assert.equal(
    sampleEntranceAction("melanio", release.progress)?.current.phase,
    "release",
  );
});

test("every fighter replays a complete greeting after a neutral rest without skipping the release", () => {
  for (const fighter of FIGHTERS) {
    const duration = presentationById(fighter.id).durationMs;
    const hold = entrancePoseProgress(fighter.id);
    const cycle = duration + 2500;
    assert.equal(
      samplePortraitLoop(reveal + duration + 2000, duration, hold).progress,
      1,
      fighter.id,
    );
    assert.equal(
      samplePortraitLoop(reveal + cycle, duration, hold).progress,
      0,
      fighter.id,
    );
    for (let time = 0; time < cycle; time += 67) {
      const first = samplePortraitLoop(reveal + time, duration, hold);
      assert.deepEqual(
        samplePortraitLoop(reveal + time + cycle, duration, hold),
        first,
        fighter.id,
      );
      assert.ok(first.progress >= 0 && first.progress <= 1, fighter.id);
      assert.ok(Number.isFinite(first.waitMs) && first.waitMs >= 0, fighter.id);
    }
  }
});
