import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit George", fighter: "george" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "george-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "george", check, evidence: value })); }
test("Remate en dos tiempos emits two increasing-range melee pulses and checks idle/front/rear guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 120);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const impacts: { tick: number; attackTick: number; hp: number; gap: number }[] = [];
    const blocks = new Set<number>(), pulses = new Map<number, { tick: number; attackTick: number }>();
    const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 90; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, gap: Math.abs(r.rival.x-r.player.x) });
      for (const e of r.state.effects) {
        if (e.kind === "block" && e.owner === side) blocks.add(e.id);
        if (e.kind === "special" && e.owner === side && Math.abs(e.x - (origin + r.player.facing * 35)) < 1e-8 && !pulses.has(e.id)) pulses.set(e.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick });
      }
      assert.equal(r.state.projectiles.length, 0);
    }
    assert.equal(pulses.size, 2); assert.deepEqual([...pulses.values()].map(p=>p.attackTick), [14,30]);
    assert.equal(r.player.x, origin); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 2); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 77.958); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, pulses:[...pulses.values()], impacts, blockCount:blocks.size, hp:r.rival.hp, hits:r.player.hits });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); }
});

test("George second pulse reaches targets outside his first pulse and range limits remain strict", () => {
  for (const side of [0, 1] as const) for (const gap of [80,120,180,190,220,279,280,320]) {
    const r = setup(side,gap); r.inputs[side].actions.special++; const impacts: unknown[]=[];
    for (let n=0;n<90;n++) { const hp=r.rival.hp; r.advance(1); if(hp!==r.rival.hp) impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,attackTick:r.player.attackTick,hp:r.rival.hp,gap:Math.abs(r.rival.x-r.player.x)}); }
    if(gap>=190 && gap<280) { assert.equal(r.player.hits,1); close(r.rival.hp,88.979); }
    if(gap>=280) { assert.equal(r.player.hits,0); assert.equal(r.rival.hp,100); }
    emit("range-probe",{side,gap,hits:r.player.hits,hp:r.rival.hp,impacts});
  }
});
