import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, samplePose } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [{ name: "Audit Norkys", fighter: "norkys" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }];
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]], "norkys-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side], direction = side === 0 ? 1 : -1;
  player.x = side === 0 ? 420 : 660; rival.x = player.x + direction * gap;
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side, direction };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "norkys", check, evidence })); }

test("Norkys retains identity, two radial pivot pulses, and one-shot presentations in both facings", () => {
  const f = fighterById("norkys"), p = presentationById("norkys");
  assert.equal(f.name, "Norkys Batista"); assert.equal(f.ability, "pivot"); assert.equal(f.special, "Pivote de escena");
  assert.deepEqual(f.combos, ["Cambio de perfil", "Giro de escena", "Pivote doble"]);
  assert.deepEqual(TECHNIQUES.pivot.pulses, [0, 15]); assert.equal(TECHNIQUES.pivot.radial, true);
  assert.equal(p.introName, "Se yergue y cruza los brazos"); assert.equal(p.battleFrame, 1);
  assert.equal(selectionProgress("norkys", 2800), 1); assert.equal(selectionProgress("norkys", 5600), 1);
  for (const beats of [p.introBeats, p.selectionBeats]) {
    assert.equal(samplePose(beats, 1).frame, 1); assert.deepEqual(samplePose(beats, 1), samplePose(beats, 2));
  }
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("norkys", frame, facing), facing);
  emit("presentation", { intro: p.introName, choreography: CHOREOGRAPHIES.norkys.name, durationMs: p.durationMs });
});

test("Norkys moves and faces both directions, double-jumps, rejects a third jump and lands on either side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 950;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > 640); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 90); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10); r.inputs[side].actions.jump++; r.advance(10);
    const firstY = r.player.y; assert.ok(firstY < WORLD.floor); assert.equal(r.player.jumps, 1);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const vy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > vy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, right, left, firstY, landingY: r.player.y });
  }
});

test("Norkys light and heavy connect once and distinguish front and rear guards on either side", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard === "front" ? 100 : 100 - (action === "light" ? 7 : 13) * 0.95 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(Math.sign(r.rival.vx), r.direction);
    r.advance(40); assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits });
  }
});

test("pivot leaps backward at startup, emits exactly two pulses and brakes within a bounded displacement on either side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 350), start = r.player.x, pulses: number[] = []; let lowest = WORLD.floor;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    const effects = new Set(r.state.effects.map(e => e.id));
    for (let n = 1; n < 120; n++) {
      r.advance(1); lowest = Math.min(lowest, r.player.y);
      for (const e of r.state.effects) if (!effects.has(e.id)) { effects.add(e.id); if (e.kind === "special" && e.owner === side) pulses.push(r.player.attackTick); }
      if (r.player.attackTick === 8 && r.player.attack === "special") { close(r.player.vx, -7 * r.direction); close(r.player.vy, -12.48); assert.equal(r.player.grounded, false); }
    }
    assert.deepEqual(pulses, [8, 23]); assert.equal(r.state.projectiles.length, 0);
    close((r.player.x - start) * r.direction, -73.83212589080193);
    assert.ok(lowest < WORLD.floor - 150); assert.ok(Math.abs(r.player.vx) < 0.001); assert.equal(r.player.grounded, true);
    assert.equal(r.player.stocks, 2); assert.equal(r.rival.hp, 100);
    emit("retreat-and-braking", { side, pulses, displacement: r.player.x - start, apexY: lowest, finalVx: r.player.vx, finalY: r.player.y });
  }
});

test("frontal pivot blocks twice against a front guard and punishes idle or rear guard on either side", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; const blocks = new Set<number>(), contacts: unknown[] = [];
    for (let n = 0; n < 120; n++) { const hp = r.rival.hp; r.advance(1); if (hp !== r.rival.hp) contacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp }); for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id); }
    close(r.rival.hp, guard === "front" ? 100 : 92.172); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(blocks.size, guard === "front" ? 2 : 0);
    emit("frontal-pivot", { side, guard, hp: r.rival.hp, hits: r.player.hits, blocks: blocks.size, contacts, explanation: "First-hit knockback moves a frontal opponent beyond the second radial pulse; a close guarded opponent remains in range." });
  }
});

test("both pivot pulses damage an opponent behind Norkys, with directional guards on either player side", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, -80); r.inputs[side][side === 0 ? "right" : "left"] = true;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "left" : "right"] = true;
    r.inputs[side].actions.special++; const blocks = new Set<number>(), contacts: { tick: number; attackTick: number; hp: number; vx: number }[] = [];
    // Capture both pulses before the retreat-side target can ring out and respawn.
    for (let n = 0; n < 40; n++) { const hp = r.rival.hp; r.advance(1); r.inputs[side].left = false; r.inputs[side].right = false; if (hp !== r.rival.hp) contacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, vx: r.rival.vx }); for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id); }
    close(r.rival.hp, guard === "front" ? 100 : 84.344); assert.equal(r.player.hits, guard === "front" ? 0 : 2); assert.equal(blocks.size, guard === "front" ? 2 : 0);
    if (guard !== "front") { assert.deepEqual(contacts.map(c => c.attackTick), [8, 23]); assert.ok(Math.abs(contacts[1].vx) > Math.abs(contacts[0].vx) * 2); }
    emit("rear-radial-pulses", { side, guard, hits: r.player.hits, hp: r.rival.hp, blocks: blocks.size, contacts });
  }
});

test("pivot respects energy and range gates on either side", () => {
  for (const side of [0, 1] as const) {
    const low = setup(side, 80); low.player.energy = 24; low.inputs[side].actions.special++; low.advance(1); assert.equal(low.player.attack, null); assert.equal(low.rival.hp, 100);
    const far = setup(side, 160); far.inputs[side].actions.special++; far.advance(120); assert.equal(far.player.hits, 0); assert.equal(far.rival.hp, 100);
  }
});

test("Norkys recognizes base and upgraded combos, connects strikes with pursuit, and enforces super gates on either side", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins); for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11); assert.equal(r.player.combo, wins ? "Giro de escena" : "Cambio de perfil"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.95 + (wins ? 7 : 3)) * 1.03);
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0), attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 70 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) { const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1); }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8); r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Giro de escena" : "Cambio de perfil");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Pivote doble"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 60.242); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, combo: r.player.combo });
    }
  }
});

test("Norkys intro blocks combat until the complete shared timeline ends on either side", () => {
  for (const side of [0, 1] as const) {
    const state = createMatch("poliedro", side === 0 ? [{ name: "N", fighter: "norkys", wins: 3 }, { name: "J", fighter: "javier", wins: 3 }] : [{ name: "J", fighter: "javier", wins: 3 }, { name: "N", fighter: "norkys", wins: 3 }]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const origin = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, origin); assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
  }
});

function cpuFight() {
  const r = setup(0, 420); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 120 && dx < -75; r.inputs[0].right = n >= 120 && dx > 75;
    r.inputs[0].block = n >= 120 && r.rival.attack === "heavy" && Math.abs(dx) < 170 && r.state.tick % 100 < 25;
    if (n >= 120 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 150 && r.player.energy >= 25 && r.state.tick % 180 < 100 ? "special" : Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < 120 || r.player.x > 960) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack); for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0 && e.impact) landed.add(e.impact);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Norkys versus normal CPU fight finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
