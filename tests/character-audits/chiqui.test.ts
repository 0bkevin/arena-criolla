import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, entranceProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Chiqui", fighter: "chiqui" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "chiqui-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "chiqui", check, evidence: value })); }

test("Chiqui retains her documented identity, rapid seven-frame forward dash, one-shot selection and both facings", () => {
  const f = fighterById("chiqui");
  assert.equal(f.name, "Chiquinquirá Delgado"); assert.equal(f.ability, "runway"); assert.equal(f.special, "Pasarela relámpago");
  assert.deepEqual(f.combos, ["Paso elegante", "Foco azul", "Cierre de pasarela"]);
  assert.equal(TECHNIQUES.runway.startup, 11); assert.equal(TECHNIQUES.runway.dash?.speed, 23); assert.equal(TECHNIQUES.runway.dash?.brake, 0.5);
  assert.equal(presentationById("chiqui").introStyle, "defiant");
  assert.equal(presentationById("chiqui").battleFrame, 1);
  assert.equal(selectionProgress("chiqui", 2800), 1); assert.equal(selectionProgress("chiqui", 5600), 1);
  for (const side of [0, 1]) { assert.equal(entranceProgress("chiqui", 510, side), 1); assert.equal(entranceProgress("chiqui", 1020, side), 1); }
  const profile = presentationById("chiqui");
  assert.equal(samplePose(profile.introBeats, 1).frame, 1); assert.equal(samplePose(profile.selectionBeats, 1).frame, 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("chiqui", frame, facing), facing);
  emit("presentation", { intro: presentationById("chiqui").introName, choreography: CHOREOGRAPHIES.chiqui.name });
});

test("Chiqui walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    const start = r.player.x;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > start + 80); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 80); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Chiqui light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.93 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Pasarela relámpago spends 25 energy, dashes forward and hits once against idle/rear guard while facing guard blocks on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 220);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const origin = r.player.x, impacts: unknown[] = [], blocks = new Set<number>();
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy;
    close(energyAfterCost, 75);
    const trace: unknown[] = [];
    for (let n = 1; n < 110; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, gap: r.rival.x - r.player.x });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      if ([10, 11, 17, 18, 23, 35, 60, 109].includes(n+1)) trace.push({ call: n+1, x: r.player.x, vx: r.player.vx, attackTick: r.player.attackTick, dash: r.player.dash });
    }
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x - origin) * (side === 0 ? 1 : -1) > 80);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 83.7157); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, energyAfterCost, impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, origin, finalX: r.player.x, trace });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) { const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); assert.equal(r.state.projectiles.length, 0); }
});

test("dash range probes exercise actual collisions and braking on both sides", () => {
  for (const side of [0, 1] as const) for (const gap of [120, 180, 220, 300, 317, 318, 330, 500]) {
    const r = setup(side, gap); const origin = r.player.x; r.inputs[side].actions.special++;
    const impacts: unknown[] = [];
    for (let n = 0; n < 110; n++) { const hp = r.rival.hp; r.advance(1); if(hp !== r.rival.hp) impacts.push({call:n+1,hp:r.rival.hp,gap:r.rival.x-r.player.x}); }
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x)); assert.equal(r.player.hits, gap < 318 ? 1 : 0); assert.ok(Math.abs(r.player.x-origin) > 180 && Math.abs(r.player.x-origin) < 185); assert.ok(Math.abs(r.player.vx) < 1e-6);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, playerX: r.player.x, displacement:r.player.x-origin, targetX: r.rival.x, targetStocks: r.rival.stocks, impacts });
  }
});

test("Chiqui recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Foco azul" : "Paso elegante"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.93 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Foco azul" : "Paso elegante");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 75], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Cierre de pasarela"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 60.8188); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Chiqui intro blocks action until the full shared timeline completes on either player side", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "Chiqui", fighter: "chiqui" as const, wins: 3 }, { name: "Javier", fighter: "javier" as const, wins: 3 }] as const;
    const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.projectiles.length, 0);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
  }
});

test("runway starts on tick 11, brakes immediately when the seven moving frames expire, and settles on either side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 500); const origin = r.player.x, direction = side === 0 ? 1 : -1;
    r.inputs[side].actions.special++; r.advance(10); assert.equal(r.player.x, origin);
    r.advance(1); assert.equal(r.player.attackTick, 11); assert.equal(r.player.dash, 7); assert.equal(r.player.vx, 23 * direction);
    r.advance(6); assert.equal(r.player.attackTick, 17); assert.equal(r.player.dash, 1); close((r.player.x - origin) * direction, 161);
    r.advance(1); assert.equal(r.player.dash, 0); assert.equal(r.player.vx, 11.5 * direction);
    r.advance(42); const settled = r.player.x; assert.ok(Math.abs(r.player.vx) < 1e-8);
    r.advance(50); assert.ok(Math.abs(r.player.x - settled) < 1e-7); assert.equal(r.player.hits, 0);
    emit("braking", { side, displacement: (r.player.x - origin) * direction, settled, finalVx: r.player.vx, dash: r.player.dash });
  }
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
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 620 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Chiqui fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
