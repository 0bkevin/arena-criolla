import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS } from "../shared/content";
import { CHOREOGRAPHIES, REST, sampleGesture } from "../shared/choreography";
import { PRESENTATIONS, samplePose } from "../shared/presentation";
import { deformRigPoint } from "../src/game/gesture-rig";
import { ENTRANCE_ACTIONS } from "../shared/entrance-actions";

test("all fighters have distinct corporal gestures that settle into the original pose", () => {
  assert.deepEqual(
    Object.keys(CHOREOGRAPHIES).sort(),
    FIGHTERS.map((f) => f.id).sort(),
  );
  assert.equal(
    new Set(Object.values(CHOREOGRAPHIES).map((c) => JSON.stringify(c.beats)))
      .size,
    FIGHTERS.length,
  );
  for (const fighter of FIGHTERS) {
    const rig = CHOREOGRAPHIES[fighter.id];
    assert.deepEqual(sampleGesture(fighter.id, 0), { at: 0, ...REST });
    assert.deepEqual(sampleGesture(fighter.id, 1), { at: 1, ...REST });
    assert.deepEqual(sampleGesture(fighter.id, -1), { at: 0, ...REST });
    assert.deepEqual(sampleGesture(fighter.id, 2), { at: 1, ...REST });
    let wristTravel = 0;
    for (let n = 0; n <= 40; n++) {
      const gesture = sampleGesture(fighter.id, n / 40);
      const selection = sampleGesture(fighter.id, n / 40, true);
      for (const key of Object.keys(REST) as (keyof typeof REST)[])
        assert.ok(Math.abs(selection[key] - gesture[key] * 0.45) < 1e-12);
      const frame = samplePose(
        PRESENTATIONS[fighter.id].introBeats,
        n / 40,
      ).frame;
      const hands =
        frame === 0
          ? rig.hands
          : (rig.raisedHands ?? [
              [-0.055, rig.shoulders + 0.04],
              [0.14, rig.shoulders - 0.005],
            ]);
      for (const hand of hands) {
        const point = deformRigPoint(
          { x: hand[0], y: hand[1] },
          rig,
          gesture,
          frame,
        );
        wristTravel = Math.max(
          wristTravel,
          Math.hypot(point.x - hand[0], point.y - hand[1]),
        );
      }
      const head = deformRigPoint({ x: 0, y: 0.07 }, rig, gesture, frame);
      wristTravel = Math.max(wristTravel, Math.hypot(head.x, head.y - 0.07));
    }
    assert.ok(
      ENTRANCE_ACTIONS[fighter.id] || wristTravel > 0.025,
      `${fighter.id}: hands or head must visibly move`,
    );
    const source = { x: 0.12, y: 0.31 };
    assert.deepEqual(
      deformRigPoint(source, rig, sampleGesture(fighter.id, 1), 0),
      source,
    );
  }
});

test("raised arms and head tilts preserve mesh orientation through every entrance", () => {
  // The determinant catches inverted sleeve/face triangles, even at motion peaks.
  // It failed for the original single-step warp; integrating the field fixes it.
  const delta = 0.0001;
  for (const fighter of FIGHTERS) {
    const rig = CHOREOGRAPHIES[fighter.id];
    const profile = PRESENTATIONS[fighter.id];
    const frames = new Set(
      [...profile.introBeats, ...profile.selectionBeats].map((b) => b.frame),
    );
    for (const beat of rig.beats)
      for (const frame of frames)
        for (let y = 0.03; y < 0.9; y += 0.07)
          for (let x = -0.28; x < 0.3; x += 0.07) {
            const p = deformRigPoint({ x, y }, rig, beat, frame);
            const a = deformRigPoint({ x: x + delta, y }, rig, beat, frame);
            const b = deformRigPoint({ x, y: y + delta }, rig, beat, frame);
            const determinant =
              ((a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y)) /
              (delta * delta);
            assert.ok(
              Number.isFinite(determinant) && determinant > 0.035,
              `${fighter.id}: inverted mesh at ${beat.at}/${frame}/${x}/${y}`,
            );
            assert.ok(
              Math.hypot(p.x - x, p.y - y) < 0.25,
              `${fighter.id}: excessive deformation`,
            );
          }
  }
});

test("painted instruments and accessories stay rigid as their actors move", () => {
  for (const fighter of FIGHTERS) {
    const rig = CHOREOGRAPHIES[fighter.id];
    for (const part of rig.rigidParts ?? [])
      for (const zone of part.zones)
        for (const frame of part.frames ?? [0, 1])
          for (const gesture of rig.beats) {
            const a = { x: zone.from[0], y: zone.from[1] };
            const b = { x: zone.to[0], y: zone.to[1] };
            const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const p = deformRigPoint(a, rig, gesture, frame);
            const q = deformRigPoint(b, rig, gesture, frame);
            const r = deformRigPoint(m, rig, gesture, frame);
            assert.ok(
              Math.abs(
                Math.hypot(q.x - p.x, q.y - p.y) -
                  Math.hypot(b.x - a.x, b.y - a.y),
              ) < 0.00001,
              `${fighter.id}: stretched prop`,
            );
            assert.ok(
              Math.hypot(r.x - (p.x + q.x) / 2, r.y - (p.y + q.y) / 2) <
                0.00001,
              `${fighter.id}: bent prop`,
            );
          }
  }
});
