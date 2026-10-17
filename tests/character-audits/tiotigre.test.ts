import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture } from "../../shared/choreography";

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

test("Tío Tigre retains his researched identity, two claw contacts, one-shot selection and both facings", () => {
  const f = fighterById("tiotigre");
  for(const kind of ["intro","selection"] as const) {
    const beats=kind==="intro"?presentationById("tiotigre").introBeats:presentationById("tiotigre").selectionBeats;
    assert.deepEqual(samplePose(beats,1),samplePose(beats,2));
    assert.deepEqual(sampleGesture("tiotigre",1,kind==="selection"),sampleGesture("tiotigre",2,kind==="selection"));
  }
  assert.equal(f.name, "Tío Tigre"); assert.equal(f.ability, "pounce"); assert.equal(f.special, "Salto de tigre");
  assert.deepEqual(f.combos, ["Zarpazo rápido", "Rayas en cadena", "Dueño del monte"]);
  assert.deepEqual(TECHNIQUES.pounce.pulses, [0, 16]);
  assert.equal(presentationById("tiotigre").introStyle, "pounce");
  assert.equal(presentationById("tiotigre").battleFrame, 0);
  assert.equal(selectionProgress("tiotigre", 2800), 1); assert.equal(selectionProgress("tiotigre", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("tiotigre", frame, facing), facing);
  emit("presentation", { intro: presentationById("tiotigre").introName, choreography: CHOREOGRAPHIES.tiotigre.name });
});

test("Tío Tigre walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Tío Tigre manual dash mirrors direction, stops, and returns to ready stance",()=>{
  for(const side of [0,1] as const){
    const r=setup(side,450),origin=r.player.x;r.inputs[side].actions.dash++;r.advance(1);
    assert.equal(r.player.vx,side===0?14:-14);assert.equal(r.player.dash,12);assert.equal(r.player.invincible,8);assert.equal(r.player.cooldown,30);
    r.advance(40);assert.equal(r.player.dash,0);assert.equal(r.player.invincible,0);assert.equal(r.player.cooldown,0);assert.ok(Math.abs(r.player.vx)<0.001);assert.equal(r.player.attack,null);
    emit("manual-dash",{side,origin,finalX:r.player.x,vx:r.player.vx,facing:r.player.facing});
  }
});

test("Tío Tigre light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.04 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
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

test("pounce range probes measure discrete claw windows, braking and bounded movement", () => {
  for(const side of [0,1] as const)for(const gap of [25,80,140,145,200,300,450]) {
    const r=setup(side,gap),origin=r.player.x,impacts:unknown[]=[];r.inputs[side].actions.special++;
    for(let n=0;n<100;n++){const hp=r.rival.hp;r.advance(1);if(hp!==r.rival.hp)impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,attackTick:r.player.attackTick,hp:r.rival.hp});}
    assert.ok(r.player.hits<=2);assert.equal(r.state.projectiles.length,0);assert.ok(Math.abs(r.player.x-origin)<300);assert.ok(Math.abs(r.player.vx)<0.001);assert.equal(r.player.stocks,2);
    assert.equal(r.player.hits,gap<145?2:gap<450?1:0);
    emit("range-probe",{side,gap,hp:r.rival.hp,hits:r.player.hits,impacts,displacement:r.player.x-origin});
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

test("Tío Tigre recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Rayas en cadena" : "Zarpazo rápido"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 1.04 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Rayas en cadena" : "Zarpazo rápido");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Dueño del monte"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 57.6464); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Tío Tigre intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Tío Tigre", fighter: "tiotigre", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 260 && Math.abs(dx) > 145 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Tío Tigre fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
