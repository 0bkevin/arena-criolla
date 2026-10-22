import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Rummy", fighter: "rummy" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "rummy-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "rummy", check, evidence: value })); }
test("Zapateo spends 25 energy, emits four pulses, advances, and obeys directional guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 180);
    r.inputs[1-side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1-side][side === 0 ? "right" : "left"] = true;
    const origin = r.player.x, pulses = new Map<number, number>(), blocks = new Set<number>();
    const impacts: {call:number; tick:number; attackTick:number; hp:number; vx:number; vy:number}[] = [];
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n=1; n<90; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const e of r.state.effects) if (e.owner === side) {
        if (e.kind === "special" && e.y === WORLD.floor-5 && !pulses.has(e.id)) pulses.set(e.id, r.player.attackTick);
        if (e.kind === "block") blocks.add(e.id);
      }
      if (hp !== r.rival.hp) impacts.push({call:n+1,tick:r.state.tick-INTRO_TOTAL_TICKS,attackTick:r.player.attackTick,hp:r.rival.hp,vx:r.rival.vx,vy:r.rival.vy});
    }
    assert.deepEqual([...pulses.values()], [9,19,29,39]);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x-origin)*(side===0?1:-1) > 100); assert.ok(Math.abs(r.player.vx)<1e-6);
    if (guard === "front") { assert.equal(r.rival.hp,100); assert.equal(r.player.hits,0); assert.equal(blocks.size,3); }
    else { assert.ok(r.player.hits >= 1); assert.equal(blocks.size,0); }
    emit("special", {side,guard,pulses:[...pulses.values()],impacts,blocks:blocks.size,hits:r.player.hits,hp:r.rival.hp,origin,finalX:r.player.x});
  }
  for (const side of [0,1] as const) for(const energy of [24,25]) {
    const r=setup(side); r.player.energy=energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack,energy===24?null:"special"); if(energy===25)close(r.player.energy,0.035);
  }
});

test("all four close-range grounded zapateo pulses connect and the final step applies force8 on both sides", () => {
  for(const side of [0,1] as const) {
    const r=setup(side,80); r.inputs[side].actions.special++;
    const pulses:number[] = [], impactTicks:number[] = [], effects = new Set<number>();
    const trace:unknown[]=[];
    for(let n=0;n<90;n++) {
      const before={attackTick:r.player.attackTick,hp:r.rival.hp,grounded:r.rival.grounded,invincible:r.rival.invincible,x:r.player.x,targetX:r.rival.x};
      r.advance(1);
      if(r.rival.hp!==before.hp) {impactTicks.push(r.player.attackTick); trace.push({call:n+1,...before,attackTick:r.player.attackTick,hp:r.rival.hp,vx:r.rival.vx,vy:r.rival.vy});}
      for(const e of r.state.effects)if(e.owner===side&&e.kind==="special"&&e.y===WORLD.floor-5&&!effects.has(e.id)){effects.add(e.id);pulses.push(r.player.attackTick); if(r.rival.hp===before.hp)trace.push({call:n+1,...before,attackTick:r.player.attackTick,hp:r.rival.hp});}
    }
    emit("four-step-contact",{side,pulses,impactTicks,hits:r.player.hits,hp:r.rival.hp,trace});
    assert.deepEqual(pulses,[9,19,29,39]);
    assert.deepEqual(impactTicks,[9,19,29,39], "each grounded in-range pulse, including the finisher, must connect");
    close(r.rival.hp,100-4*5*0.97*1.03);
    assert.equal(r.player.hits,4);
  }
});

test("actor and target grounded requirements independently reject a jump on each pulse, and isolated finisher has force8", () => {
  for(const side of [0,1] as const) for(const pulse of [9,19,29,39]) for(const jumping of ["none","actor","target"] as const) {
    const r=setup(side,500); r.inputs[side].actions.special++;
    while(r.player.attackTick<pulse-1)r.advance(1);
    r.rival.x=r.player.x+(side===0?80:-80); r.rival.vx=0;
    if(jumping!=="none")r.inputs[jumping==="actor"?side:1-side].actions.jump++;
    r.advance(1);
    assert.equal(r.player.attackTick,pulse);
    if(jumping==="none") {
      close(r.rival.hp,100-5*0.97*1.03); assert.equal(r.player.hits,1);
      close(Math.abs(r.rival.vx),(pulse===39?8:2.5)*(1+(100-r.rival.hp)/90));
      close(r.rival.vy,-(pulse===39?8:2.5)*0.65+0.52);
    }else {assert.equal(r.rival.hp,100); assert.equal(r.player.hits,0); assert.equal((jumping==="actor"?r.player:r.rival).grounded,false);}
    emit("grounded-and-finisher",{side,pulse,jumping,hp:r.rival.hp,hits:r.player.hits,actorY:r.player.y,targetY:r.rival.y,vx:r.rival.vx,vy:r.rival.vy});
  }
});
