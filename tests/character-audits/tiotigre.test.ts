import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Tío Tigre", fighter: "tiotigre" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "tiotigre-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "tiotigre", check, evidence: value })); }
test("Tío Tigre manual dash mirrors direction, stops, and returns to ready stance",()=>{
  for(const side of [0,1] as const){
    const r=setup(side,450),origin=r.player.x;r.inputs[side].actions.dash++;r.advance(1);
    assert.equal(r.player.vx,side===0?14:-14);assert.equal(r.player.dash,12);assert.equal(r.player.invincible,8);assert.equal(r.player.cooldown,30);
    r.advance(40);assert.equal(r.player.dash,0);assert.equal(r.player.invincible,0);assert.equal(r.player.cooldown,0);assert.ok(Math.abs(r.player.vx)<0.001);assert.equal(r.player.attack,null);
    emit("manual-dash",{side,origin,finalX:r.player.x,vx:r.player.vx,facing:r.player.facing});
  }
});
test("Salto de tigre uses offensive lift and two claw contacts with directional guard on both sides", () => {
  for (const side of [0,1] as const) for (const guard of ["idle","front","rear"] as const) {
    const r=setup(side,100), origin=r.player.x, impacts:{tick:number;attackTick:number;hp:number;x:number;targetX:number;y:number;targetY:number}[]=[], blocks=new Set<number>(), trace:unknown[]=[];
    r.inputs[1-side].block=guard!=="idle";
    if(guard==="rear") r.inputs[1-side][side===0?"right":"left"]=true;
    r.inputs[side].actions.special++;r.advance(1);close(r.player.energy,75);
    for(let n=1;n<100;n++) {
      const hp=r.rival.hp;r.advance(1);
      if(r.rival.hp!==hp)impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,attackTick:r.player.attackTick,hp:r.rival.hp,x:r.player.x,targetX:r.rival.x,y:r.player.y,targetY:r.rival.y});
      for(const e of r.state.effects)if(e.kind==="block"&&e.owner===side)blocks.add(e.id);
      if([8,15,16,24,35,43,60].includes(r.player.attackTick)&&r.player.attack)trace.push({tick:r.state.tick-INTRO_TOTAL_TICKS,attackTick:r.player.attackTick,x:r.player.x,vx:r.player.vx,y:r.player.y,vy:r.player.vy,dash:r.player.dash});
    }
    assert.equal(r.state.projectiles.length,0);assert.equal(r.player.dash,0);assert.ok(Math.abs(r.player.vx)<0.001);
    assert.ok(Math.abs(r.player.x-origin)<300);assert.equal(r.player.stocks,2);
    if(guard==="front") {assert.equal(r.rival.hp,100);assert.equal(r.player.hits,0);assert.equal(blocks.size,2);}
    else {close(r.rival.hp,82.8608);assert.equal(r.player.hits,2);assert.equal(impacts.length,2);assert.deepEqual(impacts.map(i=>i.attackTick),[8,24]);assert.equal(blocks.size,0);}
    emit("special",{side,guard,origin,impacts,blockCount:blocks.size,trace,finalX:r.player.x,finalY:r.player.y,targetHp:r.rival.hp,hits:r.player.hits});
  }
});
test("pounce energy gate and dash lift/brake values hold on both sides",()=>{
  for(const side of [0,1] as const)for(const energy of [24,25,100]){
    const r=setup(side,450);r.player.energy=energy;r.inputs[side].actions.special++;r.advance(1);
    assert.equal(r.player.attack,energy<25?null:"special");
    if(energy<25)continue;
    r.advance(7);assert.equal(r.player.attackTick,8);assert.equal(r.player.dash,8);assert.equal(r.player.vx,side===0?18:-18);close(r.player.vy,-8.48);assert.equal(r.player.grounded,false);
    r.advance(8);assert.equal(r.player.dash,0);close(r.player.vx,side===0?14.4:-14.4);
    r.advance(60);assert.equal(r.player.grounded,true);assert.ok(Math.abs(r.player.vx)<0.001);
    emit("energy-lift-brake",{side,energy,finalX:r.player.x,finalY:r.player.y,vx:r.player.vx});
  }
});
