import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Tío Conejo", fighter: "tioconejo" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "tioconejo-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 360 : 720;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "tioconejo", check, evidence: value })); }
test("Tío Conejo manual dash mirrors direction, stops, and returns to ready stance",()=>{
  for(const side of [0,1] as const){
    const r=setup(side,450),origin=r.player.x;r.inputs[side].actions.dash++;r.advance(1);
    assert.equal(r.player.vx,side===0?14:-14);assert.equal(r.player.dash,12);assert.equal(r.player.invincible,8);assert.equal(r.player.cooldown,30);
    r.advance(40);assert.equal(r.player.dash,0);assert.equal(r.player.invincible,0);assert.equal(r.player.cooldown,0);assert.ok(Math.abs(r.player.vx)<0.001);assert.equal(r.player.attack,null);
    emit("manual-dash",{side,origin,finalX:r.player.x,vx:r.player.vx,facing:r.player.facing});
  }
});
test("Brinco tramposo retreats with one carrot, single damage and directional guard on both sides", () => {
  for(const side of [0,1] as const)for(const guard of ["idle","front","rear"] as const){
    const r=setup(side,280), origin=r.player.x, shots=new Map<number,unknown>(), impacts:unknown[]=[],blocks=new Set<number>(),trace:unknown[]=[];
    r.inputs[1-side].block=guard!=="idle";
    if(guard==="rear")r.inputs[1-side][side===0?"right":"left"]=true;
    r.inputs[side].actions.special++;r.advance(1);close(r.player.energy,75);
    for(let n=1;n<140;n++){
      const hp=r.rival.hp;r.advance(1);
      for(const p of r.state.projectiles)if(!shots.has(p.id))shots.set(p.id,{tick:r.state.tick-INTRO_TOTAL_TICKS,x:p.x,y:p.y,vx:p.vx,vy:p.vy,life:p.life,age:p.age,bounces:p.bounces,damage:p.damage});
      if(hp!==r.rival.hp)impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,hp:r.rival.hp,hits:r.player.hits});
      for(const e of r.state.effects)if(e.kind==="block"&&e.owner===side)blocks.add(e.id);
      if([9,18,30,60].includes(n+1))trace.push({tick:r.state.tick-INTRO_TOTAL_TICKS,x:r.player.x,y:r.player.y,vx:r.player.vx,vy:r.player.vy,dash:r.player.dash,attackTick:r.player.attackTick});
    }
    assert.equal(shots.size,1);assert.equal(r.state.projectiles.length,0);assert.equal(r.player.stocks,2);assert.equal(r.player.grounded,true);
    assert.ok((r.player.x-origin)*(side===0?1:-1)<-100);assert.ok(Math.abs(r.player.x-origin)<160);assert.ok(Math.abs(r.player.vx)<0.001);
    if(guard==="front"){assert.equal(r.rival.hp,100);assert.equal(r.player.hits,0);assert.equal(blocks.size,1);}
    else{close(r.rival.hp,89.1232);assert.equal(r.player.hits,1);assert.equal(impacts.length,1);assert.equal(blocks.size,0);}
    emit("special",{side,guard,shots:[...shots.values()],impacts,blocks:blocks.size,origin,finalX:r.player.x,finalY:r.player.y,trace,hits:r.player.hits,hp:r.rival.hp});
  }
});

test("an unobstructed grounded carrot bounces once and retires on second ground contact before its 70-frame cap",()=>{
  for(const side of [0,1] as const){
    const r=setup(side,500),origin=r.player.x,trace:unknown[]=[],ids=new Set<number>();let bounceCount=0,previousBounce=1,lastAge=0,lastLife=70,minimumY=WORLD.floor,firstTick=0,lastTick=0;
    r.rival.invincible=1000;r.inputs[side].actions.special++;
    for(let n=0;n<100;n++){
      r.advance(1);minimumY=Math.min(minimumY,r.player.y);
      for(const p of r.state.projectiles){
        ids.add(p.id);if(!firstTick)firstTick=r.state.tick-INTRO_TOTAL_TICKS;lastTick=r.state.tick-INTRO_TOTAL_TICKS;lastAge=p.age??0;lastLife=p.life;
        if((p.bounces??0)<previousBounce){bounceCount++;assert.ok((p.vy??0)<0);close(p.y,WORLD.floor-21);trace.push({tick:lastTick,age:p.age,x:p.x,y:p.y,vy:p.vy,life:p.life,bounces:p.bounces});}
        previousBounce=p.bounces??0;
      }
    }
    assert.equal(ids.size,1);assert.equal(firstTick,9);assert.equal(bounceCount,1);assert.equal(lastAge,58);assert.equal(lastLife,12);assert.equal(r.state.projectiles.length,0);assert.equal(r.player.hits,0);assert.equal(r.rival.hp,100);
    assert.ok(minimumY<WORLD.floor-50);assert.equal(r.player.grounded,true);assert.ok(Math.abs(r.player.x-origin)<160);
    emit("bounce-lifetime",{side,origin,finalX:r.player.x,minimumY,firstTick,lastTick,lastAge,lastLife,bounceCount,trace});
  }
});

test("a carrot emitted from height reaches its full 70-frame lifetime cap",()=>{
  for(const side of [0,1] as const){
    const r=setup(side,500);r.player.y=200;r.player.grounded=false;r.player.supportPlatform=null;r.rival.invincible=1000;
    r.inputs[side].actions.special++;let lastAge=0,lastLife=70,firstTick=0,lastTick=0,bounces=0,previousBounce=1;const ids=new Set<number>();
    for(let n=0;n<100;n++){
      r.advance(1);for(const p of r.state.projectiles){ids.add(p.id);if(!firstTick)firstTick=r.state.tick-INTRO_TOTAL_TICKS;lastTick=r.state.tick-INTRO_TOTAL_TICKS;lastAge=p.age??0;lastLife=p.life;if((p.bounces??0)<previousBounce)bounces++;previousBounce=p.bounces??0;}
    }
    assert.equal(ids.size,1);assert.equal(firstTick,9);assert.equal(lastAge,69);assert.equal(lastLife,1);assert.equal(lastTick,77);assert.equal(bounces,1);assert.equal(r.state.projectiles.length,0);assert.equal(r.player.hits,0);
    emit("airborne-lifetime",{side,firstTick,lastTick,lastAge,lastLife,bounces});
  }
});

test("carrot jump avoidance and aerial contact depend on actual trajectory",()=>{
  for(const side of [0,1] as const)for(const jumpAt of [0,10,15,20,25,30]){
    const r=setup(side,280);r.inputs[side].actions.special++;const impacts:unknown[]=[];
    for(let n=0;n<120;n++){if(n===jumpAt)r.inputs[1-side].actions.jump++;const hp=r.rival.hp;r.advance(1);if(hp!==r.rival.hp)impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,targetY:r.rival.y,grounded:r.rival.grounded,hp:r.rival.hp});}
    assert.equal(r.player.hits,jumpAt<=25?0:1);assert.equal(r.state.projectiles.length,0);
    emit("jump-probe",{side,jumpAt,hits:r.player.hits,hp:r.rival.hp,impacts});
  }
});

test("trickster energy gate and backward lift/brake hold on both sides",()=>{
  for(const side of [0,1] as const)for(const energy of [24,25,100]){
    const r=setup(side,500);r.player.energy=energy;r.inputs[side].actions.special++;r.advance(1);
    assert.equal(r.player.attack,energy<25?null:"special");if(energy<25)continue;
    r.advance(8);assert.equal(r.player.attackTick,9);assert.equal(r.player.dash,9);assert.equal(r.player.vx,side===0?-12:12);close(r.player.vy,-7.48);assert.equal(r.player.grounded,false);assert.equal(r.player.invincible,4);
    r.advance(9);assert.equal(r.player.dash,0);close(r.player.vx,side===0?-9.6:9.6);
    r.advance(90);assert.equal(r.player.grounded,true);assert.ok(Math.abs(r.player.vx)<0.001);
    emit("energy-lift-brake",{side,energy,finalX:r.player.x,finalY:r.player.y,vx:r.player.vx});
  }
});
