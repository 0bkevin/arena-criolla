import assert from "node:assert/strict";
import test from "node:test";
import type { FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, type Input, type MatchState } from "./helpers/charged-finale-engine";
import { ATTACK_ART, hasAttackArt } from "../src/game/attack-art";
import { writeFinaleMusic } from "../src/game/finale-sounds";
import { ALI_ACTOR_POSES, ALI_POSES, aliSpecialPose, drawAliSpecial } from "../src/game/finales/ali";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Alí", fighter: "ali" as const, wins: 3 },
    b = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [b, a] : [a, b]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const cast = (move: "special" | "super") => {
    inputs[side].actions[move]++;
    advance(1);
    assert.equal(source.energy, move === "special" ? 75 : 10);
  };
  return { state, source, target, inputs, advance, cast };
}
test("Alí special downstrokes coincide with all real ground projectile emissions in both directions", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280);
    r.cast("special");
    const emissions = new Map<number, number>();
    for (let tick = 2; tick <= 50; tick++) {
      r.advance(1);
      for (const p of r.state.projectiles)
        if (!emissions.has(p.id)) {
          emissions.set(p.id, r.source.attackTick);
          assert.ok(p.groundOnly);
          assert.equal(p.kind, "strum");
          assert.equal(Math.sign(p.vx), side ? -1 : 1);
          assert.equal(
            aliSpecialPose(r.source.attackTick),
            r.source.attackTick === 36 ? "accent" : "downstroke",
          );
        }
    }
    assert.deepEqual([...emissions.values()], [12, 24, 36]);
  }
  assert.equal(aliSpecialPose(11), "upstroke");
  assert.equal(aliSpecialPose(23), "upstroke");
  assert.equal(aliSpecialPose(35), "upstroke");
  assert.equal(aliSpecialPose(48), "ready");
});
test("all ten poses preflight before any finale paint; four actor poses preflight before any special paint", () => {
  const sheet = ATTACK_ART.ali;
  for (const missing of ALI_POSES) {
    const frame = sheet.frames[missing];
    delete sheet.frames[missing];
    try {
      assert.equal(
        hasAttackArt(
          { [sheet.file]: { width: 2560, height: 1024 } as HTMLImageElement },
          "ali",
          ALI_POSES,
        ),
        false,
      );
    } finally {
      sheet.frames[missing] = frame;
    }
  }
  for (const missing of ALI_ACTOR_POSES) {
    const frame = sheet.frames[missing];
    delete sheet.frames[missing];
    const r = setup();
    r.cast("special");
    try {
      assert.equal(
        drawAliSpecial(
          new Proxy(
            {},
            {
              get() {
                throw Error("partial special");
              },
            },
          ) as CanvasRenderingContext2D,
          { [sheet.file]: { width: 2560, height: 1024 } as HTMLImageElement },
          r.source,
          177,
        ),
        false,
      );
    } finally {
      sheet.frames[missing] = frame;
    }
  }
  for (const image of [
    undefined,
    { width: 0, height: 1024 },
    { width: 2560, height: 1024, naturalWidth: 0, naturalHeight: 0 },
    { width: 100, height: 100 },
  ])
    assert.equal(
      hasAttackArt(
        image ? { [sheet.file]: image as HTMLImageElement } : {},
        "ali",
        ALI_POSES,
      ),
      false,
    );
});
test("live Alí serializes and resumes identically through all three contacts and release", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.cast("super");
    r.advance(8 + 30);
    const clone = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 180; n++) {
      stepMatch(clone, r.inputs);
      r.advance(1);
      assert.deepEqual(clone, r.state);
    }
  }
});

test("Alí original four-string and synthetic choir score is deterministic, finite, stereo and non-clipping", () => {
  const rate = 12000,
    left = new Float32Array(rate * 3),
    right = new Float32Array(rate * 3),
    copyL = new Float32Array(rate * 3),
    copyR = new Float32Array(rate * 3);
  writeFinaleMusic(left, right, rate, "ali");
  writeFinaleMusic(copyL, copyR, rate, "ali");
  assert.deepEqual(left, copyL);
  assert.deepEqual(right, copyR);
  assert.notDeepEqual(left, right);
  assert.ok(left.some((n) => n !== 0));
  for (const n of [...left, ...right])
    assert.ok(Number.isFinite(n) && Math.abs(n) < 1);
});
