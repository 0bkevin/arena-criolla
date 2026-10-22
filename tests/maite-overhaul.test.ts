import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, cpuInput, type Input, type Projectile } from "./helpers/charged-finale-engine";
import { fighterById, type FighterId } from "../shared/content";
function setup(side: 0 | 1 = 0, gap = 430, rival: FighterId = "zavarce") {
  const actor = { name: "Maite", fighter: "maite" as const, wins: 3 },
    other = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [other, actor] : [actor, other]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 900 : 180;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n = 1) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
  };
  return { state, source, target, inputs, advance, start };
}
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const damage = (rival: FighterId = "zavarce") =>
  (28 * 0.94 + 12) * fighterById(rival).armor;

test("a ranged finale spends90 once, travels before contact, hits once and recovers in both slots/directions", () => {
  for (const side of [0, 1] as const)
    for (const gap of [55, 180, 430, 650]) {
      const r = setup(side, gap);
      r.start();
      r.advance();
      close(r.source.energy, 10);
      let count = 0,
        contactFrame = 0,
        prior: Projectile | undefined;
      for (let frame = 2; frame <= 120; frame++) {
        const hp = r.target.hp;
        prior = r.state.projectiles[0] && { ...r.state.projectiles[0] };
        r.advance();
        assert.equal(r.state.finale, undefined);
        if (r.target.hp < hp) {
          count++;
          contactFrame = frame;
          close(hp - r.target.hp, damage());
          assert.ok(frame >= 9);
          if (gap > 55) {
            assert.ok(prior);
            const x = prior!.x + prior!.vx,
              radius = Math.min(52, prior!.radius! + 0.7);
            assert.ok(
              Math.abs(r.target.x - x) < 20 + radius + Math.abs(r.target.vx),
              "damage requires physical wave contact",
            );
          }
        }
      }
      assert.equal(count, 1);
      assert.equal(r.source.hits, 1);
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.source.attack, null);
      assert.equal(r.state.remaining, 120 * 60 - 120);
      assert.equal(r.source.x, side ? 900 : 180);
      if (gap >= 430)
        assert.ok(contactFrame > 25, "distant hit cannot be instantaneous");
    }
});

test("energy, whiff, front/rear guard and invincibility retain actual combat rules", () => {
  for (const side of [0, 1] as const) {
    for (const [wins, energy] of [
      [0, 89],
      [0, 90],
      [1, 100],
      [2, 89],
      [2, 90],
    ]) {
      const r = setup(side);
      r.source.config.wins = wins;
      r.source.energy = energy;
      r.start();
      r.advance(9);
      assert.equal(
        r.state.projectiles.length,
        energy >= 90 ? 1 : 0,
      );
    }
    for (const scenario of ["miss", "front", "rear", "immune"] as const) {
      const r = setup(side, scenario === "miss" ? 900 : 430);
      if (scenario === "front" || scenario === "rear")
        r.inputs[1 - side].block = true;
      if (scenario === "rear")
        r.inputs[1 - side][side ? "left" : "right"] = true;
      if (scenario === "immune") r.target.invincible = 160;
      r.start();
      r.advance(65);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.source.hits, scenario === "rear" ? 1 : 0);
      assert.equal(r.state.projectiles.length, 0);
      if (scenario !== "rear") {
        assert.equal(r.target.hp, 100);
        assert.ok(r.source.energy < 28);
      }
    }
  }
});

test("moving targets change contact timing, double-jumps evade, and falling targets can enter the wave", () => {
  for (const side of [0, 1] as const) {
    const jumping = setup(side);
    jumping.start();
    jumping.inputs[1 - side].actions.jump++;
    jumping.advance(16);
    jumping.inputs[1 - side].actions.jump++;
    jumping.advance(60);
    assert.equal(jumping.target.hp, 100);
    const running = setup(side);
    const startX = running.target.x;
    running.inputs[1 - side][side ? "left" : "right"] = true;
    running.start();
    running.advance(36);
    assert.equal(running.source.hits, 0);
    assert.ok(Math.abs(running.target.x - startX) > 80);
    running.advance(27);
    assert.equal(running.source.hits, 1);
    const falling = setup(side);
    falling.target.y = 390;
    falling.target.grounded = false;
    falling.target.vy = 3;
    falling.start();
    falling.advance(45);
    assert.equal(falling.source.hits, 1);
  }
});

test("startup can be interrupted; an already emitted wave survives interruption and has normal projectile terrain behavior", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 80);
    r.start();
    r.inputs[1 - side].actions.light++;
    r.advance(15);
    assert.equal(r.source.attack, null);
    assert.ok(r.source.hp < 100);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.target.hp, 100);
    const emitted = setup(side, 180);
    emitted.start();
    emitted.advance(9);
    emitted.source.attack = null;
    emitted.source.stun = 30;
    emitted.advance(20);
    assert.equal(emitted.source.hits, 1);
    const air = setup(side, 650);
    air.source.y = 230;
    air.source.grounded = false;
    air.target.y = 554;
    air.start();
    air.advance(9);
    const y = air.state.projectiles[0].y;
    air.advance(20);
    close(air.state.projectiles[0].y, y);
    assert.equal(air.state.projectiles[0].groundOnly, undefined);
    assert.equal(air.source.hits, 0);
  }
});

test("super projectile snapshots outgoing damage and preserves super impact after a real reflector", () => {
  for (const side of [0, 1] as const) {
    const buff = setup(side);
    buff.source.transformation = {
      id: "test",
      ticks: 12,
      damageMultiplier: 1.2,
    };
    buff.start();
    buff.advance(9);
    close(buff.state.projectiles[0].damage, (28 * 0.94 + 12) * 1.2);
    buff.advance(32);
    assert.equal(buff.source.transformation, undefined);
    close(buff.target.hp, 100 - damage() * 1.2);
    const reflected = setup(side, 430, "carolina");
    reflected.start();
    reflected.advance(22);
    reflected.inputs[1 - side].actions.special++;
    const shot = reflected.state.projectiles[0],
      snapshot = shot.damage;
    reflected.advance(12);
    assert.equal(shot.owner, 1 - side);
    assert.equal(shot.impact, "super");
    close(shot.damage, snapshot);
    reflected.advance(35);
    assert.ok(reflected.source.hp < 100);
    assert.equal(reflected.target.hits, 1);
    close(100 - reflected.source.hp, snapshot * 0.99);
  }
});

test("hard CPU chooses the ranged super outside capture range, but gates and recovery prevent repeat casts", () => {
  const r = setup(1, 430);
  r.source.config.wins = 0;
  r.state.tick = 90;
  r.source.energy = 90;
  const ai = cpuInput(r.state, emptyInput(), "hard");
  assert.equal(ai.actions.super, 1);
  r.inputs[1] = ai;
  r.advance(9);
  assert.equal(r.state.projectiles.length, 1);
  r.source.energy = 100;
  r.inputs[1].actions.super++;
  r.advance();
  assert.equal(r.state.projectiles.length, 1);
  assert.ok(r.source.energy > 99);
  for (const wins of [0, 1]) {
    const fresh = setup(1);
    fresh.state.tick = 90;
    fresh.source.config.wins = wins;
    assert.equal(cpuInput(fresh.state, emptyInput(), "hard").actions.super, 1);
  }
  for (const energy of [75, 89]) {
    const poor = setup(1);
    poor.state.tick = 90;
    poor.source.energy = energy;
    assert.equal(cpuInput(poor.state, emptyInput(), "hard").actions.super, 0);
  }
});

function recordingContext(
  width = 1280,
  height = 760,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const calls: { kind: string; args: unknown[] }[] = [];
  let matrix = [scale, 0, 0, scale, offsetX, offsetY],
    alpha = 1;
  const stack: number[][] = [];
  const ctx = new Proxy(
    {
      canvas: { width, height },
      get globalAlpha() {
        return alpha;
      },
      set globalAlpha(a: number) {
        alpha = a;
      },
      getTransform() {
        const [a, b, c, d, e, f] = matrix;
        return { a, b, c, d, e, f };
      },
      save() {
        stack.push([...matrix]);
      },
      restore() {
        matrix = stack.pop()!;
      },
      translate(x: number, y: number) {
        matrix[4] += matrix[0] * x;
        matrix[5] += matrix[3] * y;
      },
      scale(x: number, y: number) {
        matrix[0] *= x;
        matrix[3] *= y;
      },
      drawImage(...args: unknown[]) {
        calls.push({ kind: "image", args: [...args, [...matrix]] });
      },
      roundRect(...args: number[]) {
        calls.push({ kind: "box", args: [...args, [...matrix]] });
      },
      fillText(...args: unknown[]) {
        calls.push({ kind: "text", args });
      },
    },
    {
      get(t, k) {
        return (
          Reflect.get(t, k) ??
          ((...args: unknown[]) => calls.push({ kind: String(k), args }))
        );
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
