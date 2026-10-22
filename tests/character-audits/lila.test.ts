import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, entranceProgress, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";
import { sampleEntranceAction } from "../../shared/entrance-actions";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [{ name: "Audit Lila", fighter: "lila" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lila-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "lila", check, evidence })); }

test("Lila preserves documented identity, five-leaf fan, one-shot presentation and eight mirrored facings", () => {
  const f = fighterById("lila");
  assert.equal(f.name, "Lila Morillo"); assert.equal(f.ability, "cocotero"); assert.equal(f.special, "Abanico del cocotero");
  assert.deepEqual(f.combos, ["Destello zuliano", "Giro dorado", "Gran cocotero"]);
  assert.equal(TECHNIQUES.cocotero.startup, 16); assert.equal(TECHNIQUES.cocotero.projectile?.count, 5);
  assert.equal(TECHNIQUES.cocotero.projectile?.spread, 2.2);
  const profile = presentationById("lila");
  assert.equal(profile.battleFrame, 1); assert.equal(profile.introName, "Se yergue y cruza los brazos");
  assert.equal(selectionProgress("lila", 2800), 1); assert.equal(selectionProgress("lila", 5600), 1);
  for (const side of [0, 1]) assert.equal(entranceProgress("lila", INTRO_TOTAL_TICKS, side), 1);
  for (const kind of ["introBeats", "selectionBeats"] as const) {
    assert.equal(samplePose(profile[kind], 1).frame, 1); assert.deepEqual(samplePose(profile[kind], 1), samplePose(profile[kind], 2));
  }
  assert.equal(sampleEntranceAction("lila", 0), null); assert.equal(sampleEntranceAction("lila", 1), null);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("lila", frame, facing), facing);
  emit("presentation", { intro: profile.introName, choreography: CHOREOGRAPHIES.lila.name, durationMs: profile.durationMs });
});

test("Lila walks both directions, double-jumps, rejects a third jump and lands on either player side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > 620); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 80); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Lila light/heavy land once, knock back away from the attacker and respect frontal guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.08 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1); assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, targetEnergy: r.rival.energy });
  }
});

test("Abanico del cocotero emits five distinct trajectories, costs 25, hits idle/rear guard and is blocked by front guard on both sides", () => {
  const mirrored: Record<string, unknown> = {};
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280); r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const emissions = new Map<number, { tick: number; vx: number; vy: number; damage: number; life: number; kind: string }>();
    const impacts: { tick: number; hp: number; vx: number }[] = [], blocks = new Set<number>();
    const origin = r.player.x; r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 140; n++) {
      const before = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!emissions.has(p.id)) emissions.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, vy: p.vy ?? 0, damage: p.damage, life: p.life, kind: p.kind });
      if (before !== r.rival.hp) { impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx }); assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1); }
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    const shots = [...emissions.values()]; assert.equal(shots.length, 5);
    assert.deepEqual(shots.map(p => p.vy), [-4.4, -2.2, 0, 2.2, 4.4]);
    assert.ok(shots.every(p => p.tick === 16 && p.vx === (side === 0 ? 7 : -7) && p.damage === 6.48 && p.life === 41 && p.kind === "cocotero"));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.ok(blocks.size > 0); }
    else { assert.ok(r.rival.hp < 100); assert.ok(r.player.hits > 0); assert.equal(blocks.size, 0); }
    const result = { hp: r.rival.hp, hits: r.player.hits, blocks: blocks.size, impactTicks: impacts.map(p => p.tick) };
    if (side === 0) mirrored[guard] = result; else assert.deepEqual(result, mirrored[guard]);
    emit("special", { side, guard, origin, targetStart: origin + (side === 0 ? 280 : -280), shots, impacts, ...result });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("fan range and airborne trajectories remain finite and expire without lingering shots", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 140, 280, 350, 420, 520]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(140);
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x)); assert.equal(r.state.projectiles.length, 0);
    if (gap >= 420) { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); }
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, targetStocks: r.rival.stocks });
  }
  for (const side of [0, 1] as const) {
    const r = setup(side, 140); r.inputs[1 - side].actions.jump++; r.advance(12); r.inputs[side].actions.special++; r.advance(140);
    assert.ok(Number.isFinite(r.rival.y)); assert.equal(r.state.projectiles.length, 0);
    emit("airborne-probe", { side, hp: r.rival.hp, hits: r.player.hits, finalY: r.rival.y });
  }
});

test("Lila recognizes base/advanced combos, connects chasing chains and enforces super energy gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, "Giro dorado"); assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 1.08 + 7) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, 0);
      const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) {
          const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1);
        }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8);
        r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Giro dorado" : "Destello zuliano");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Gran cocotero"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - (28 * 1.08 + 12) * 1.03); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Lila intro runs once, blocks attacks/movement and finishes facing the rival on either side", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "Lila", fighter: "lila" as const, wins: 3 }, { name: "Javier", fighter: "javier" as const, wins: 3 }] as const;
    const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.projectiles.length, 0);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
    assert.equal(state.players[side].attack, null);
  }
});

function cpuFight() {
  const r = setup(0, 420, 3); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n === 0) r.inputs[0].actions.special++;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 330 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("Lila completes a fight versus normal CPU and deterministically replays the entire state", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
