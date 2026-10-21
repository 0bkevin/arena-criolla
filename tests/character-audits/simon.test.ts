import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Simón", fighter: "simon" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "simon-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "simon", check, evidence: value })); }

test("Simón retains his researched identity, three fan notes, one-shot selection and both facings", () => {
  const f = fighterById("simon");
  assert.equal(f.name, "Simón Díaz"); assert.equal(f.ability, "cuatro"); assert.equal(f.special, "Acorde llanero");
  assert.deepEqual(f.combos, ["Primer acorde", "Contrapunteo", "Tonada de la arena"]);
  assert.deepEqual(TECHNIQUES.cuatro.projectile, { speed: 8, life: 90, count: 3, spread: 3.2 });
  assert.equal(presentationById("simon").introStyle, "hat");
  assert.equal(presentationById("simon").battleFrame, 1);
  assert.equal(selectionProgress("simon", 2800), 1); assert.equal(selectionProgress("simon", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("simon", frame, facing), facing);
  emit("presentation", { intro: presentationById("simon").introName, choreography: CHOREOGRAPHIES.simon.name });
});

test("Simón walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    const start = r.player.x;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > start + 85); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 75); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Simón light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * .95 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Acorde llanero fans three notes, collides with idle and directional guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const projectiles = new Map<number, { tick: number; vx: number; vy: number; damage: number; kind: string }>();
    const impacts: { tick: number; hp: number; energy: number; hits: number }[] = [];
    const blocks = new Set<number>();
    const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy;
    close(energyAfterCost, 75);
    for (let n = 1; n < 170; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!projectiles.has(p.id)) projectiles.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, vy: p.vy ?? 0, damage: p.damage ?? 0, kind: p.kind });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, energy: r.rival.energy, hits: r.player.hits });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(projectiles.size, 3);
    const emissions = [...projectiles.values()]; assert.ok(emissions.every(p => p.tick === 12 && p.vx === (side === 0 ? 8 : -8) && p.kind === "cuatro"));
    assert.deepEqual(emissions.map(p => p.vy), [-3.2, 0, 3.2]);
    assert.ok(emissions.every(p => Math.abs(p.damage - 8.55) < 1e-8));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 91.1935); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, energyAfterCost, emissions, impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, attackerEnergy: r.player.energy, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("cuatro range and upward-fan probes log actual collisions", () => {
  for (const gap of [25, 80, 120, 160, 200, 280, 500, 620, 720, 805]) {
    const r = setup(0, gap); r.inputs[0].actions.special++;
    const shots = new Set<number>();
    for (let n = 0; n < 170; n++) { r.advance(1); for (const p of r.state.projectiles) shots.add(p.id); }
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x));
    emit("range-probe", { gap, hp: r.rival.hp, hits: r.player.hits, observedShots: shots.size, playerX: r.player.x, targetX: r.rival.x, targetStocks: r.rival.stocks });
  }
  for (const side of [0, 1] as const) for (const delay of [0, 10, 20]) {
    const r = setup(side, 280); r.inputs[1 - side].actions.jump++; r.advance(delay);
    r.inputs[side].actions.special++;
    const impacts: { tick: number; hp: number; targetY: number; projectileY: number }[] = [];
    for (let n = 0; n < 120; n++) {
      const hp = r.rival.hp, nextId = r.state.nextId; r.advance(1);
      if (hp !== r.rival.hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, targetY: r.rival.y, projectileY: r.state.effects.find(e => e.kind === "hit" && e.owner === side && e.id >= nextId)?.y ?? 0 });
    }
    assert.equal(impacts.length, delay === 20 ? 1 : 2);
    close(r.rival.hp, delay === 20 ? 91.1935 : 82.387);
    if (delay === 0) assert.ok(impacts[0].projectileY < WORLD.floor - 140 && impacts[0].targetY < WORLD.floor - 100);
    emit("air-fan-probe", { side, delay, hp: r.rival.hp, hits: r.player.hits, impacts });
  }
});

test("Simón recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Contrapunteo" : "Primer acorde"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * .95 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Contrapunteo" : "Primer acorde");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "simon"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Tonada de la arena"); assert.equal(r.player.comboBonus, 12); assert.equal(r.state.finale, undefined); assert.equal(r.player.attack, null); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Simón intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Simón", fighter: "simon", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
test("a complete Simón fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
