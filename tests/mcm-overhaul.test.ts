import assert from "node:assert/strict";
import test from "node:test";
import { type FighterId } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Mcm", fighter: "mcm" as const, wins: 3 },
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

test("rally damages once only within physical dash contact, including the278/279 boundary", () => {
  for (const side of [0, 1] as const)
    for (const gap of [140, 278, 279, 300, 345]) {
      const r = setup(side, gap);
      r.cast("special");
      const impacts: number[] = [];
      let hp = r.target.hp;
      for (let tick = 2; tick <= 80; tick++) {
        r.advance(1);
        if (r.target.hp < hp) impacts.push(tick);
        hp = r.target.hp;
      }
      assert.deepEqual(impacts, gap === 140 ? [13] : gap === 278 ? [23] : []);
      assert.equal(r.source.hits, gap <= 278 ? 1 : 0);
      assert.equal(r.source.attack, null);
      assert.equal(r.state.projectiles.length, 0);
    }
});

test("live caravan serializes and resumes identically through impact and ordinary release", () => {
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
