import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";

import {
  drawDudamelFinale,
  drawDudamelProjectile,
  DUDAMEL_POSES,
} from "../src/game/finales/dudamel";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";
import { writeFinaleMusic } from "../src/game/finale-sounds";
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

test("Dudamel orchestra finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("dudamel")!.damageBeats;
    assert.equal(beats.length, 3);
    const positions = run.state.players.map((p) => [p.x, p.y]);
    const clock = run.state.tick;
    const timer = run.state.remaining;
    let last = 0;
    for (const [i, beat] of beats.entries()) {
      run.advance(beat - last - 1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * i) / 3)) < 1e-9,
      );
      run.advance(1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * (i + 1)) / 3)) < 1e-9,
      );
      assert.deepEqual(
        run.state.players.map((p) => [p.x, p.y]),
        positions,
      );
      assert.equal(run.state.tick, clock);
      assert.equal(run.state.remaining, timer);
      assert.equal(run.state.projectiles.length, 0);
      last = beat;
    }
    run.inputs[side].actions.special++;
    run.advance(scene.duration - last);
    assert.equal(run.state.finale, undefined);
    assert.equal(run.source.attack, null);
    assert.equal(run.target.stocks, 2);
    assert.equal(run.target.y, WORLD.floor);
    assert.equal(Math.sign(run.target.vx), side ? -1 : 1);
    run.advance(55);
    assert.equal(
      run.state.projectiles.length,
      0,
      "input during capture never queues a summon",
    );
    assert.equal(run.source.attack, null);
  }
});

test("Dudamel definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
  for (const side of [0, 1] as const) {
    for (const [wins, energy] of [
      [0, 100],
      [2, 100],
      [3, 74],
    ]) {
      const run = setup(side, wins, energy);
      run.inputs[side].actions.super++;
      run.advance(9);
      assert.equal(run.state.finale, undefined);
      assert.equal(run.target.hp, 100);
      assert.ok(run.source.energy >= energy);
    }
    for (const defense of ["behind", "guard"] as const) {
      const run = setup(side);
      if (defense === "guard") run.inputs[1 - side].block = true;
      run.inputs[side].actions.super++;
      run.advance(1);
      if (defense === "behind") run.source.facing *= -1;
      run.advance(8);
      assert.equal(run.state.finale, undefined);
      assert.equal(run.target.hp, 100);
    }
    const run = setup(side);
    run.target.hp = 1;
    run.target.stocks = 1;
    run.inputs[side].actions.super++;
    run.advance(9 + 42);
    assert.equal(run.target.hp, 0);
    assert.equal(run.target.stocks, 1);
    assert.equal(run.state.phase, "playing");
    run.advance(180 - 42);
    assert.equal(run.target.stocks, 0);
    assert.equal(run.state.phase, "finished");
    assert.equal(run.state.winner, side);
  }
});

test("Dudamel's miss and interrupted startup never start the performance or drain remote health", () => {
  for (const side of [0, 1] as const) {
    const miss = setup(side);
    miss.target.x = miss.source.x + miss.source.facing * 360;
    miss.inputs[side].actions.super++;
    miss.advance(50);
    assert.equal(miss.state.finale, undefined);
    assert.equal(miss.target.hp, 100);
    assert.equal(miss.source.attack, null);
    const interrupted = setup(side);
    interrupted.target.x =
      interrupted.source.x + interrupted.source.facing * 60;
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(3);
    interrupted.inputs[side].actions.super++;
    interrupted.advance(30);
    assert.equal(interrupted.state.finale, undefined);
    assert.equal(interrupted.target.hp, 100);
    assert.ok(interrupted.source.hp < 100);
  }
});

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
  for (const beat of [42, 90, 138])
    assert.ok(
      left.slice(beat * 100, beat * 100 + 1000).some((n) => Math.abs(n) > 0.01),
    );
});

test("preflight refuses every missing pose before any canvas or actor operation", () => {
  const sheet = ATTACK_ART.dudamel;
  for (const pose of DUDAMEL_POSES) {
    const old = sheet.frames[pose];
    delete sheet.frames[pose];
    try {
      const forbidden = () => {
        throw Error("paint before preflight");
      };
      const view = {
        images: { [sheet.file]: { width: 1536, height: 1985, complete: true } },
        ctx: new Proxy({}, { get: forbidden }),
        body: forbidden,
        art: forbidden,
        point: forbidden,
      } as unknown as FinaleView;
      assert.equal(drawDudamelFinale(view), false);
    } finally {
      sheet.frames[pose] = old;
    }
  }
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
