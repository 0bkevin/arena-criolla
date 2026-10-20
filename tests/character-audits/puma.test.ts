import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, samplePose, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 200, wins = 3) {
  const configs = [
    { name: "Audit Puma", fighter: "puma" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "puma-v28-audit");
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
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "puma", check, evidence })); }

test("Puma retains researched identity, one forward roar and one-shot presentation in both facings", () => {
  const f = fighterById("puma"), p = presentationById("puma");
  assert.equal(f.name, "José Luis Rodríguez"); assert.equal(f.shortName, "El Puma"); assert.equal(f.ability, "roar");
  assert.equal(f.special, "Rugido del Puma"); assert.deepEqual(f.combos, ["Primer rugido", "Crescendo", "Último aplauso"]);
  assert.equal(TECHNIQUES.roar.startup, 16); assert.equal(TECHNIQUES.roar.projectile, undefined); assert.equal(TECHNIQUES.roar.radial, undefined);
  assert.equal(p.introStyle, "defiant"); assert.equal(p.selectionStyle, "defiant"); assert.equal(p.battleFrame, 1);
  for (const ms of [2800, 5600, 14000]) assert.equal(selectionProgress("puma", ms), 1);
  for (const beats of [p.introBeats, p.selectionBeats]) { const end = samplePose(beats, 1); assert.equal(end.frame, 1); assert.equal(end.dx, 0); assert.equal(end.dy, 0); assert.deepEqual(samplePose(beats, 2), end); }
  assert.deepEqual(sampleGesture("puma", 1), sampleGesture("puma", 2));
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("puma", frame, facing), facing);
  emit("presentation", { intro: p.introName, choreography: CHOREOGRAPHIES.puma.name, durationMs: p.durationMs });
});

test("Puma walks both directions, double jumps, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > 620); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 80); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10); r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start: 540, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("Puma light and heavy connect once and respect forward guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.12 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1); assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, targetEnergy: r.rival.energy });
  }
});

test("Rugido del Puma hits once at startup16, blocks front guard, defeats rear guard and obeys energy gate on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 200); const origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    r.advance(14); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    r.advance(1); const hit = { tick: r.state.tick, hp: r.rival.hp, vx: r.rival.vx, vy: r.rival.vy, energy: r.rival.energy };
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.x, origin);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.ok(r.state.effects.some(e => e.kind === "block" && e.impact === "special")); }
    else { close(r.rival.hp, 100 - 16 * 1.12 * 1.03); assert.equal(r.player.hits, 1); assert.ok(r.rival.vy < 0); }
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    r.advance(40); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.player.attack, null); assert.equal(r.player.cooldown, 0);
    emit("special", { side, guard, positions: [origin, origin + (side === 0 ? 200 : -200)], energyAfterCost: 75, hit, hpAt56Calls: r.rival.hp, hits: r.player.hits, targetX: r.rival.x, attackerEnergy: r.player.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.player.hits, 0); }
});

test("Puma forward roar range is exclusive at260 and misses a rival behind the locked facing", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 200, 259, 260, 280]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(16);
    assert.equal(r.player.hits, gap < 260 ? 1 : 0);
    emit("range", { side, gap, hp: r.rival.hp, hits: r.player.hits, targetX: r.rival.x });
  }
  for (const side of [0, 1] as const) {
    const r = setup(side, 80); r.inputs[side].actions.special++; r.advance(1);
    r.rival.x = r.player.x + (side === 0 ? -80 : 80); r.advance(15);
    assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100);
    emit("rear-target", { side, attackerX: r.player.x, targetX: r.rival.x, lockedFacing: r.player.facing, hits: r.player.hits });
  }
});

test("Puma recognizes combo upgrades, connects full chains with approach inputs and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Crescendo" : "Primer rugido"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 1.12 + (wins ? 7 : 3)) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0);
      const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) {
          const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1);
        }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8);
        r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Crescendo" : "Primer rugido");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "puma"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Último aplauso"); assert.equal(r.player.comboBonus, 12); assert.equal(r.state.finale, undefined); assert.equal(r.player.attack, null); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Puma intro rejects movement and attacks until the shared timeline ends", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "Puma", fighter: "puma" as const, wins: 3 }, { name: "Javier", fighter: "javier" as const, wins: 3 }];
    const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
  }
});

function cpuFight() {
  const r = setup(0, 420, 3); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 245 && Math.abs(dx) > 145 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < 120 || r.player.x > 960) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0);
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Puma fight versus normal CPU finishes and exactly replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
