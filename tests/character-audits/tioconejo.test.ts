import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture } from "../../shared/choreography";

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

test("Tío Conejo identity, one-shot selection and both facings match the preserved dossier", () => {
  const f = fighterById("tioconejo"), profile = presentationById("tioconejo");
  assert.equal(f.name,"Tío Conejo"); assert.equal(f.ability,"trickster"); assert.equal(f.special,"Brinco tramposo");
  assert.deepEqual(f.combos,["Patas ligeras","Finta del camino","La última picardía"]);
  assert.equal(TECHNIQUES.trickster.startup,9); assert.deepEqual(TECHNIQUES.trickster.dash,{speed:-12,ticks:9,invincibility:4,lift:-8,brake:0.8});
  assert.deepEqual(TECHNIQUES.trickster.projectile,{speed:10,life:70,initialVy:-1,gravity:0.24,bounces:1});
  assert.equal(profile.introStyle,"hop");assert.equal(profile.battleFrame,0);
  assert.equal(selectionProgress("tioconejo",2800),1);assert.equal(selectionProgress("tioconejo",5600),1);
  for(const beats of [profile.introBeats,profile.selectionBeats])assert.deepEqual(samplePose(beats,1),samplePose(beats,2));
  for(const selection of [false,true])assert.deepEqual(sampleGesture("tioconejo",1,selection),sampleGesture("tioconejo",2,selection));
  for(let frame=0;frame<8;frame++)for(const facing of [1,-1])assert.equal(normalizedFacing("tioconejo",frame,facing),facing);
  emit("presentation",{intro:profile.introName,choreography:CHOREOGRAPHIES.tioconejo.name,finalFrame:samplePose(profile.introBeats,1).frame});
});

test("Tío Conejo walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    const start = r.player.x;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > start + 90); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 90); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Tío Conejo manual dash mirrors direction, stops, and returns to ready stance",()=>{
  for(const side of [0,1] as const){
    const r=setup(side,450),origin=r.player.x;r.inputs[side].actions.dash++;r.advance(1);
    assert.equal(r.player.vx,side===0?14:-14);assert.equal(r.player.dash,12);assert.equal(r.player.invincible,8);assert.equal(r.player.cooldown,30);
    r.advance(40);assert.equal(r.player.dash,0);assert.equal(r.player.invincible,0);assert.equal(r.player.cooldown,0);assert.ok(Math.abs(r.player.vx)<0.001);assert.equal(r.player.attack,null);
    emit("manual-dash",{side,origin,finalX:r.player.x,vx:r.player.vx,facing:r.player.facing});
  }
});

test("Tío Conejo light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.88 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
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

test("Tío Conejo recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Finta del camino" : "Patas ligeras"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.88 + (wins ? 7 : 3)) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0);
      const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) {
          const dx = r.rival.x - r.player.x;
          r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1);
        }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8);
        r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Finta del camino" : "Patas ligeras");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 90], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "La última picardía"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 62.2608); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Tío Conejo intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Tío Conejo", fighter: "tioconejo", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].right = true; inputs[0].actions.special++;
  const start = state.players[0].x;
  for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
  assert.equal(state.phase, "intro"); assert.equal(state.players[0].x, start); assert.equal(state.projectiles.length, 0);
  stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
});

function cpuFight() {
  const r = setup(0, 420, 3); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = n < 350 && Math.abs(dx) < 620 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 620 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < 120 || r.player.x > 960) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Tío Conejo fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
