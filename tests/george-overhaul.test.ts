import assert from "node:assert/strict";
import test from "node:test";
import { type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, type Input, type MatchState } from "./helpers/charged-finale-engine";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "George", fighter: "george" as const, wins: 3 },
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

test("special preserves two contact beats, increasing reach, guard and recovery in both slots", () => {
  for (const side of [0, 1] as const)
    for (const gap of [55, 120, 220, 279, 280, 420])
      for (const guard of [false, true]) {
        const r = setup(side, gap);
        r.inputs[1 - side].block = guard;
        r.cast("special");
        const impacts: number[] = [];
        for (let n = 1; n < 100; n++) {
          const hp = r.target.hp;
          r.advance(1);
          if (r.target.hp < hp) impacts.push(r.source.attackTick);
        }
        assert.equal(r.source.attack, null);
        assert.equal(r.state.projectiles.length, 0);
        assert.ok(impacts.every((t) => t === 14 || t === 30));
        if (guard || gap >= 280) assert.deepEqual(impacts, []);
        if (!guard && gap >= 190 && gap < 280) assert.deepEqual(impacts, [30]);
        if (!guard && gap === 120) assert.deepEqual(impacts, [14, 30]);
      }
});

test("special startup interruption and energy gate do not emit pulses; live curtain replays after JSON serialization", () => {
  for (const side of [0, 1] as const) {
    const low = setup(side);
    low.source.energy = 24;
    low.inputs[side].actions.special++;
    low.advance(60);
    assert.equal(low.source.hits, 0);
    assert.equal(low.source.attack, null);
    const r = setup(side, 65);
    r.inputs[1 - side].actions.light++;
    r.advance(3);
    r.cast("special");
    r.advance(80);
    assert.equal(r.source.hits, 0);
    assert.equal(r.target.hp, 100);
    const f = setup(side);
    f.cast("super");
    f.advance(8 + 80);
    const copy: MatchState = JSON.parse(JSON.stringify(f.state));
    for (let n = 0; n < 150; n++) {
      f.advance(1);
      stepMatch(copy, f.inputs);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(f.state)), copy);
  }
});
