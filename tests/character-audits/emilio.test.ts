import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Emilio", fighter: "emilio" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "emilio-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "emilio", check, evidence: value })); }
test("Doble interpretación performs two stationary melee pulses against idle and directional guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 80); const origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const specials = new Map<number, { call: number; attackTick: number; direction: number | undefined }>();
    const blocks = new Set<number>(); const impacts: { call: number; attackTick: number; hp: number }[] = [];
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy; close(energyAfterCost, 75);
    for (let n = 1; n <= 90; n++) {
      if (n > 1) { const hp = r.rival.hp; r.advance(1); if (r.rival.hp !== hp) impacts.push({ call: n, attackTick: r.player.attackTick, hp: r.rival.hp }); }
      assert.equal(r.state.projectiles.length, 0);
      for (const e of r.state.effects) {
        if (e.kind === "special" && e.owner === side && !specials.has(e.id)) specials.set(e.id, { call: n, attackTick: r.player.attackTick, direction: e.direction });
        if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      }
    }
    const pulses = [...specials.values()].slice(1);
    assert.equal(specials.size, 3); assert.deepEqual(pulses.map(p => p.attackTick), [8, 24]);
    assert.ok(pulses.every(p => p.direction === (side === 0 ? 1 : -1)));
    assert.equal(r.player.x, origin); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 2); assert.equal(r.player.hits, 0); assert.equal(impacts.length, 0); }
    else { close(r.rival.hp, 79.606); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); assert.deepEqual(impacts.map(i => i.call), [8, 27]); }
    emit("special", { side, guard, energyAfterCost, pulses, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits, attackerEnergy: r.player.energy, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("echo first-pulse and extended second-pulse reach are measured on both sides", () => {
  for (const side of [0, 1] as const) for (const [gap, expectedHits] of [[140, 2], [150, 1], [180, 1], [219, 1], [220, 0], [240, 0]] as const) {
    const r = setup(side, gap); r.inputs[side].actions.special++; const impacts: { call: number; attackTick: number; hp: number }[] = [];
    for (let n = 0; n < 90; n++) { const hp = r.rival.hp; r.advance(1); if (r.rival.hp !== hp) impacts.push({ call: n + 1, attackTick: r.player.attackTick, hp: r.rival.hp }); }
    assert.equal(r.player.hits, expectedHits); close(r.rival.hp, 100 - expectedHits * 10 * 0.99 * 1.03);
    if (expectedHits === 1) assert.deepEqual(impacts.map(i => i.attackTick), [24]);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, impacts, playerX: r.player.x, targetX: r.rival.x });
  }
});
