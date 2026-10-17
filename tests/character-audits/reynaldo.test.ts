import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Reynaldo", fighter: "reynaldo" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "reynaldo-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "reynaldo", check, evidence: value })); }

test("Reynaldo retains researched llanero identity and one-shot presentation in both facings", () => {
  const f = fighterById("reynaldo");
  assert.equal(f.name, "Reynaldo Armas"); assert.equal(f.ability, "lasso"); assert.equal(f.special, "Lazo sabanero");
  assert.deepEqual(f.combos, ["Paso del llano", "Vuelta sabanera", "Caballo de oro"]);
  assert.equal(TECHNIQUES.lasso.projectile?.pulls, true); assert.equal(TECHNIQUES.lasso.projectile?.slowTicks, 25);
  assert.equal(TECHNIQUES.lasso.projectile?.returnAfter, 28);
  assert.equal(presentationById("reynaldo").introStyle, "present"); assert.equal(presentationById("reynaldo").prop, "microphone");
  assert.equal(presentationById("reynaldo").battleFrame, 1);
  assert.equal(selectionProgress("reynaldo", 2800), 1); assert.equal(selectionProgress("reynaldo", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("reynaldo", frame, facing), facing);
  emit("presentation", { intro: presentationById("reynaldo").introName, choreography: CHOREOGRAPHIES.reynaldo.name });
});

test("Reynaldo walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
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

test("Reynaldo light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.06 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, energy: r.rival.energy });
  }
});

test("Lazo sabanero pulls and briefly slows idle/rear guards while forward guard prevents both on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 200);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; vx: number; damage: number; kind: string; slowTicks: number; returnAfter: number }>();
    const impacts: { tick: number; hp: number; vx: number; slowTicks: number; stun: number; gap: number }[] = [];
    const slowMovement: { tick: number; slowTicks: number; stun: number; vx: number; grounded: boolean }[] = [];
    const blocks = new Set<number>();
    let maxSlow = 0;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 130; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, damage: p.damage, kind: p.kind, slowTicks: p.slowTicks ?? 0, returnAfter: p.returnAfter ?? 0 });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx, slowTicks: r.rival.slowTicks, stun: r.rival.stun, gap: Math.abs(r.rival.x - r.player.x) });
      maxSlow = Math.max(maxSlow, r.rival.slowTicks);
      if (r.rival.slowTicks && !r.rival.stun && !r.state.hitstop) slowMovement.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, slowTicks: r.rival.slowTicks, stun: r.rival.stun, vx: r.rival.vx, grounded: r.rival.grounded });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 1); assert.equal([...shots.values()][0].tick, 17);
    const shot = [...shots.values()][0]; assert.equal(shot.vx, side === 0 ? 10 : -10); close(shot.damage, 11.66); assert.equal(shot.kind, "lasso"); assert.equal(shot.slowTicks, 25); assert.equal(shot.returnAfter, 28);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.slowTicks, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 1); assert.equal(maxSlow, 0); assert.equal(impacts.length, 0); }
    else {
      close(r.rival.hp, 100 - 11 * 1.06 * 1.03); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1);
      const impact = impacts[0]; assert.equal(impact.slowTicks, 25); assert.equal(Math.sign(impact.vx), side === 0 ? -1 : 1); assert.ok(slowMovement.length > 0);
    }
    emit("special", { side, guard, shots: [...shots.values()], impacts, blocks: blocks.size, maxSlow, slowMovement, finalHp: r.rival.hp, targetX: r.rival.x });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("an unobstructed lasso reverses once at age 28 and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 450); r.inputs[side].actions.special++;
    const samples: { tick: number; age: number; x: number; vx: number; life: number }[] = [];
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) if ([1, 27, 28, 29, 54].includes(p.age ?? 0)) samples.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, age: p.age ?? 0, x: p.x, vx: p.vx, life: p.life });
    }
    assert.deepEqual(samples.map(p => p.age), [1, 27, 28, 29, 54]);
    for (const p of samples) assert.equal(p.vx, (p.age < 28 ? 10 : -10) * (side === 0 ? 1 : -1));
    assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(r.state.projectiles.length, 0);
    emit("returning-lasso", { side, playerX: r.player.x, rivalX: r.rival.x, samples });
  }
});

test("a missed outbound lasso can connect from behind on return and be blocked facing its incoming direction", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 450); r.inputs[side].actions.special++;
    for (let n = 0; n < 42; n++) r.advance(1);
    const shot = r.state.projectiles[0]; assert.ok(shot); assert.equal(shot.age, 26);
    r.rival.x = r.player.x + (side === 0 ? 150 : -150);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    let impact: { tick: number; direction: number; vx: number; slowTicks: number } | null = null;
    const blocks = new Set<number>();
    let maxSlow = 0;
    for (let n = 0; n < 45; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp < hp) impact = { tick: r.state.tick - INTRO_TOTAL_TICKS, direction: r.state.effects.find(e => e.kind === "hit" && e.owner === side)?.direction ?? 0, vx: r.rival.vx, slowTicks: r.rival.slowTicks };
      maxSlow = Math.max(maxSlow, r.rival.slowTicks);
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    if (guard === "rear") { assert.equal(impact, null); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 1); assert.equal(maxSlow, 0); }
    else {
      assert.ok(impact); assert.equal(impact.direction, side === 0 ? -1 : 1); assert.equal(Math.sign(impact.vx), side === 0 ? -1 : 1); assert.equal(impact.slowTicks, 25);
      assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - 11 * 1.06 * 1.03); assert.equal(blocks.size, 0);
    }
    emit("return-hit", { side, guard, relocationTick: 42, gap: 150, impact, blocks: blocks.size, maxSlow });
  }
});

test("lasso slowdown applies a 0.6 movement-speed multiplier after hit stun ends", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 200); r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) { r.advance(1); if (r.rival.slowTicks > 1 && r.rival.stun === 0 && !r.state.hitstop) break; }
    assert.equal(r.rival.grounded, true); assert.ok(r.rival.slowTicks > 1); assert.equal(r.rival.stun, 0);
    const control = structuredClone(r.state); control.players[1 - side].slowTicks = 0;
    const direction = side === 0 ? 1 : -1;
    r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const vxBefore = r.rival.vx;
    const speed = fighterById(r.rival.config.fighter).speed;
    stepMatch(r.state, r.inputs); stepMatch(control, r.inputs);
    close(r.rival.vx, vxBefore + (direction * speed * 0.6 - vxBefore) * 0.35);
    close(control.players[1 - side].vx, vxBefore + (direction * speed - vxBefore) * 0.35);
    emit("slow-multiplier", { side, tick: r.state.tick - INTRO_TOTAL_TICKS, slowTicks: r.rival.slowTicks, slowedVx: r.rival.vx, controlVx: control.players[1 - side].vx, multiplier: 0.6 });
  }
});

test("Reynaldo recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Vuelta sabanera" : "Paso del llano"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 1.06 + (wins ? 7 : 3)) * 1.03);
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Vuelta sabanera" : "Paso del llano");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [2, 100], [3, 74], [3, 75], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy;
      r.inputs[side].actions.super++; r.advance(9);
      if (wins < 3 || energy < 75) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Caballo de oro"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - (28 * 1.06 + 12) * 1.03); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Reynaldo intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [{ name: "Reynaldo", fighter: "reynaldo", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }]);
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
      const action = Math.abs(dx) < 230 && r.player.energy >= 75 ? "super" : Math.abs(dx) < 340 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Reynaldo fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
