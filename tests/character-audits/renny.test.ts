import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Renny", fighter: "renny" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "renny-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "renny", check, evidence: value })); }
test("En cadena emits two projectiles, hits idle twice, respects forward guard and defeats backward guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const projectiles = new Map<number, { tick: number; vx: number; damage: number; kind: string }>();
    const impacts: { tick: number; hp: number; energy: number; hits: number }[] = [];
    const blocks = new Set<number>();
    const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy;
    close(energyAfterCost, 75);
    for (let n = 1; n < 170; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!projectiles.has(p.id)) projectiles.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, damage: p.damage, kind: p.kind });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, energy: r.rival.energy, hits: r.player.hits });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(projectiles.size, 2);
    // Hitstop freezes attack frames; rear guard changes arrival time by moving away.
    const emissions = [...projectiles.values()]; assert.equal(emissions[0].tick, 10); assert.ok(emissions[1].tick >= 26);
    assert.ok(emissions.every(p => p.vx === (side === 0 ? 7.5 : -7.5) && p.kind === "broadcast" && p.damage === 8));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 2); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 83.52); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, energyAfterCost, emissions, impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, attackerEnergy: r.player.energy, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});
