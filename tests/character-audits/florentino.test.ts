import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Florentino", fighter: "florentino" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "florentino-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "florentino", check, evidence: value })); }

test("Florentino retains his coplero identity, vertically tracking note and one-shot presentation in both facings", () => {
  const f = fighterById("florentino"), t = TECHNIQUES.verse, p = presentationById("florentino");
  assert.equal(f.name, "Florentino"); assert.equal(f.ability, "verse"); assert.equal(f.special, "Copla certera");
  assert.deepEqual(f.combos, ["Verso primero", "Copla enlazada", "Contrapunteo final"]);
  assert.equal(t.startup, 14); assert.equal(t.recovery, 46); assert.deepEqual(t.projectile, { speed: 8, life: 74, homing: 2.8 });
  assert.equal(p.introStyle, "present"); assert.equal(p.selectionStyle, "strum"); assert.equal(p.prop, "cuatro"); assert.equal(p.battleFrame, 0);
  assert.equal(selectionProgress("florentino", 2800), 1); assert.equal(selectionProgress("florentino", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("florentino", frame, facing), facing);
  for (const selection of [false, true]) { const ready = sampleGesture("florentino", 1, selection); assert.equal(ready.front, 0); assert.equal(ready.back, 0); assert.deepEqual(sampleGesture("florentino", 2, selection), ready); assert.ok(Math.abs(sampleGesture("florentino", 0.5, selection).front) > 0.1); }
  emit("presentation", { intro: p.introName, selection: p.selectionName, choreography: CHOREOGRAPHIES.florentino.name, durationMs: p.durationMs });
});

test("Florentino walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Florentino manual dash moves forward, grants brief invincibility, and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 600); const start = r.player.x;
    r.inputs[side].actions.dash++; r.advance(1);
    assert.equal(r.player.dash, 12); assert.equal(r.player.invincible, 8); assert.equal(r.player.cooldown, 30); close(r.player.vx, side === 0 ? 14 : -14);
    r.advance(40); assert.equal(r.player.dash, 0); assert.equal(r.player.invincible, 0); assert.equal(r.player.cooldown, 0); assert.ok((r.player.x - start) * (side === 0 ? 1 : -1) > 140); assert.ok(Math.abs(r.player.vx) < 0.001);
    emit("dash", { side, start, finalX: r.player.x, finalVx: r.player.vx, cooldown: r.player.cooldown });
  }
});

test("Florentino light and heavy each connect once and obey a facing guard on both sides", () => {
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

test("Copla certera emits one forward note, respects front guard and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; vx: number; life: number; kind: string; damage: number; homing: number }>();
    const impacts: { tick: number; hp: number; x: number; vx: number; stun: number }[] = [];
    const blocks = new Set<number>(); const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 170; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, life: p.life, kind: p.kind, damage: p.damage, homing: p.homing ?? 0 });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, x: r.rival.x, vx: r.rival.vx, stun: r.rival.stun });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 1); const shot = [...shots.values()][0];
    assert.equal(shot.tick, 14); assert.equal(shot.life, 73); assert.equal(shot.vx, side === 0 ? 8 : -8); assert.equal(shot.kind, "verse"); assert.equal(shot.homing, 2.8); close(shot.damage, 10.67);
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); assert.equal(impacts.length, 0); }
    else { close(r.rival.hp, 89.0099); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); assert.equal(Math.sign(impacts[0].vx), side === 0 ? 1 : -1); }
    emit("special", { side, guard, energyAfterCost: 75, shots: [...shots.values()], impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, origin, finalPlayerX: r.player.x, finalTargetX: r.rival.x, finalStun: r.rival.stun, targetStocks: r.rival.stocks });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); assert.equal(r.state.projectiles.length, 0);
    emit("special-energy-gate", { side, startingEnergy: energy, attack: r.player.attack, energy: r.player.energy });
  }
});

test("Copla certera tracks only height, keeps its original horizontal direction after a rival crosses behind and expires", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 720), direction = side === 0 ? 1 : -1;
    r.rival.invincible = 1000;
    let appeared = 0, removed = 0, maximumAge = 0, previousX = r.player.x + direction * 48, previousY = WORLD.floor - 75;
    const tracking: { tick: number; age: number; x: number; y: number; targetX: number; targetY: number; life: number; vx: number }[] = [];
    r.inputs[side].actions.special++;
    for (let n = 0; n < 120; n++) {
      if (n === 15) r.inputs[1 - side].actions.jump++;
      if (n === 25) r.rival.x = r.player.x - direction * 80;
      if (n === 32) r.inputs[1 - side].actions.jump++;
      const count = r.state.projectiles.length; r.advance(1);
      const shot = r.state.projectiles[0];
      if (shot) {
        appeared ||= n + 1; maximumAge = Math.max(maximumAge, shot.age ?? 0);
        close(shot.x, previousX + direction * 8);
        close(shot.y, previousY + Math.max(-2.8, Math.min(2.8, r.rival.y - 75 - previousY)));
        assert.equal(shot.vx, direction * 8); assert.equal(shot.direction, direction); assert.equal(shot.owner, side); assert.equal(shot.life, 74 - (shot.age ?? 0));
        previousX = shot.x; previousY = shot.y;
        if ([1, 10, 20, 40, 60, 73].includes(shot.age ?? 0)) tracking.push({ tick: n + 1, age: shot.age ?? 0, x: shot.x, y: shot.y, targetX: r.rival.x, targetY: r.rival.y, life: shot.life, vx: shot.vx });
      }
      if (count && !r.state.projectiles.length) removed = n + 1;
    }
    assert.equal(appeared, 14); assert.equal(removed, 87); assert.equal(maximumAge, 73); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.state.projectiles.length, 0);
    assert.ok(tracking.some(p => p.y < WORLD.floor - 75)); assert.ok(tracking.some(p => (p.targetX - r.player.x) * direction < 0));
    emit("vertical-tracking-fixed-direction-and-expiry", { side, gap: 720, rivalJumpInputTicks: [16, 33], rivalCrossedBehindAtTick: 26, appeared, removed, maximumAge, tracking, finalHp: r.rival.hp });
  }
});

test("Florentino recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Copla enlazada" : "Verso primero"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Copla enlazada" : "Verso primero");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 75], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Contrapunteo final"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 59.6652); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Florentino intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Florentino", fighter: "florentino", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
    if (n === 0) r.inputs[0].actions.special++;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 620 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Florentino fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
