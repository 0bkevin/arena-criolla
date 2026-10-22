import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [{ name: "Audit Lila", fighter: "lila" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lila-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "lila", check, evidence })); }
test("Abanico del cocotero emits five distinct trajectories, costs 25, hits idle/rear guard and is blocked by front guard on both sides", () => {
  const mirrored: Record<string, unknown> = {};
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280); r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const emissions = new Map<number, { tick: number; vx: number; vy: number; damage: number; life: number; kind: string }>();
    const impacts: { tick: number; hp: number; vx: number }[] = [], blocks = new Set<number>();
    const origin = r.player.x; r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 140; n++) {
      const before = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!emissions.has(p.id)) emissions.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, vy: p.vy ?? 0, damage: p.damage, life: p.life, kind: p.kind });
      if (before !== r.rival.hp) { impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx }); assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1); }
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    const shots = [...emissions.values()]; assert.equal(shots.length, 5);
    assert.deepEqual(shots.map(p => p.vy), [-4.4, -2.2, 0, 2.2, 4.4]);
    assert.ok(shots.every(p => p.tick === 16 && p.vx === (side === 0 ? 7 : -7) && p.damage === 6.48 && p.life === 41 && p.kind === "cocotero"));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.ok(blocks.size > 0); }
    else { assert.ok(r.rival.hp < 100); assert.ok(r.player.hits > 0); assert.equal(blocks.size, 0); }
    const result = { hp: r.rival.hp, hits: r.player.hits, blocks: blocks.size, impactTicks: impacts.map(p => p.tick) };
    if (side === 0) mirrored[guard] = result; else assert.deepEqual(result, mirrored[guard]);
    emit("special", { side, guard, origin, targetStart: origin + (side === 0 ? 280 : -280), shots, impacts, ...result });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});
