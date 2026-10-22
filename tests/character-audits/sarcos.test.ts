import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Sarcos", fighter: "sarcos" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "sarcos-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "sarcos", check, evidence: value })); }
test("Premio sensacional emits one prize, hits idle and rear guard, and respects front guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Set<number>();
    let firstShot: { tick: number; vx: number; vy: number; damage: number; kind: string; bounces: number } | null = null;
    let collisionTick = 0;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 130; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) {
        shots.add(p.id);
        if (!firstShot) firstShot = { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, vy: p.vy ?? 0, damage: p.damage, kind: p.kind, bounces: p.bounces ?? 0 };
      }
      if (r.state.effects.some(e => e.owner === side && (e.kind === "hit" || e.kind === "block"))) { collisionTick = r.state.tick - INTRO_TOTAL_TICKS; break; }
    }
    assert.equal(shots.size, 1); assert.ok(firstShot);
    assert.equal(firstShot.tick, 18); assert.equal(firstShot.vx, side === 0 ? 6 : -6);
    close(firstShot.vy, -5.65); close(firstShot.damage, 16.32); assert.equal(firstShot.kind, "jackpot"); assert.equal(firstShot.bounces, 2);
    assert.ok(collisionTick > 18); assert.equal(r.state.projectiles.length, 0);
    close(r.rival.hp, guard === "front" ? 100 : 100 - 16 * 1.02 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    assert.ok(r.state.effects.some(e => e.kind === (guard === "front" ? "block" : "hit") && e.impact === "special"));
    r.advance(30); assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    emit("special-contact", { side, guard, firstShot, collisionTick, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("the prize completes exactly two floor bounces and one terminal explosion without a target", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 830); r.inputs[side].actions.special++;
    const bounces: { tick: number; age: number; x: number; y: number; vy: number; remaining: number }[] = [];
    let previousBounces = 2;
    for (let n = 0; n < 118; n++) {
      r.advance(1); const shot = r.state.projectiles[0];
      if (shot && (shot.bounces ?? 0) < previousBounces) { previousBounces = shot.bounces ?? 0; bounces.push({tick: r.state.tick - INTRO_TOTAL_TICKS, age: shot.age ?? 0, x: shot.x, y: shot.y, vy: shot.vy ?? 0, remaining: previousBounces}); }
    }
    assert.deepEqual(bounces.map(b => ({tick:b.tick,age:b.age,remaining:b.remaining})), [{tick:58,age:41,remaining:1},{tick:93,age:76,remaining:0}]);
    assert.ok(bounces.every(b => b.vy < 0 && b.y === WORLD.floor - 21));
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    const blasts = r.state.effects.filter(e => e.kind === "special" && e.owner === side && e.strength === 1.5);
    assert.equal(blasts.length, 1); close(blasts[0].x, side === 0 ? 834 : 246); close(blasts[0].y, 534.484375);
    emit("two-bounce-expiry", {side,bounces,expiryTick:r.state.tick-INTRO_TOTAL_TICKS,blast:blasts[0]});
  }
});

test("the terminal prize blast obeys directional guards and does not hit twice", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, guard === "rear" ? 550 : 720);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(118);
    assert.equal(r.state.projectiles.length, 0);
    close(r.rival.hp, guard === "front" ? 100 : 100 - 16 * 1.02 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    assert.ok(r.state.effects.some(e => e.kind === "special" && e.strength === 1.5));
    assert.ok(r.state.effects.some(e => e.kind === (guard === "front" ? "block" : "hit") && e.owner === side));
    const hp = r.rival.hp; r.advance(10); close(r.rival.hp, hp);
    emit("blast-guard", {side,guard,tick:118,hp,hits:r.player.hits,x:r.rival.x});
  }
});
