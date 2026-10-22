import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Nacho", fighter: "nacho" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "nacho-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "nacho", check, evidence: value })); }
test("Paso sincopado executes its forward, retreat and aerial finisher pulses against idle/front/rear guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 120); const origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const impacts: unknown[] = [], blocks = new Set<number>(), trace: unknown[] = [];
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy;
    close(energyAfterCost, 75);
    for (let n = 1; n < 110; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp !== hp) impacts.push({ call: n + 1, tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, dx: r.rival.x - r.player.x, forceVx: r.rival.vx });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      if (r.player.attack && [7, 21, 35, 49].includes(r.player.attackTick) && r.state.hitstop === 0) trace.push({ call: n + 1, attackTick: r.player.attackTick, x: r.player.x, vx: r.player.vx, y: r.player.y, grounded: r.player.grounded, dash: r.player.dash });
    }
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x - origin) * (side === 0 ? 1 : -1) > 100);
    assert.ok(Math.abs(r.player.vx) < 1e-6);
    assert.equal(trace.length, 3);
    const steps = trace as { attackTick: number; vx: number; grounded: boolean }[];
    assert.deepEqual(steps.map(step => step.attackTick), [7, 21, 35]);
    assert.deepEqual(steps.map(step => step.vx), (side === 0 ? [14, -10, 17] : [-14, 10, -17]));
    assert.equal(steps[2].grounded, false);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 3); }
    else { close(r.rival.hp, guard === "idle" ? 88.258 : 94.129); assert.equal(r.player.hits, guard === "idle" ? 2 : 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, origin, energyAfterCost, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits, finalX: r.player.x, trace });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035);
  }
});
