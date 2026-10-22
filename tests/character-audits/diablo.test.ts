import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Diablo", fighter: "diablo" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "diablo-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "diablo", check, evidence: value })); }
test("Fogonazo del llano arcs, connects directly or explodes at floor once, with front/rear guards and both sides", () => {
  for (const side of [0, 1] as const) for (const mode of ["direct", "floor"] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const gap = mode === "direct" ? 80 : guard === "rear" ? 350 : 410;
    const r = setup(side, gap);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const origin = r.player.x, shots = new Map<number, unknown>(), impacts: unknown[] = [], blocks = new Set<number>();
    const blasts = new Map<number, unknown>(), trace: unknown[] = [];
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 130; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) {
        if (!shots.has(p.id)) shots.set(p.id, { tick:r.state.tick-INTRO_TOTAL_TICKS, x:p.x, y:p.y, vx:p.vx, vy:p.vy??0, damage:p.damage, kind:p.kind, gravity:p.gravity, blastRadius:p.blastRadius });
        if ([1,10,19,30,44].includes(p.age??0)) trace.push({ tick:r.state.tick-INTRO_TOTAL_TICKS, age:p.age??0, x:p.x,y:p.y,vy:p.vy??0 });
      }
      if(r.rival.hp!==hp) impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,hp:r.rival.hp,x:r.rival.x,vx:r.rival.vx});
      for(const e of r.state.effects) {
        if(e.kind==="block" && e.owner===side) blocks.add(e.id);
        if(e.kind==="special" && e.owner===side && e.strength===1.5 && !blasts.has(e.id)) blasts.set(e.id,{tick:r.state.tick-INTRO_TOTAL_TICKS,x:e.x,y:e.y});
      }
    }
    assert.equal(r.state.projectiles.length,0); assert.equal(r.player.x,origin);
    assert.equal(blasts.size,1); assert.ok(shots.size<=1);
    if(mode==="floor") { assert.equal(shots.size,1); assert.ok(trace.length>=4); assert.ok([...blasts.values()].every(b=>(b as {y:number}).y>=WORLD.floor-20)); }
    if(guard==="front") {assert.equal(r.rival.hp,100);assert.equal(r.player.hits,0);assert.equal(blocks.size,1);}
    else {close(r.rival.hp,81.4394);assert.equal(r.player.hits,1);assert.equal(impacts.length,1);assert.equal(blocks.size,0);}
    emit("special",{side,mode,guard,gap,origin,shots:[...shots.values()],trace,impacts,blasts:[...blasts.values()],blockCount:blocks.size,hp:r.rival.hp,hits:r.player.hits,targetX:r.rival.x});
  }
  for(const side of [0,1] as const) for(const energy of [24,25]) {const r=setup(side);r.player.energy=energy;r.inputs[side].actions.special++;r.advance(1);assert.equal(r.player.attack,energy===24?null:"special");if(energy===25)close(r.player.energy,0.035);emit("special-energy-gate",{side,energy,attack:r.player.attack});}
});
