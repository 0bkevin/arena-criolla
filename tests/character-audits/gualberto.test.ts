import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Gualberto", fighter: "gualberto" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "gualberto-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "gualberto", check, evidence: value })); }

test("Gualberto retains his researched identity, paired returning notes, one-shot selection and both facings", () => {
  const f = fighterById("gualberto");
  assert.equal(f.name, "Gualberto Ibarreto"); assert.equal(f.ability, "tremolo"); assert.equal(f.special, "Tremolo oriental");
  assert.deepEqual(f.combos, ["Cerecita", "Galerón cruzado", "Doble tremolo"]);
  assert.equal(TECHNIQUES.tremolo.projectile?.count, 2); assert.equal(TECHNIQUES.tremolo.projectile?.spread, 3); assert.equal(TECHNIQUES.tremolo.projectile?.returnAfter, 22);
  assert.equal(presentationById("gualberto").introStyle, "strum");
  assert.equal(presentationById("gualberto").battleFrame, 1);
  assert.equal(selectionProgress("gualberto", 2800), 1); assert.equal(selectionProgress("gualberto", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("gualberto", frame, facing), facing);
  emit("presentation", { intro: presentationById("gualberto").introName, choreography: CHOREOGRAPHIES.gualberto.name });
});

test("Gualberto walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Gualberto light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.98 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Tremolo oriental emits paired separated notes, lands against idle/rear guards and blocks twice at forward guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 120); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? 120 : -120);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { call: number; vx: number; vy: number; y: number; damage: number }>();
    const impacts: unknown[] = [], blocks = new Set<number>(); const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let call = 2; call <= 120; call++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { call, vx: p.vx, vy: p.vy ?? 0, y: p.y, damage: p.damage });
      if (r.rival.hp < hp) impacts.push({ call, tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 2); const notes = [...shots.values()];
    assert.ok(notes.every(p => p.call === 10 && p.vx === (side === 0 ? 7.5 : -7.5)));
    assert.deepEqual(notes.map(p => p.vy), [-1.5, 1.5]); close(notes[1].y - notes[0].y, 3);
    assert.ok(notes.every(p => p.damage === 9 * 0.98));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 2); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 81.8308); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); }
    emit("special-outbound", { side, guard, notes, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035);
  }
});

test("both notes reverse horizontally at age22 while their vertical paths continue apart and expire at age64", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? 280 : -280);
    r.inputs[side].actions.special++; r.advance(10); assert.equal(r.state.projectiles.length, 2);
    const direction = side === 0 ? 1 : -1, origin = r.player.x;
    r.advance(20); const before = r.state.projectiles.map(p => ({ age: p.age, x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    assert.ok(before.every(p => p.age === 21 && p.vx === direction * 7.5));
    close(before[0].x, origin + direction * 205.5); close(before[1].y - before[0].y, 63);
    r.advance(1); const after = r.state.projectiles.map(p => ({ age: p.age, x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    assert.ok(after.every(p => p.age === 22 && p.vx === direction * -7.5));
    close(after[0].x, origin + direction * 198); close(after[1].y - after[0].y, 66);
    assert.deepEqual(after.map(p => p.vy), [-1.5, 1.5]);
    r.advance(41); assert.ok(r.state.projectiles.every(p => p.age === 63)); r.advance(1); assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.rival.hp, 100); assert.equal(r.player.x, origin);
    emit("paired-return-path", { side, before, after, expiredCall: 73, hp: r.rival.hp });
  }
});

test("returning notes strike a jumping rival and guard direction follows the incoming return on both sides", () => {
  for (const side of [0, 1] as const) {
    const jump = setup(side, 120); jump.player.x = side === 0 ? 360 : 720; jump.rival.x = jump.player.x + (side === 0 ? 120 : -120);
    jump.inputs[1 - side].actions.jump++; jump.inputs[side].actions.special++;
    const impacts: unknown[] = [];
    for (let call = 1; call <= 120; call++) { const hp = jump.rival.hp; jump.advance(1); if (jump.rival.hp < hp) { assert.equal(Math.sign(jump.rival.vx), side === 0 ? -1 : 1); impacts.push({ call, hp: jump.rival.hp, y: jump.rival.y, vx: jump.rival.vx }); } }
    assert.equal(jump.player.hits, 1); close(jump.rival.hp, 90.9154); emit("jump-return", { side, impacts });
    for (const guard of ["idle", "toward-actor", "toward-return"] as const) {
      const r = setup(side, 120); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? 120 : -120);
      // Isolate inbound collisions with the engine's normal invulnerability timer.
      r.rival.invincible = 32; r.inputs[1 - side].block = guard !== "idle";
      if (guard === "toward-return") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      r.inputs[side].actions.special++; const hits: unknown[] = [], blocks = new Set<number>();
      for (let call = 1; call <= 120; call++) { const hp = r.rival.hp; r.advance(1); if (r.rival.hp < hp) { assert.equal(Math.sign(r.rival.vx), side === 0 ? -1 : 1); hits.push({ call, tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx }); } for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id); }
      if (guard === "toward-return") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 2); }
      else { close(r.rival.hp, 81.8308); assert.equal(r.player.hits, 2); assert.equal(blocks.size, 0); }
      emit("return-guard", { side, guard, hits, blocks: blocks.size });
    }
  }
});

test("tremolo range probes distinguish two close hits, one midrange hit and the horizontal return boundary", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 120, 180, 220, 247, 248, 280, 380]) {
    const r = setup(side, gap); r.player.x = side === 0 ? 360 : 720; r.rival.x = r.player.x + (side === 0 ? gap : -gap);
    r.inputs[side].actions.special++; r.advance(120);
    assert.equal(r.player.hits, gap <= 120 ? 2 : gap <= 247 ? 1 : 0);
    close(r.rival.hp, 100 - r.player.hits * 9 * 0.98 * 1.03); assert.equal(r.player.stocks, 2); assert.equal(r.rival.stocks, 2);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits });
  }
});

test("Gualberto recognizes both combos from zero wins, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, "Galerón cruzado"); assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 0.98 + 7) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Galerón cruzado" : "Cerecita");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 90], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Doble tremolo"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 59.3768); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Gualberto intro blocks action on either side until the full shared timeline completes", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "Gualberto", fighter: "gualberto" as const, wins: 3 }, { name: "Javier", fighter: "javier" as const, wins: 3 }] as const;
    const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.projectiles.length, 0);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
  }
});

function cpuFight() {
  const r = setup(0, 220, 3); r.inputs[0].actions.special++; let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 245 && Math.abs(dx) > 120 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Gualberto fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
