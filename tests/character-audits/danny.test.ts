import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture, REST } from "../../shared/choreography";

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

test("Danny retains his researched identity, bounded growing sound bubble, one-shot selection and both facings", () => {
  const f = fighterById("danny");
  assert.equal(f.name, "Danny Ocean"); assert.equal(f.ability, "crescendo"); assert.equal(f.special, "Onda Reflexa");
  assert.deepEqual(f.combos, ["Pulso suave", "Cambio de marea", "Onda Reflexa"]);
  assert.equal(TECHNIQUES.crescendo.startup, 19); assert.deepEqual(TECHNIQUES.crescendo.projectile, {speed:4.8,life:100,radius:12,growth:0.65,maxRadius:48});
  assert.equal(presentationById("danny").introStyle, "defiant");
  assert.equal(presentationById("danny").battleFrame, 1);
  assert.equal(selectionProgress("danny", 2800), 1); assert.equal(selectionProgress("danny", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("danny", frame, facing), facing);
  const profile = presentationById("danny"); assert.deepEqual(samplePose(profile.selectionBeats, 1), samplePose(profile.selectionBeats, 2)); assert.equal(samplePose(profile.selectionBeats, 1).frame, 1); for(const kind of [false,true]) { const end=sampleGesture("danny", 1, kind); for(const key of Object.keys(REST) as (keyof typeof REST)[]) assert.equal(end[key], 0); }
  emit("presentation", { intro: presentationById("danny").introName, choreography: CHOREOGRAPHIES.danny.name });
});

test("Danny walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Danny light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.96 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

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

test("growing bubble range probes exercise close contact and actual maximum reach on both sides", () => {
  for(const side of [0,1] as const) for(const gap of [25,80,120,280,520,590,600,720]) {
    const r=setup(side,gap);r.inputs[side].actions.special++;const impacts:unknown[]=[];
    for(let n=0;n<140;n++){const hp=r.rival.hp;r.advance(1);if(hp!==r.rival.hp)impacts.push({tick:r.state.tick-INTRO_TOTAL_TICKS,hp:r.rival.hp});}
    assert.equal(r.player.hits,gap<=590?1:0);assert.equal(r.state.projectiles.length,0);
    emit("range-probe",{side,gap,hits:r.player.hits,hp:r.rival.hp,impacts});
  }
});

test("Danny recognizes both combos from zero wins, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, "Cambio de marea"); assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 0.96 + 7) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, 0);
      const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) {
          const dx = r.rival.x - r.player.x;
          r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1);
        }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8);
        r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Cambio de marea" : "Pulso suave");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 90], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Onda Reflexa"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 59.9536); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Danny intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Danny", fighter: "danny", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].right = true; inputs[0].actions.special++;
  const start = state.players[0].x;
  for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
  assert.equal(state.phase, "intro"); assert.equal(state.players[0].x, start); assert.equal(state.projectiles.length, 0);
  stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
});

function cpuFight() {
  const r = setup(0, 420, 3); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  // Exercise the special explicitly; later AI choices depend on arena geometry.
  r.inputs[0].actions.special++;
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 620 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < WORLD.left + 50 || r.player.x > WORLD.right - 50) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Danny fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
