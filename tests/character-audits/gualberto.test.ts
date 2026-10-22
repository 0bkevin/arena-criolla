import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Gualberto", fighter: "gualberto" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "gualberto-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "gualberto", check, evidence: value })); }
test("Tremolo oriental emits paired separated notes, lands against idle/rear guards and blocks twice at forward guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 120); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? 120 : -120);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { call: number; vx: number; vy: number; y: number; damage: number }>();
    const impacts: unknown[] = [], blocks = new Set<number>(); const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let call = 2; call <= 120; call++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { call, vx: p.vx, vy: p.vy ?? 0, y: p.y, damage: p.damage });
      if (r.rival.hp < hp) impacts.push({ call, tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 2); const notes = [...shots.values()];
    assert.ok(notes.every(p => p.call === 10 && p.vx === (side === 0 ? 7.5 : -7.5)));
    assert.deepEqual(notes.map(p => p.vy), [-1.5, 1.5]); close(notes[1].y - notes[0].y, 3);
    assert.ok(notes.every(p => p.damage === 9 * 0.98));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 2); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 81.8308); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); }
    emit("special-outbound", { side, guard, notes, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035);
  }
});

test("both notes reverse horizontally at age22 while their vertical paths continue apart and expire at age64", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? 280 : -280);
    r.inputs[side].actions.special++; r.advance(10); assert.equal(r.state.projectiles.length, 2);
    const direction = side === 0 ? 1 : -1, origin = r.player.x;
    r.advance(20); const before = r.state.projectiles.map(p => ({ age: p.age, x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    assert.ok(before.every(p => p.age === 21 && p.vx === direction * 7.5));
    close(before[0].x, origin + direction * 205.5); close(before[1].y - before[0].y, 63);
    r.advance(1); const after = r.state.projectiles.map(p => ({ age: p.age, x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    assert.ok(after.every(p => p.age === 22 && p.vx === direction * -7.5));
    close(after[0].x, origin + direction * 198); close(after[1].y - after[0].y, 66);
    assert.deepEqual(after.map(p => p.vy), [-1.5, 1.5]);
    r.advance(41); assert.ok(r.state.projectiles.every(p => p.age === 63)); r.advance(1); assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.rival.hp, 100); assert.equal(r.player.x, origin);
    emit("paired-return-path", { side, before, after, expiredCall: 73, hp: r.rival.hp });
  }
});

test("returning notes strike a jumping rival and guard direction follows the incoming return on both sides", () => {
  for (const side of [0, 1] as const) {
    const jump = setup(side, 120); jump.player.x = side === 0 ? 360 : 720; jump.rival.x = jump.player.x + (side === 0 ? 120 : -120);
    jump.inputs[1 - side].actions.jump++; jump.inputs[side].actions.special++;
    const impacts: unknown[] = [];
    for (let call = 1; call <= 120; call++) { const hp = jump.rival.hp; jump.advance(1); if (jump.rival.hp < hp) { assert.equal(Math.sign(jump.rival.vx), side === 0 ? -1 : 1); impacts.push({ call, hp: jump.rival.hp, y: jump.rival.y, vx: jump.rival.vx }); } }
    assert.equal(jump.player.hits, 1); close(jump.rival.hp, 90.9154); emit("jump-return", { side, impacts });
    for (const guard of ["idle", "toward-actor", "toward-return"] as const) {
      const r = setup(side, 120); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? 120 : -120);
      // Isolate inbound collisions with the engine's normal invulnerability timer.
      r.rival.invincible = 32; r.inputs[1 - side].block = guard !== "idle";
      if (guard === "toward-return") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      r.inputs[side].actions.special++; const hits: unknown[] = [], blocks = new Set<number>();
      for (let call = 1; call <= 120; call++) { const hp = r.rival.hp; r.advance(1); if (r.rival.hp < hp) { assert.equal(Math.sign(r.rival.vx), side === 0 ? -1 : 1); hits.push({ call, tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx }); } for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id); }
      if (guard === "toward-return") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 2); }
      else { close(r.rival.hp, 81.8308); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); }
      emit("return-guard", { side, guard, hits, blocks: blocks.size });
    }
  }
});

test("tremolo range probes distinguish two close hits, one midrange hit and the horizontal return boundary", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 120, 180, 220, 247, 248, 280, 380]) {
    const r = setup(side, gap); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? gap : -gap);
    r.inputs[side].actions.special++; r.advance(120);
    assert.equal(r.player.hits, gap <= 120 ? 2 : gap <= 247 ? 1 : 0);
    close(r.rival.hp, 100 - r.player.hits * 9 * 0.98 * 1.03); assert.equal(r.player.stocks, 2); assert.equal(r.rival.stocks, 2);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits });
  }
});
