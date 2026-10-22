import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Danny", fighter: "danny" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "danny-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "danny", check, evidence: value })); }
test("Onda Reflexa launches one slow growing bubble, hits idle/rear guard and obeys front guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1-side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1-side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick:number; vx:number; damage:number; radius:number; kind:string }>();
    const impacts: {tick:number;hp:number;gap:number}[] = [], blocks = new Set<number>();
    const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy; close(energyAfterCost,75);
    for (let n=1;n<170;n++) {
      const hp=r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) {
        if (!shots.has(p.id)) shots.set(p.id,{tick:r.state.tick-INTRO_TOTAL_TICKS,vx:p.vx,damage:p.damage,radius:p.radius??0,kind:p.kind});
        assert.ok((p.radius??0)>=12 && (p.radius??0)<=48);
      }
      if(hp!==r.rival.hp) impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,hp:r.rival.hp,gap:Math.abs(r.rival.x-r.player.x)});
      for(const e of r.state.effects) if(e.kind==="block" && e.owner===side) blocks.add(e.id);
    }
    assert.equal(shots.size,1); const shot=[...shots.values()][0];
    assert.equal(shot.tick,19); assert.equal(shot.vx,side===0?4.8:-4.8); close(shot.damage,14.4); close(shot.radius,12.65); assert.equal(shot.kind,"crescendo");
    assert.equal(r.player.x,origin); assert.equal(r.state.projectiles.length,0); assert.equal(r.player.attack,null);
    if(guard==="front") {assert.equal(r.rival.hp,100);assert.equal(blocks.size,1);assert.equal(r.player.hits,0);}
    else {close(r.rival.hp,85.168);assert.equal(r.player.hits,1);assert.equal(blocks.size,0);}
    emit("special",{side,guard,energyAfterCost,shot,impacts,blocks:blocks.size,hp:r.rival.hp,hits:r.player.hits,attackerEnergy:r.player.energy,targetEnergy:r.rival.energy});
  }
  for(const side of [0,1] as const) for(const energy of [24,25]) {
    const r=setup(side);r.player.energy=energy;r.inputs[side].actions.special++;r.advance(1);
    assert.equal(r.player.attack,energy===24?null:"special");if(energy===25) close(r.player.energy,0.035);
    assert.equal(r.state.projectiles.length,0);
  }
});

test("sound bubble grows to radius 48, stays bounded and expires after 100 updates with no target collision", () => {
  for(const side of [0,1] as const) {
    const r=setup(side,720),origin=r.player.x; const trace:{tick:number;age:number;radius:number;x:number;life:number}[]=[]; r.inputs[side].actions.special++;
    for(let n=0;n<140;n++) {
      r.advance(1);
      for(const p of r.state.projectiles) {
        assert.equal(p.y,WORLD.floor-75);assert.equal(p.vy,0);assert.equal(p.vx,side===0?4.8:-4.8);
        close(p.radius??0,Math.min(48,12+(p.age??0)*0.65));
        close(p.x,origin+(side===0?1:-1)*(48+4.8*(p.age??0)));
        if([1,20,55,56,75,99].includes(p.age??0)) trace.push({tick:r.state.tick-INTRO_TOTAL_TICKS,age:p.age??0,radius:p.radius??0,x:p.x,life:p.life});
      }
      if(n+1===118) assert.equal(r.state.projectiles.length,0);
    }
    assert.equal(trace.length,6);close(trace[2].radius,47.75);assert.equal(trace[3].radius,48);assert.equal(trace[5].life,1);assert.equal(r.rival.hp,100);assert.equal(r.player.hits,0);
    emit("bounded-growth",{side,trace,expiredAtTick:118,targetHp:r.rival.hp});
  }
});
