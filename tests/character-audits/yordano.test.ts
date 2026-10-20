import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 400, wins = 3) {
  const configs = [{ name: "Audit Yordano", fighter: "yordano" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }];
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]], "yordano-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 230 : 850; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "yordano", check, evidence })); }

test("Yordano preserves researched identity, three timed drops and one-shot presentations in both facings", () => {
  const f = fighterById("yordano"), p = presentationById("yordano");
  assert.equal(f.name, "Yordano"); assert.equal(f.ability, "fountain"); assert.equal(f.special, "Manantial en tres tiempos");
  assert.deepEqual(f.combos, ["Agua clara", "Ida y vuelta", "Tres tiempos"]);
  assert.deepEqual(TECHNIQUES.fountain.pulses, [0, 13, 26]);
  assert.equal(p.introStyle, "defiant"); assert.equal(p.selectionStyle, "defiant"); assert.equal(p.battleFrame, 1);
  assert.equal(selectionProgress("yordano", 2800), 1); assert.equal(selectionProgress("yordano", 5600), 1);
  for (const beats of [p.introBeats, p.selectionBeats]) { const last = samplePose(beats, 1); assert.equal(last.frame, 1); assert.equal(last.dx, 0); assert.equal(last.dy, 0); }
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("yordano", frame, facing), facing);
  emit("presentation", { intro: p.introName, choreography: CHOREOGRAPHIES.yordano.name, prop: p.prop, durationMs: p.durationMs });
});

test("Yordano walks and faces both ways, double jumps, rejects a third jump and lands on either side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920; const start = r.player.x;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x; assert.ok(right > start + 90); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x; assert.ok(left < right - 80); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10); r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Yordano light and heavy each connect once and obey front guards on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard; r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1); assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Manantial emits all three mirrored arcing drops, hits idle, blocks front guard and defeats rear guard", () => {
  const mirrored: Record<string, unknown>[] = [];
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 400), origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle"; if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; attackTick: number; vx: number; vy: number; y: number; gravity: number; damage: number; kind: string }>();
    const impacts: { tick: number; hp: number; y: number }[] = [], blocks = new Set<number>();
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75); const energyAfterCost = r.player.energy;
    for (let n = 1; n < 160; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, vx: p.vx, vy: p.vy ?? 0, y: p.y, gravity: p.gravity ?? 0, damage: p.damage, kind: p.kind });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, y: r.rival.y });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    const emissions = [...shots.values()]; assert.equal(shots.size, 3); assert.deepEqual(emissions.map(p => p.attackTick), [13, 26, 39]);
    assert.deepEqual(emissions.map(p => p.tick), [13, 26, 39]);
    assert.ok(emissions.every(p => p.vx === (side === 0 ? 7.2 : -7.2) && Math.abs(p.vy + 8.7) < 1e-8 && p.y === 470.3 && p.gravity === 0.3 && p.damage === 7 && p.kind === "fountain"));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    close(r.rival.hp, guard === "front" ? 100 : guard === "idle" ? 78.37 : 92.79);
    assert.equal(r.player.hits, guard === "front" ? 0 : guard === "idle" ? 3 : 1); assert.equal(blocks.size, guard === "front" ? 3 : 0);
    const evidence = { guard, emissions: emissions.map(({ vx, ...p }) => ({ ...p, speed: Math.abs(vx) })), impacts, hp: r.rival.hp, hits: r.player.hits, blocks: blocks.size };
    if (side === 0) mirrored.push(evidence); else assert.deepEqual(evidence, mirrored[["idle", "front", "rear"].indexOf(guard)]);
    emit("special", { side, gap: 400, energyAfterCost, ...evidence, attackerEnergy: r.player.energy, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("all three drops follow the same parabola and expire after descending without ground-only restrictions", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 230); r.inputs[side].actions.special++;
    const trajectories = new Map<number, { age: number; x: number; y: number; vy: number }[]>();
    for (let n = 0; n < 145; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) {
        const age = p.age ?? 0, sign = side === 0 ? 1 : -1;
        close(p.x, r.player.x + sign * (48 + age * 7.2)); close(p.y, WORLD.floor - 75 - age * 9 + 0.15 * age * (age + 1)); close(p.vy ?? 0, -9 + age * 0.3);
        assert.notEqual(p.groundOnly, true);
        const points = trajectories.get(p.id) ?? []; points.push({ age, x: p.x, y: p.y, vy: p.vy ?? 0 }); trajectories.set(p.id, points);
      }
    }
    assert.equal(trajectories.size, 3); assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.hp, 100);
    for (const points of trajectories.values()) { assert.ok(points.some(p => p.vy < 0)); assert.ok(points.some(p => p.vy > 0)); assert.equal(points.at(-1)!.age, 64); }
    emit("arc", { side, gap: 230, apexY: Math.min(...[...trajectories.values()][0].map(p => p.y)), lastAge: [...trajectories.values()][0].at(-1)!.age, drops: trajectories.size, hp: r.rival.hp });
  }
});

test("Manantial covers a real jumping target at 230 pixels on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 230); r.inputs[side].actions.special++; r.inputs[1 - side].actions.jump++;
    const impacts: { tick: number; hp: number; y: number; grounded: boolean }[] = [];
    for (let n = 0; n < 145; n++) { const hp = r.rival.hp; r.advance(1); if (hp !== r.rival.hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, y: r.rival.y, grounded: r.rival.grounded }); }
    assert.equal(r.player.hits, 1); close(r.rival.hp, 92.79); assert.equal(impacts[0].tick, 32); assert.equal(impacts[0].grounded, false); assert.ok(impacts[0].y < WORLD.floor - 100);
    emit("anti-air", { side, gap: 230, impacts });
  }
});

test("Yordano recognizes and connects base/upgraded combos with chase inputs and enforces super gates", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Ida y vuelta" : "Agua clara"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 + (wins ? 7 : 3)) * 1.03);
      emit("combo-win-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0), attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) { const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1); }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8); r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Ida y vuelta" : "Agua clara"); assert.equal(r.player.comboBonus, advanced ? 7 : 3);
      emit("connected-combo", { side, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Tres tiempos"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 58.8); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Yordano intro locks movement and attacks through the complete shared timeline", () => {
  for (const side of [0, 1] as const) {
    const state = createMatch("poliedro", side === 0 ? [{ name: "Y", fighter: "yordano", wins: 3 }, { name: "J", fighter: "javier", wins: 3 }] : [{ name: "J", fighter: "javier", wins: 3 }, { name: "Y", fighter: "yordano", wins: 3 }]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++; const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.projectiles.length, 0);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
  }
});

function cpuFight() {
  const r = setup(0, 420, 3); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 540 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < 120 || r.player.x > 960) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack); for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Yordano bout versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
