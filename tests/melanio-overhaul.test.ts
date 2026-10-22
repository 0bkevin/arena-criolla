import assert from "node:assert/strict";
import test from "node:test";
import { type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, type Input, type MatchState } from "./helpers/charged-finale-engine";
import { melanioSpecialPose } from "../src/game/finales/melanio";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Melanio", fighter: "melanio" as const, wins: 3 },
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

test("live phone finale serializes and resumes identically through impact and ordinary release", () => {
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

test("signal preserves real release21, recovery29, return leg, guard, miss and interruption in both seats", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "guard", "miss", "interrupt"]) {
      const r = setup(
        side,
        mode === "miss" ? 600 : mode === "interrupt" ? 65 : 180,
      );
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.heavy++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      const shots = new Set<number>();
      let returned = false;
      for (let n = 1; n <= 100; n++) {
        r.advance(1);
        for (const p of r.state.projectiles) {
          shots.add(p.id);
          returned ||= (p.age ?? 0) >= (p.returnAfter ?? Infinity);
        }
        if (n === 20 && mode !== "interrupt") assert.equal(shots.size, 0);
        if (n === 21 && mode !== "interrupt") assert.equal(shots.size, 1);
      }
      assert.equal(shots.size, mode === "interrupt" ? 0 : 1);
      if (mode === "hit") assert.ok(r.target.hp < 100);
      else assert.equal(r.target.hp, 100);
      if (mode === "miss") assert.ok(returned);
      assert.equal(r.source.attack, null);
      assert.equal(r.state.projectiles.length, 0);
    }
  assert.equal(melanioSpecialPose(20), "signal-windup");
  assert.equal(melanioSpecialPose(21), "signal-release");
  assert.equal(melanioSpecialPose(28), "signal-release");
  assert.equal(melanioSpecialPose(29), undefined);
});
