import assert from "node:assert/strict";
import test from "node:test";
import { type FighterId } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "./helpers/charged-finale-engine";

import { lorenzoSpecialPose } from "../src/game/finales/lorenzo";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Lorenzo", fighter: "lorenzo" as const, wins: 3 },
    b = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [b, a] : [a, b]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
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
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("live Polar convoy serializes and resumes identically through impact and ordinary release", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.cast("super");
    r.advance(8 + 75);
    const replay = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 140; n++) {
      stepMatch(replay, r.inputs);
      r.advance(1);
      assert.deepEqual(replay, r.state);
    }
  }
});

test("three P.A.N. bags launch from the hand and hit at close range, block, miss and interrupt", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "close", "guard", "miss", "interrupt"]) {
      const r = setup(
        side,
        mode === "close"
          ? 55
          : mode === "interrupt"
            ? 65
            : mode === "miss"
              ? 900
              : 180,
      );
      r.source.config.wins = 0;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      const ids = new Set<number>();
      let slowed = false;
      for (let n = 1; n <= 120; n++) {
        r.advance(1);
        if (n === 1) assert.equal(r.source.energy, 75);
        r.state.projectiles.forEach((s) => ids.add(s.id));
        slowed ||= r.target.slowTicks > 0;
      }
      if (mode === "hit" || mode === "close") {
        assert.ok(r.target.hp < 100, mode);
        assert.ok(r.source.hits >= 1);
        assert.ok(slowed);
      }
      if (["guard", "miss", "interrupt"].includes(mode))
        assert.equal(r.target.hp, 100, mode);
      if (mode === "interrupt") assert.equal(ids.size, 0);
      else if (mode !== "close") assert.equal(ids.size, 3);
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.source.attack, null);
    }
  const r = setup(0, 450);
  r.inputs[0].actions.special++;
  r.advance(14);
  assert.equal(r.state.projectiles.length, 0);
  r.advance(1);
  assert.equal(r.state.projectiles.length, 3);
  for (const [n, shot] of r.state.projectiles.entries()) {
    assert.equal(shot.x, r.source.x + 36 + 8);
    close(shot.y, r.source.y - 107 + (n - 1) * 1.6);
    assert.equal(shot.kind, "polar");
    assert.equal(shot.radius, 16);
  }
  assert.equal(lorenzoSpecialPose(10), "windup");
  assert.equal(lorenzoSpecialPose(14), "throw");
  assert.equal(lorenzoSpecialPose(23), "recover");
  assert.equal(lorenzoSpecialPose(43), undefined);
});

test("P.A.N. cost failure and serialized in-flight replay preserve deterministic engine rules", () => {
  for (const side of [0, 1] as const) {
    const poor = setup(side);
    poor.source.energy = 24;
    poor.inputs[side].actions.special++;
    poor.advance(25);
    assert.equal(poor.source.attack, null);
    assert.equal(poor.target.hp, 100);
    const r = setup(side, 450);
    r.cast("special");
    r.advance(25);
    const copy = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      stepMatch(copy, r.inputs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(copy)),
        JSON.parse(JSON.stringify(r.state)),
      );
    }
  }
});
