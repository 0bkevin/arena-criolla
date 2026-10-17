import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Nacho", fighter: "nacho" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "nacho-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "nacho", check, evidence: value })); }

test("Nacho retains his researched identity, three syncopated steps, one-shot selection and both facings", () => {
  const f = fighterById("nacho");
  assert.equal(f.name, "Nacho"); assert.equal(f.ability, "syncopate"); assert.equal(f.special, "Paso sincopado");
  assert.deepEqual(f.combos, ["Paso primero", "Contratiempo", "Remate de tarima"]);
  assert.deepEqual(TECHNIQUES.syncopate.pulses, [0, 14, 28]);
  assert.equal(TECHNIQUES.syncopate.dash?.speed, 14);
  assert.deepEqual(TECHNIQUES.syncopate.steps, [{ pulse: 1, speed: -10, ticks: 5 }, { pulse: 2, speed: 17, ticks: 7, lift: -4 }]);
  assert.equal(presentationById("nacho").introStyle, "defiant");
  assert.equal(presentationById("nacho").battleFrame, 1);
  assert.equal(selectionProgress("nacho", 2800), 1); assert.equal(selectionProgress("nacho", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("nacho", frame, facing), facing);
  emit("presentation", { intro: presentationById("nacho").introName, choreography: CHOREOGRAPHIES.nacho.name });
});

test("Nacho walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Nacho light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.95 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Paso sincopado executes its forward, retreat and aerial finisher pulses against idle/front/rear guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 120); const origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const impacts: unknown[] = [], blocks = new Set<number>(), trace: unknown[] = [];
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy;
    close(energyAfterCost, 75);
    for (let n = 1; n < 110; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp !== hp) impacts.push({ call: n + 1, tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, dx: r.rival.x - r.player.x, forceVx: r.rival.vx });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      if (r.player.attack && [7, 21, 35, 49].includes(r.player.attackTick) && r.state.hitstop === 0) trace.push({ call: n + 1, attackTick: r.player.attackTick, x: r.player.x, vx: r.player.vx, y: r.player.y, grounded: r.player.grounded, dash: r.player.dash });
    }
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x - origin) * (side === 0 ? 1 : -1) > 100);
    assert.ok(Math.abs(r.player.vx) < 1e-6);
    assert.equal(trace.length, 3);
    const steps = trace as { attackTick: number; vx: number; grounded: boolean }[];
    assert.deepEqual(steps.map(step => step.attackTick), [7, 21, 35]);
    assert.deepEqual(steps.map(step => step.vx), (side === 0 ? [14, -10, 17] : [-14, 10, -17]));
    assert.equal(steps[2].grounded, false);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 3); }
    else { close(r.rival.hp, guard === "idle" ? 88.258 : 94.129); assert.equal(r.player.hits, guard === "idle" ? 2 : 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, origin, energyAfterCost, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits, finalX: r.player.x, trace });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035);
  }
});

test("Nacho syncopate range probes exercise real pulse collisions on both sides", () => {
  const mirroredStarts = new Map<number, { x: number; targetX: number; vx: number; targetVx: number }>();
  for (const side of [0, 1] as const) for (const gap of [70, 80, 120, 125, 160, 180, 220, 280, 500]) {
    const r = setup(side, gap); const origin = r.player.x; r.inputs[side].actions.special++;
    const impacts: { call: number; tick: number; attackTick: number; hp: number; gap: number; forceVx: number }[] = [];
    for (let n = 0; n < 110; n++) { const hp = r.rival.hp; r.advance(1); if (hp !== r.rival.hp) impacts.push({ call: n + 1, tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, gap: r.rival.x - r.player.x, forceVx: r.rival.vx }); }
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x)); assert.ok(Math.abs(r.player.vx) < 1e-6);
    assert.equal(r.player.hits, gap < 125 ? 2 : gap <= 220 ? 1 : 0);
    if (gap === 70) {
      assert.deepEqual(impacts.map(impact => impact.attackTick), [7, 35]);
      assert.ok(Math.abs(impacts[1].forceVx) > 9, "aerial finisher applies its larger force");
      assert.ok(Math.abs(impacts[0].forceVx) < 4);
    }
    if (side === 0) mirroredStarts.set(gap, { x: r.player.x, targetX: r.rival.x, vx: r.player.vx, targetVx: r.rival.vx });
    else {
      const mirror = mirroredStarts.get(gap)!;
      close(r.player.x + mirror.x, WORLD.x * 2 + WORLD.width);
      close(r.rival.x + mirror.targetX, WORLD.x * 2 + WORLD.width);
      close(r.player.vx + mirror.vx, 0);
      close(r.rival.vx + mirror.targetVx, 0);
    }
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, playerX: r.player.x, displacement: r.player.x - origin, targetX: r.rival.x, targetStocks: r.rival.stocks, impacts });
  }
});

test("Nacho recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Contratiempo" : "Paso primero"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.95 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Contratiempo" : "Paso primero");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 75], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Remate de tarima"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 60.242); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Nacho intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Nacho", fighter: "nacho", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 190 && Math.abs(dx) > 90 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Nacho fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
