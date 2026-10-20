import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";

import { writeFinaleMusic } from "../src/game/finale-sounds";
import { drawDudamelProjectile } from "../src/game/finales/dudamel";
function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Dudamel", fighter: "dudamel" as const, wins };
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

test("special travels before damaging, grows to 64 and never reflects", () => {
  assert.equal(TECHNIQUES.cadenza.reflect, undefined);
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.x = r.source.x + r.source.facing * 350;
    r.inputs[side].actions.special++;
    r.advance(17);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    r.advance(1);
    const shot = r.state.projectiles[0];
    assert.ok(shot);
    assert.equal(shot.kind, "cadenza");
    assert.equal(shot.radius, 24.65);
    assert.equal(r.target.hp, 100);
    const firstX = shot.x;
    r.advance(15);
    assert.ok(Math.abs(shot.x - firstX) > 100);
    assert.ok(shot.radius! > 33);
    assert.equal(r.target.hp, 100);
    for (let i = 0; i < 50 && r.target.hp === 100; i++) r.advance(1);
    assert.ok(r.target.hp < 100);
    assert.equal(r.source.hits, 1);
    r.advance(80);
    assert.equal(r.source.hits, 1);
    const miss = setup(side);
    miss.target.invincible = 200;
    miss.inputs[side].actions.special++;
    miss.advance(18);
    const growing = miss.state.projectiles[0];
    miss.advance(62);
    assert.equal(growing.radius, 64);
    miss.advance(15);
    assert.equal(miss.state.projectiles.length, 0);
    assert.equal(miss.target.hp, 100);
  }
});

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

test("Carolina returns Dudamel's growing notes with original identity and damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.config.fighter = "carolina";
    r.target.x = r.source.x + r.source.facing * 280;
    r.inputs[side].actions.special++;
    r.advance(18);
    const shot = r.state.projectiles[0],
      damage = shot.damage;
    assert.ok(shot);
    r.inputs[1 - side].actions.special++;
    let returned = false;
    for (let n = 0; n < 70; n++) {
      r.advance(1);
      if (shot.owner === 1 - side) {
        returned = true;
        assert.equal(shot.kind, "cadenza");
        assert.equal(shot.damage, damage);
      }
    }
    assert.ok(returned);
    assert.ok(r.source.hp < 100);
    assert.equal(r.target.hp, 100);
  }
});

test("cadenza and finale remain identical after network serialization", () => {
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

test("original synthesized orchestra has energy at all arrivals and finite samples", () => {
  const left = new Float32Array(18000),
    right = new Float32Array(18000);
  writeFinaleMusic(left, right, 6000, "dudamel");
  assert.ok(left.every(Number.isFinite));
  assert.ok(right.every(Number.isFinite));
  for (const beat of finaleById("dudamel")!.cueBeats!)
    assert.ok(
      left.slice(beat * 100, beat * 100 + 1000).some((n) => Math.abs(n) > 0.01),
    );
});

test("visible special wave takes radius directly from the physical shot", () => {
  const r = setup(0);
  r.inputs[0].actions.special++;
  r.advance(18);
  const shot = r.state.projectiles[0];
  const radii: number[] = [];
  const ctx = new Proxy(
    {
      globalAlpha: 1,
      arc(_x: number, _y: number, r: number) {
        radii.push(r);
      },
    },
    {
      get(target, key) {
        return key in target ? target[key as keyof typeof target] : () => {};
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  drawDudamelProjectile(ctx, shot);
  assert.equal(radii[0], shot.radius);
  radii.length = 0;
  r.advance(12);
  drawDudamelProjectile(ctx, shot);
  assert.equal(radii[0], shot.radius);
  assert.ok(radii[0] > 24.65);
});
