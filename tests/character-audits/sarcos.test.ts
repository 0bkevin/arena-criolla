import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Sarcos", fighter: "sarcos" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "sarcos-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "sarcos", check, evidence: value })); }

test("Sarcos retains his researched identity, two prize bounces, one-shot selection and both facings", () => {
  const f = fighterById("sarcos");
  assert.equal(f.name, "Daniel Sarcos"); assert.equal(f.ability, "jackpot"); assert.equal(f.special, "Premio sensacional");
  assert.deepEqual(f.combos, ["Calienta el show", "Doble sorpresa", "Premio mayor"]);
  assert.deepEqual(TECHNIQUES.jackpot.projectile, { speed: 6, life: 110, initialVy: -6, gravity: 0.35, bounces: 2, blastRadius: 85 });
  assert.equal(presentationById("sarcos").introStyle, "defiant");
  assert.equal(presentationById("sarcos").battleFrame, 1);
  assert.equal(selectionProgress("sarcos", 2800), 1); assert.equal(selectionProgress("sarcos", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("sarcos", frame, facing), facing);
  emit("presentation", { intro: presentationById("sarcos").introName, choreography: CHOREOGRAPHIES.sarcos.name });
});

test("Sarcos walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Sarcos light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.02 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Premio sensacional emits one prize, hits idle and rear guard, and respects front guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Set<number>();
    let firstShot: { tick: number; vx: number; vy: number; damage: number; kind: string; bounces: number } | null = null;
    let collisionTick = 0;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 130; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) {
        shots.add(p.id);
        if (!firstShot) firstShot = { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, vy: p.vy ?? 0, damage: p.damage, kind: p.kind, bounces: p.bounces ?? 0 };
      }
      if (r.state.effects.some(e => e.owner === side && (e.kind === "hit" || e.kind === "block"))) { collisionTick = r.state.tick - INTRO_TOTAL_TICKS; break; }
    }
    assert.equal(shots.size, 1); assert.ok(firstShot);
    assert.equal(firstShot.tick, 18); assert.equal(firstShot.vx, side === 0 ? 6 : -6);
    close(firstShot.vy, -5.65); close(firstShot.damage, 16.32); assert.equal(firstShot.kind, "jackpot"); assert.equal(firstShot.bounces, 2);
    assert.ok(collisionTick > 18); assert.equal(r.state.projectiles.length, 0);
    close(r.rival.hp, guard === "front" ? 100 : 100 - 16 * 1.02 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    assert.ok(r.state.effects.some(e => e.kind === (guard === "front" ? "block" : "hit") && e.impact === "special"));
    r.advance(30); assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    emit("special-contact", { side, guard, firstShot, collisionTick, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("the prize completes exactly two floor bounces and one terminal explosion without a target", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 830); r.inputs[side].actions.special++;
    const bounces: { tick: number; age: number; x: number; y: number; vy: number; remaining: number }[] = [];
    let previousBounces = 2;
    for (let n = 0; n < 118; n++) {
      r.advance(1); const shot = r.state.projectiles[0];
      if (shot && (shot.bounces ?? 0) < previousBounces) { previousBounces = shot.bounces ?? 0; bounces.push({tick: r.state.tick - INTRO_TOTAL_TICKS, age: shot.age ?? 0, x: shot.x, y: shot.y, vy: shot.vy ?? 0, remaining: previousBounces}); }
    }
    assert.deepEqual(bounces.map(b => ({tick:b.tick,age:b.age,remaining:b.remaining})), [{tick:58,age:41,remaining:1},{tick:93,age:76,remaining:0}]);
    assert.ok(bounces.every(b => b.vy < 0 && b.y === WORLD.floor - 21));
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    const blasts = r.state.effects.filter(e => e.kind === "special" && e.owner === side && e.strength === 1.5);
    assert.equal(blasts.length, 1); close(blasts[0].x, side === 0 ? 834 : 246); close(blasts[0].y, 534.484375);
    emit("two-bounce-expiry", {side,bounces,expiryTick:r.state.tick-INTRO_TOTAL_TICKS,blast:blasts[0]});
  }
});

test("the terminal prize blast obeys directional guards and does not hit twice", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, guard === "rear" ? 550 : 720);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(118);
    assert.equal(r.state.projectiles.length, 0);
    close(r.rival.hp, guard === "front" ? 100 : 100 - 16 * 1.02 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    assert.ok(r.state.effects.some(e => e.kind === "special" && e.strength === 1.5));
    assert.ok(r.state.effects.some(e => e.kind === (guard === "front" ? "block" : "hit") && e.owner === side));
    const hp = r.rival.hp; r.advance(10); close(r.rival.hp, hp);
    emit("blast-guard", {side,guard,tick:118,hp,hits:r.player.hits,x:r.rival.x});
  }
});

test("Sarcos recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Doble sorpresa" : "Calienta el show"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 1.02 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Doble sorpresa" : "Calienta el show");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Premio mayor"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - (28 * 1.02 + 12) * 1.03); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Sarcos intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Sarcos", fighter: "sarcos", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
test("a complete Sarcos fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
