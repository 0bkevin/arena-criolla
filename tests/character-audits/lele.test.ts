import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 201, wins = 3) {
  const configs = [{ name: "Audit Lele", fighter: "lele" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lele-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "lele", check, evidence: value })); }
test("Broma resbalosa plants before arming, hits once, blocks front guard and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side); const direction = side === 0 ? 1 : -1, origin = r.player.x;
    r.inputs[1 - side].block = guard === "front"; r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    const shots = new Set<number>(), blocks = new Set<number>(), trace: unknown[] = []; let minY = WORLD.floor;
    for (let call = 2; call <= 170; call++) {
      // Turn the rear guard away immediately before arming, without walking outside the trap's footprint.
      if (guard === "rear" && call === 35) { r.inputs[1 - side].block = true; r.inputs[1 - side][side === 0 ? "right" : "left"] = true; }
      r.advance(1); minY = Math.min(minY, r.player.y);
      for (const p of r.state.projectiles) shots.add(p.id);
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      if ([9, 10, 16, 26, 27, 35, 36, 60].includes(call)) trace.push({ call, tick: r.state.tick - INTRO_TOTAL_TICKS, x: r.player.x, y: r.player.y, vx: r.player.vx, hp: r.rival.hp, shots: r.state.projectiles.map(p => ({ x: p.x, age: p.age ?? 0, vx: p.vx, life: p.life })) });
      if (call === 9) assert.equal(r.state.projectiles.length, 0);
      if (call === 10) { const p = r.state.projectiles[0]!; assert.equal(p.kind, "prank"); assert.equal(p.age, 1); assert.equal(p.vx, 9 * direction); close(p.x, origin + 57 * direction); close(p.damage, 10.92); }
      if (call === 27) { const p = r.state.projectiles[0]!; assert.equal(p.age, 18); assert.equal(p.vx, 0); close(p.x, origin + 201 * direction); assert.equal(p.y, WORLD.floor - 42); }
      if (call === 35) { assert.equal(r.rival.hp, 100); assert.equal(r.state.projectiles[0]!.age, 26); }
      if (call === 36) { assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.hits, guard === "front" ? 0 : 1); }
    }
    assert.equal(shots.size, 1); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x - origin) * direction < -79 && (r.player.x - origin) * direction > -81); assert.ok(Math.abs(r.player.vx) < 1e-6);
    close(minY, 532.3999999999999); assert.equal(r.player.grounded, true); assert.equal(r.player.stocks, 2);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); }
    else { close(r.rival.hp, 88.7524); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, origin, finalX: r.player.x, minY, hp: r.rival.hp, hits: r.player.hits, blockCount: blocks.size, trace });
  }
});

test("Lele enforces special energy, jump avoidance and the planted footprint on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const energy of [24, 25]) { const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); }
    const jump = setup(side); jump.inputs[side].actions.special++; jump.advance(29); jump.inputs[1 - side].actions.jump++; jump.advance(7);
    assert.equal(jump.rival.grounded, false); assert.equal(jump.rival.hp, 100); assert.equal(jump.state.projectiles[0]!.age, 27);
    jump.inputs[1 - side][side === 0 ? "right" : "left"] = true; jump.advance(40); jump.inputs[1 - side].left = false; jump.inputs[1 - side].right = false; jump.advance(100);
    assert.equal(jump.rival.hp, 100); assert.equal(jump.player.hits, 0); assert.equal(jump.state.projectiles.length, 0);
    emit("jump-avoidance", { side, targetX: jump.rival.x, hp: jump.rival.hp, hits: jump.player.hits });
    for (const gap of [80, 159, 160, 201, 242, 243, 420]) { const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(170); assert.equal(r.player.hits, gap >= 160 && gap <= 242 ? 1 : 0); assert.equal(r.state.projectiles.length, 0); emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits }); }
  }
});
