import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch } from "./helpers/charged-finale-engine";
import { TECHNIQUES } from "../shared/techniques";
function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "La Llorona", fighter: "llorona" as const, wins };
  const rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * 180;
  target.facing = -source.facing;
  source.energy = energy;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}

test("special respects front guard, misses height, obeys energy and loses startup to a real hit", () => {
  for (const side of [0, 1] as const) {
    const guard = setup(side);
    guard.inputs[1 - side].block = true;
    guard.inputs[side].actions.special++;
    guard.advance(110);
    assert.equal(guard.target.hp, 100);
    assert.equal(guard.source.hits, 0);
    const high = setup(side);
    high.target.y = 100;
    high.target.grounded = false;
    high.target.vy = -15;
    high.inputs[side].actions.special++;
    high.advance(40);
    assert.equal(high.target.hp, 100);
    const low = setup(side, 3, 24);
    low.inputs[side].actions.special++;
    low.advance(18);
    assert.equal(low.state.projectiles.length, 0);
    assert.equal(low.source.attack, null);
    const interrupted = setup(side);
    interrupted.target.x =
      interrupted.source.x + interrupted.source.facing * 60;
    interrupted.inputs[side].actions.special++;
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(30);
    assert.ok(interrupted.source.hp < 100);
    assert.equal(interrupted.state.projectiles.length, 0);
    assert.equal(interrupted.target.hp, 100);
  }
});

test("undertow and finale remain identical after network serialization", () => {
  for (const action of ["special", "super"] as const)
    for (const side of [0, 1] as const) {
      const r = setup(side);
      r.inputs[side].actions[action]++;
      r.advance(action === "special" ? 24 : 39);
      const copy = JSON.parse(JSON.stringify(r.state));
      for (let n = 0; n < 220; n++) {
        r.advance(1);
        stepMatch(copy, [...r.inputs]);
      }
      assert.deepEqual(copy, r.state);
    }
});
test("undertow launches from the low hands at tick15, travels, pulls once and expires", () => {
  assert.equal(TECHNIQUES.undertow.startup, 15);
  assert.equal(TECHNIQUES.undertow.projectile?.pulls, true);
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.x = r.source.x + r.source.facing * 280;
    r.inputs[side].actions.special++;
    r.advance(14);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    r.advance(1);
    assert.equal(r.state.projectiles.length, 1);
    const wave = r.state.projectiles[0];
    assert.equal(wave.kind, "undertow");
    assert.equal(wave.pulls, true);
    const direction = r.source.facing;
    let contacts = 0,
      previous = 100;
    for (let tick = 0; tick < 130; tick++) {
      r.advance(1);
      if (r.target.hp < previous) {
        contacts++;
        assert.equal(Math.sign(r.target.vx), -direction);
      }
      previous = r.target.hp;
    }
    assert.equal(contacts, 1);
    assert.equal(r.source.hits, 1);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.source.attack, null);
  }
});

import { drawLloronaSpecial, lloronaSpecialPose } from "../src/game/finales/llorona";
