import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

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

test("Rummy retains her dossier identity, four advancing grounded pulses, one-shot selection and both facings", () => {
  const f = fighterById("rummy");
  assert.equal(f.name, "Rummy Olivo"); assert.equal(f.ability, "zapateo"); assert.equal(f.special, "Zapateo llanero");
  assert.deepEqual(f.combos, ["Paso de sabana", "Flor de ritmo", "Zapateo final"]);
  const t = TECHNIQUES.zapateo;
  assert.deepEqual(t.pulses, [0, 10, 20, 30]); assert.equal(t.startup, 9); assert.equal(t.recovery, 46);
  assert.equal(t.groundOnly, true); assert.equal(t.radial, true); assert.equal(t.finisherForce, 8);
  assert.equal(t.dash?.speed, 6); assert.equal(t.dash?.ticks, 24); assert.equal(t.dash?.brake, 0.65);
  assert.equal(presentationById("rummy").introStyle, "defiant"); assert.equal(presentationById("rummy").selectionStyle, "defiant");
  assert.equal(presentationById("rummy").battleFrame, 1);
  assert.equal(selectionProgress("rummy", 2800), 1); assert.equal(selectionProgress("rummy", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("rummy", frame, facing), facing);
  emit("presentation", { intro: presentationById("rummy").introName, choreography: CHOREOGRAPHIES.rummy.name });
});

test("Rummy walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Rummy light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.97 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

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

test("Rummy recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Flor de ritmo" : "Paso de sabana"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.97 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Flor de ritmo" : "Paso de sabana");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 90], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Zapateo final"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 59.6652); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Rummy intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Rummy", fighter: "rummy", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
      const action = Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 200 && Math.abs(dx) > 140 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Rummy fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
