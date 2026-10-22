import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 200, wins = 3) {
  const configs = [
    { name: "Audit Puma", fighter: "puma" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "puma-v28-audit");
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
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "puma", check, evidence })); }
test("Rugido del Puma hits once at startup16, blocks front guard, defeats rear guard and obeys energy gate on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 200); const origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    r.advance(14); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    r.advance(1); const hit = { tick: r.state.tick, hp: r.rival.hp, vx: r.rival.vx, vy: r.rival.vy, energy: r.rival.energy };
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.x, origin);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.ok(r.state.effects.some(e => e.kind === "block" && e.impact === "special")); }
    else { close(r.rival.hp, 100 - 16 * 1.12 * 1.03); assert.equal(r.player.hits, 1); assert.ok(r.rival.vy < 0); }
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    r.advance(40); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.player.attack, null); assert.equal(r.player.cooldown, 0);
    emit("special", { side, guard, positions: [origin, origin + (side === 0 ? 200 : -200)], energyAfterCost: 75, hit, hpAt56Calls: r.rival.hp, hits: r.player.hits, targetX: r.rival.x, attackerEnergy: r.player.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.player.hits, 0); }
});

test("Puma forward roar range is exclusive at260 and misses a rival behind the locked facing", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 200, 259, 260, 280]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(16);
    assert.equal(r.player.hits, gap < 260 ? 1 : 0);
    emit("range", { side, gap, hp: r.rival.hp, hits: r.player.hits, targetX: r.rival.x });
  }
  for (const side of [0, 1] as const) {
    const r = setup(side, 80); r.inputs[side].actions.special++; r.advance(1);
    r.rival.x = r.player.x + (side === 0 ? -80 : 80); r.advance(15);
    assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100);
    emit("rear-target", { side, attackerX: r.player.x, targetX: r.rival.x, lockedFacing: r.player.facing, hits: r.player.hits });
  }
});
