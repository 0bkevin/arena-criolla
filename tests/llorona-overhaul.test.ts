import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";

import { ATTACK_ART } from "../src/game/attack-art";
import { writeFinaleMusic } from "../src/game/finale-sounds";
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

test("original synthesized lament has energy at all arrivals and finite samples", () => {
  const left = new Float32Array(18000),
    right = new Float32Array(18000);
  writeFinaleMusic(left, right, 6000, "llorona");
  assert.ok(left.every(Number.isFinite));
  assert.ok(right.every(Number.isFinite));
  for (const beat of finaleById("llorona")!.cueBeats!)
    assert.ok(
      left.slice(beat * 100, beat * 100 + 1000).some((n) => Math.abs(n) > 0.01),
    );
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

import {
  drawLloronaSpecial,
  lloronaSpecialPose,
} from "../src/game/finales/llorona";

test("special never draws incomplete art or an attack pose during hitstun", () => {
  const r = setup(0);
  r.inputs[0].actions.special++;
  r.advance(15);
  assert.equal(lloronaSpecialPose(15), "embrace-low");
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw Error("painting forbidden");
      },
    },
  ) as CanvasRenderingContext2D;
  assert.equal(drawLloronaSpecial(forbidden, {}, r.source, 177), false);
  r.source.stun = 3;
  assert.equal(
    drawLloronaSpecial(
      forbidden,
      {
        [ATTACK_ART.llorona.file]: {
          width: 1024,
          height: 2048,
          complete: true,
        } as HTMLImageElement,
      },
      r.source,
      177,
    ),
    false,
  );
});
