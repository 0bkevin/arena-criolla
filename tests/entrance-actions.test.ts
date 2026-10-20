import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS } from "../shared/content";
import { CHOREOGRAPHIES, REST, sampleGesture } from "../shared/choreography";
import {
  DEFAULT_ENTRANCE_ACTION,
  DEFAULT_ENTRANCE_FIGHTERS,
  ENTRANCE_ACTIONS,
  sampleEntranceAction,
} from "../shared/entrance-actions";
import { presentationById, selectionProgress } from "../shared/presentation";
import manifest from "../shared/entrance-assets.json";
import sharp from "sharp";

test("all 34 default fighters have matching profiles, actions, and dedicated artwork", () => {
  const expected = [...DEFAULT_ENTRANCE_FIGHTERS].sort();
  assert.equal(expected.length, 34);
  assert.equal(new Set(expected).size, 34);
  for (const style of ["introStyle", "selectionStyle"] as const)
    assert.deepEqual(
      FIGHTERS.filter(
        (fighter) => presentationById(fighter.id)[style] === "defiant",
      )
        .map((fighter) => fighter.id)
        .sort(),
      expected,
    );
  assert.deepEqual(
    Object.entries(ENTRANCE_ACTIONS)
      .filter(([, action]) => action === DEFAULT_ENTRANCE_ACTION)
      .map(([id]) => id)
      .sort(),
    expected,
  );
  assert.deepEqual(
    Object.entries(manifest)
      .filter(([, asset]) => asset.file.endsWith("-defiant-entrance"))
      .map(([id]) => id)
      .sort(),
    expected,
  );
});

test("default entrances straighten, fold once, hold, and release into the original guard", () => {
  for (const id of DEFAULT_ENTRANCE_FIGHTERS) {
    const profile = presentationById(id);
    assert.equal(profile.introStyle, "defiant", id);
    assert.equal(profile.selectionStyle, "defiant", id);
    assert.equal(profile.prop, "none", `${id}: obsolete prop overlay`);
    for (const beats of [profile.introBeats, profile.selectionBeats])
      for (const beat of beats) {
        assert.equal(beat.frame, profile.battleFrame, id);
        assert.equal(beat.dx, 0, `${id}: residual sway`);
        assert.equal(beat.dy, 0, `${id}: residual bounce`);
      }
    const phases = DEFAULT_ENTRANCE_ACTION.frames
      .map((frame) => frame.phase)
      .filter((phase, index, all) => phase !== all[index - 1]);
    assert.deepEqual(phases, ["straighten", "fold", "hold", "release"]);
    for (const progress of [0.48, 0.6, 0.75]) {
      const sample = sampleEntranceAction(id, progress)!;
      assert.equal(sample.current.phase, "hold", id);
      assert.equal(sample.current.frame, 5, id);
    }
    assert.ok((0.76 - 0.48) * profile.durationMs >= 750, id);
    assert.equal(sampleEntranceAction(id, 0), null, id);
    for (const progress of [0.9, 1, 2, 100])
      assert.equal(sampleEntranceAction(id, progress), null, id);
  }
  for (const id of ["oscar", "dudamel"] as const)
    assert.notEqual(ENTRANCE_ACTIONS[id], DEFAULT_ENTRANCE_ACTION);
});

test("every default entrance ships six transparent poses with complete silhouettes", async () => {
  for (const id of DEFAULT_ENTRANCE_FIGHTERS) {
    const asset = manifest[id];
    assert.equal(asset.frames.length, 6, id);
    const image = sharp(`public/assets/${asset.file}.webp`);
    const meta = await image.metadata();
    assert.equal(meta.width, asset.width, id);
    assert.equal(meta.height, asset.height, id);
    assert.ok(meta.hasAlpha, id);
    for (const frame of asset.frames) {
      assert.ok(frame.x >= frame.slotX && frame.y >= frame.slotY, id);
      assert.ok(frame.x + frame.width < frame.slotX + asset.cell, id);
      assert.ok(frame.y + frame.height < frame.slotY + asset.cell, id);
      const stats = await image
        .clone()
        .extract({
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        })
        .stats();
      assert.ok(stats.channels[3].max > 200, `${id}: empty pose`);
      assert.equal(stats.channels[3].min, 0, `${id}: opaque background`);
    }
    for (const key of ENTRANCE_ACTIONS[id]!.frames)
      assert.ok(asset.frames[key.frame], `${id}: missing action frame`);
  }
});

test("selection finishes once and stays in guard across later replay-sized intervals", () => {
  for (const f of FIGHTERS) {
    assert.equal(selectionProgress(f.id, -1), 0);
    for (const elapsed of [2800, 5400, 10800, 60000]) {
      const progress = selectionProgress(f.id, elapsed);
      assert.equal(progress, 1, f.id);
      assert.equal(sampleEntranceAction(f.id, progress), null, f.id);
      assert.deepEqual(sampleGesture(f.id, progress), { at: 1, ...REST }, f.id);
    }
  }
});

test("all corporal gestures build to one accent and release without repeated reversals", () => {
  for (const fighter of FIGHTERS) {
    const rig = CHOREOGRAPHIES[fighter.id];
    const peak = rig.beats.find((b) => b.at === 0.5)!;
    for (const field of Object.keys(REST) as (keyof typeof REST)[]) {
      const sign = Math.sign(peak[field]);
      let before = 0,
        after = Math.abs(peak[field]);
      for (let n = 0; n <= 50; n++) {
        const amount = sampleGesture(fighter.id, n / 100)[field] * sign;
        assert.ok(
          amount >= before - 1e-10,
          `${fighter.id}/${field}: repeated preparation`,
        );
        before = amount;
      }
      for (let n = 51; n <= 100; n++) {
        const amount = sampleGesture(fighter.id, n / 100)[field] * sign;
        assert.ok(
          amount <= after + 1e-10 && amount >= -1e-10,
          `${fighter.id}/${field}: repeated release`,
        );
        after = amount;
      }
    }
  }
});

test("salsa turn and conductor's downbeat advance once through their painted poses", () => {
  assert.equal(ENTRANCE_ACTIONS.oscar!.turns, 1);
  assert.equal(ENTRANCE_ACTIONS.dudamel!.turns, 0);
  assert.equal(
    ENTRANCE_ACTIONS.oscar!.frames.filter((f) => f.frame === 9).length,
    1,
    "back view occurs once",
  );
  assert.equal(
    ENTRANCE_ACTIONS.dudamel!.frames.filter((f) => f.frame === 6).length,
    1,
    "upbeat peaks once",
  );
  for (const id of ["oscar", "dudamel"] as const) {
    assert.equal(manifest[id].frames.length, id === "oscar" ? 16 : 12);
    for (let n = 1; n < 100; n++) {
      const t = n / 100,
        sample = sampleEntranceAction(id, t);
      if (t >= 0.9) {
        assert.equal(sample, null);
        continue;
      }
      assert.ok(sample);
      assert.ok(sample.next.at >= sample.current.at);
      for (const key of [sample.current, sample.next])
        assert.ok(manifest[id].frames[key.frame]);
    }
    for (const t of [0, 0.9, 1, 2, 100])
      assert.equal(sampleEntranceAction(id, t), null);
  }
});

test("Oscar draws and sings before one turn, without mirrored microphone poses or a second pass", () => {
  const frames = ENTRANCE_ACTIONS.oscar!.frames;
  const phases = frames
    .map((f) => f.phase)
    .filter((phase, index, all) => phase !== all[index - 1]);
  assert.deepEqual(phases, ["draw", "sing", "turn", "settle"]);
  assert.ok(frames.every((f) => !f.mirror));
  assert.equal(new Set(frames.map((f) => f.frame)).size, frames.length);
  // At normal speed the singing gesture must have time to read before the pivot.
  const sing = frames.find((f) => f.phase === "sing")!.at;
  const turn = frames.find((f) => f.phase === "turn")!.at;
  assert.ok((turn - sing) * 2800 >= 650);
  let previous = -1;
  for (let tick = 1; tick < 168; tick++) {
    const sample = sampleEntranceAction("oscar", tick / 168);
    if (!sample) continue;
    assert.ok(sample.current.frame >= previous, "entrance ran backwards");
    previous = sample.current.frame;
  }
  for (const progress of [0.9, 1, 2, 10])
    assert.equal(sampleEntranceAction("oscar", progress), null);
});
