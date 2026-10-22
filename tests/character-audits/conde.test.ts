import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Conde", fighter: "conde" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "conde-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "conde", check, evidence: value })); }
test("Remate oriental spends 25 energy, dashes forward and hits once against idle/rear guard while facing guard blocks on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 120);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const origin = r.player.x, impacts: unknown[] = [], blocks = new Set<number>();
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy;
    close(energyAfterCost, 75);
    const trace: unknown[] = [];
    for (let n = 1; n < 110; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, gap: r.rival.x - r.player.x });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      if ([13, 14, 20, 23, 35, 60, 109].includes(n+1)) trace.push({ call: n+1, x: r.player.x, vx: r.player.vx, attackTick: r.player.attackTick, dash: r.player.dash });
    }
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x - origin) * (side === 0 ? 1 : -1) > 80);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 77.34); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, energyAfterCost, impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, origin, finalX: r.player.x, trace });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) { const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); assert.equal(r.state.projectiles.length, 0); }
});
