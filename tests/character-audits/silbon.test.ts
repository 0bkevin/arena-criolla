import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, INTRO_PLAYER_TICKS, entranceProgress, normalizedFacing, presentationById, samplePose, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture, REST } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Silbón", fighter: "silbon" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "silbon-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "silbon", check, evidence: value })); }

test("Silbón retains his researched identity, accelerating oscillating whistle, one-shot selection and both facings", () => {
  const f = fighterById("silbon");
  assert.equal(f.name, "El Silbón"); assert.equal(f.ability, "whistle"); assert.equal(f.special, "Silbido errante");
  assert.deepEqual(f.combos, ["Paso perdido", "Eco del camino", "Noche sin regreso"]);
  assert.equal(TECHNIQUES.whistle.startup, 13); assert.deepEqual(TECHNIQUES.whistle.projectile, { speed: 4, life: 85, wave: { amplitude: 28, period: 32 }, acceleration: 0.22, maxSpeed: 12 });
  assert.equal(presentationById("silbon").introStyle, "stalk");
  assert.equal(presentationById("silbon").battleFrame, 1);
  assert.equal(selectionProgress("silbon", 2800), 1); assert.equal(selectionProgress("silbon", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("silbon", frame, facing), facing);
  const profile = presentationById("silbon");
  for (const beats of [profile.introBeats, profile.selectionBeats]) {
    assert.equal(samplePose(beats, 1).frame, profile.battleFrame);
    assert.deepEqual(samplePose(beats, 1), samplePose(beats, 2));
  }
  for (const side of [0, 1] as const) {
    assert.equal(entranceProgress("silbon", side * INTRO_PLAYER_TICKS, side), 0);
    assert.equal(entranceProgress("silbon", side * INTRO_PLAYER_TICKS + 168, side), 1);
    assert.equal(entranceProgress("silbon", side * INTRO_PLAYER_TICKS + 600, side), 1);
  }
  for (const selection of [false, true]) {
    assert.deepEqual(sampleGesture("silbon", 1, selection), { at: 1, ...REST });
    assert.deepEqual(sampleGesture("silbon", 2, selection), { at: 1, ...REST });
    assert.notDeepEqual(sampleGesture("silbon", 0.5, selection), { at: 0.5, ...REST });
  }
  emit("presentation", { intro: presentationById("silbon").introName, choreography: CHOREOGRAPHIES.silbon.name });
});

test("Silbón walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Silbón light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.03 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Silbido errante spends 25 energy, hits once against idle/rear guard, and respects front guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Set<number>(), blocks = new Set<number>();
    const impacts: unknown[] = [], origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    let emission: unknown;
    for (let n = 1; n < 140; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) {
        shots.add(p.id); emission = { tick: r.state.tick - INTRO_TOTAL_TICKS, x: p.x, y: p.y, vx: p.vx, age: p.age, life: p.life, damage: p.damage, kind: p.kind };
        assert.equal(p.kind, "whistle"); close(p.vx, (side === 0 ? 1 : -1) * 4.22); close(p.damage, 13 * 1.03);
        assert.equal(r.state.tick - INTRO_TOTAL_TICKS, 13);
      }
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, facing: r.rival.facing, blocking: r.rival.blocking });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 1); assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 100 - 13 * 1.03 * 1.03); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, emission, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits, finalX: r.player.x });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035);
  }
});

test("the whistle accelerates to 12, oscillates by 28, and expires at age 85 without reversing on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 760); r.rival.invincible = 1000;
    r.inputs[side].actions.special++;
    const trace: unknown[] = []; let seen = false, observations = 0, lastX = 0, expiryTick = 0;
    for (let n = 1; n <= 115; n++) {
      r.advance(1); const shot = r.state.projectiles[0];
      if (shot) {
        seen = true; observations++;
        const age = shot.age ?? 0, direction = side === 0 ? 1 : -1;
        close(shot.vx, direction * Math.min(12, 4 + age * 0.22));
        close(shot.y, (shot.originY ?? 0) + Math.sin(age * Math.PI * 2 / 32) * 28);
        assert.equal(shot.life, 85 - age); assert.equal(shot.direction, direction); assert.equal(shot.owner, side);
        assert.ok(Math.abs(shot.vx) <= 12); if (observations > 1) assert.ok((shot.x - lastX) * direction > 0);
        lastX = shot.x;
        if ([1, 8, 16, 24, 32, 36, 37, 64, 84].includes(age)) trace.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, age, x: shot.x, y: shot.y, vx: shot.vx, life: shot.life });
      } else if (seen && !expiryTick) expiryTick = r.state.tick - INTRO_TOTAL_TICKS;
    }
    assert.equal(observations, 84); assert.equal(expiryTick, 97); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100);
    emit("whistle-cap-wave-expiry", { side, observations, expiryTick, trace });
  }
});

test("a timed jump evades the whistle on both sides and range probes use real collision", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280); r.inputs[side].actions.special++; r.advance(12); r.inputs[1 - side].actions.jump++; r.advance(120);
    assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(r.state.projectiles.length, 0);
    emit("jump-evade", { side, jumpTick: 13, hp: r.rival.hp, landed: r.rival.grounded });
  }
  for (const gap of [25, 80, 120, 520, 620, 760, 820]) {
    const r = setup(0, gap); r.inputs[0].actions.special++; r.advance(150);
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x));
    emit("range-probe", { gap, hp: r.rival.hp, hits: r.player.hits, stocks: r.rival.stocks });
  }
});

test("Silbón recognizes both combos from zero wins, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, "Eco del camino"); assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 1.03 + 7) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Eco del camino" : "Paso perdido");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Noche sin regreso"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - (28 * 1.03 + 12) * 1.03); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Silbón intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Silbón", fighter: "silbon", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
test("a complete Silbón fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
