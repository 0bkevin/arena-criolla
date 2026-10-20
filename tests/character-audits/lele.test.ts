import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 201, wins = 3) {
  const configs = [{ name: "Audit Lele", fighter: "lele" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lele-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "lele", check, evidence: value })); }

test("Lele retains the dossier identity, delayed trap and one-shot phone presentation in both facings", () => {
  const f = fighterById("lele"), t = TECHNIQUES.prank, p = presentationById("lele");
  assert.equal(f.name, "Lele Pons"); assert.equal(f.ability, "prank"); assert.equal(f.special, "Broma resbalosa");
  assert.deepEqual(f.combos, ["Cámara lista", "Giro viral", "Última broma"]);
  assert.equal(t.startup, 10); assert.equal(t.projectile?.plantAfter, 18); assert.equal(t.projectile?.armAfter, 27); assert.equal(t.projectile?.groundOnly, true);
  assert.deepEqual(t.dash, { speed: -8, ticks: 6, lift: -5, invincibility: 1, brake: 0.8 });
  assert.equal(p.introStyle, "phone"); assert.equal(p.battleFrame, 1);
  assert.equal(selectionProgress("lele", 2800), 1); assert.equal(selectionProgress("lele", 5600), 1);
  assert.deepEqual(samplePose(p.introBeats, 1), samplePose(p.selectionBeats, 1));
  assert.equal(samplePose(p.introBeats, 1).frame, p.battleFrame);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("lele", frame, facing), facing);
  emit("presentation", { intro: p.introName, choreography: CHOREOGRAPHIES.lele.name, durationMs: p.durationMs });
});

test("Lele walks both directions, double jumps, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920; const start = r.player.x;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x; assert.ok(right > start + 100); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x; assert.ok(left < right - 100); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10); r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const vy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > vy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Lele light and heavy hit once and respect the facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard; r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.91 * 1.03); assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits });
  }
});

test("Broma resbalosa plants before arming, hits once, blocks front guard and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side); const direction = side === 0 ? 1 : -1, origin = r.player.x;
    r.inputs[1 - side].block = guard === "front"; r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    const shots = new Set<number>(), blocks = new Set<number>(), trace: unknown[] = []; let minY = WORLD.floor;
    for (let call = 2; call <= 170; call++) {
      // Turn the rear guard away immediately before arming, without walking outside the trap's footprint.
      if (guard === "rear" && call === 35) { r.inputs[1 - side].block = true; r.inputs[1 - side][side === 0 ? "right" : "left"] = true; }
      r.advance(1); minY = Math.min(minY, r.player.y);
      for (const p of r.state.projectiles) shots.add(p.id);
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      if ([9, 10, 16, 26, 27, 35, 36, 60].includes(call)) trace.push({ call, tick: r.state.tick - INTRO_TOTAL_TICKS, x: r.player.x, y: r.player.y, vx: r.player.vx, hp: r.rival.hp, shots: r.state.projectiles.map(p => ({ x: p.x, age: p.age ?? 0, vx: p.vx, life: p.life })) });
      if (call === 9) assert.equal(r.state.projectiles.length, 0);
      if (call === 10) { const p = r.state.projectiles[0]!; assert.equal(p.kind, "prank"); assert.equal(p.age, 1); assert.equal(p.vx, 9 * direction); close(p.x, origin + 57 * direction); close(p.damage, 10.92); }
      if (call === 27) { const p = r.state.projectiles[0]!; assert.equal(p.age, 18); assert.equal(p.vx, 0); close(p.x, origin + 201 * direction); assert.equal(p.y, WORLD.floor - 42); }
      if (call === 35) { assert.equal(r.rival.hp, 100); assert.equal(r.state.projectiles[0]!.age, 26); }
      if (call === 36) { assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.hits, guard === "front" ? 0 : 1); }
    }
    assert.equal(shots.size, 1); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    assert.ok((r.player.x - origin) * direction < -79 && (r.player.x - origin) * direction > -81); assert.ok(Math.abs(r.player.vx) < 1e-6);
    close(minY, 532.3999999999999); assert.equal(r.player.grounded, true); assert.equal(r.player.stocks, 2);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); }
    else { close(r.rival.hp, 88.7524); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, origin, finalX: r.player.x, minY, hp: r.rival.hp, hits: r.player.hits, blockCount: blocks.size, trace });
  }
});

test("Lele enforces special energy, jump avoidance and the planted footprint on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const energy of [24, 25]) { const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); }
    const jump = setup(side); jump.inputs[side].actions.special++; jump.advance(29); jump.inputs[1 - side].actions.jump++; jump.advance(7);
    assert.equal(jump.rival.grounded, false); assert.equal(jump.rival.hp, 100); assert.equal(jump.state.projectiles[0]!.age, 27);
    jump.inputs[1 - side][side === 0 ? "right" : "left"] = true; jump.advance(40); jump.inputs[1 - side].left = false; jump.inputs[1 - side].right = false; jump.advance(100);
    assert.equal(jump.rival.hp, 100); assert.equal(jump.player.hits, 0); assert.equal(jump.state.projectiles.length, 0);
    emit("jump-avoidance", { side, targetX: jump.rival.x, hp: jump.rival.hp, hits: jump.player.hits });
    for (const gap of [80, 159, 160, 201, 242, 243, 420]) { const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(170); assert.equal(r.player.hits, gap >= 160 && gap <= 242 ? 1 : 0); assert.equal(r.state.projectiles.length, 0); emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits }); }
  }
});

test("Lele recognizes and connects base/upgraded combos and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins); for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11); assert.equal(r.player.combo, wins ? "Giro viral" : "Cámara lista"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.91 + (wins ? 7 : 3)) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0); const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) { const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1); }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8); r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Giro viral" : "Cámara lista"); emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 90], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (wins < 2 || energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Última broma"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 61.3956); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, combo: r.player.combo });
    }
  }
});

test("Lele intro consumes actions and stays still until the shared timeline completes", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "Lele", fighter: "lele" as const, wins: 3 }, { name: "Javier", fighter: "javier" as const, wins: 3 }] as const;
    const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]]); const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x; for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.projectiles.length, 0);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[side].facing, side === 0 ? 1 : -1); assert.equal(state.players[side].attack, null);
  }
});

function cpuFight() {
  const r = setup(0, 420, 3); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  // Exercise the special explicitly; later AI choices depend on arena geometry.
  r.inputs[0].actions.special++;
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x; r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) > 170 && Math.abs(dx) < 340 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < WORLD.left + 50 || r.player.x > WORLD.right - 50) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack); for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Lele fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
