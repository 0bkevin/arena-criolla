import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [{ name: "Audit MCM", fighter: "mcm" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "mcm-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "mcm", check, evidence: value })); }

test("MCM retains her identity, unique rally hop and one-shot facing presentation", () => {
  const f = fighterById("mcm"), presentation = presentationById("mcm");
  assert.equal(f.name, "María Corina Machado"); assert.equal(f.ability, "rally"); assert.equal(f.special, "Marcha firme");
  assert.deepEqual(f.combos, ["Paso decidido", "Impulso doble", "Hasta el final"]);
  assert.deepEqual(TECHNIQUES.rally.dash, { speed: 13, ticks: 14, invincibility: 5, lift: -6.5, brake: 0.3 });
  assert.equal(presentation.introStyle, "defiant"); assert.equal(presentation.battleFrame, 1);
  assert.equal(selectionProgress("mcm", 2800), 1); assert.equal(selectionProgress("mcm", 5600), 1);
  assert.equal(presentation.introBeats.at(-1)?.frame, 1); assert.equal(presentation.selectionBeats.at(-1)?.frame, 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("mcm", frame, facing), facing);
  emit("presentation", { intro: presentation.introName, choreography: CHOREOGRAPHIES.mcm.name, durationMs: presentation.durationMs });
});

test("MCM walks both ways, faces movement, double jumps, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    const start = r.player.x; r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > start + 100); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 100); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y, stocks: r.player.stocks });
  }
});

test("MCM light and heavy connect once and respect forward guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.92 * 1.03);
    assert.equal(r.player.hits, guard ? 0 : 1); assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits, targetEnergy: r.rival.energy });
  }
});

test("Marcha firme catches delayed contact, hops, brakes and respects front/rear guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 220); const origin = r.player.x; const impacts: unknown[] = []; const blocks = new Set<number>();
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    let minY = r.player.y, peakSpeed = 0, movedAtStartup = 0;
    for (let n = 1; n < 80; n++) {
      const hp = r.rival.hp; r.advance(1); minY = Math.min(minY, r.player.y); peakSpeed = Math.max(peakSpeed, Math.abs(r.player.vx));
      if (r.player.attackTick === 10) movedAtStartup = r.player.x;
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, playerX: r.player.x, targetX: r.rival.x });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(peakSpeed, 13); assert.ok(minY < WORLD.floor - 25);
    assert.ok((r.player.x - origin) * (side === 0 ? 1 : -1) > 180);
    assert.ok(Math.abs(r.player.vx) < 0.001); assert.equal(r.player.stocks, 2); assert.equal(r.player.grounded, true);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 85.786); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); }
    emit("special", { side, guard, origin, movedAtStartup, finalX: r.player.x, minY, peakSpeed, finalVx: r.player.vx, impacts, blockCount: blocks.size, hp: r.rival.hp, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.player.dash, 0); }
});

test("rally travel covers its active window and a distant whiff stops without ringout on both sides", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 180, 270, 278, 279, 280, 300, 345, 400, 620]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(100);
    assert.equal(r.player.stocks, 2); assert.equal(r.player.grounded, true); assert.ok(Math.abs(r.player.vx) < 0.001);
    assert.equal(r.player.hits, gap <= 278 ? 1 : 0);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, finalX: r.player.x, finalVx: r.player.vx });
  }
});

test("MCM recognizes whiff chains and connects chased combos, with win and energy gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Impulso doble" : "Paso decidido"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.92 + (wins ? 7 : 3)) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp });
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
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Impulso doble" : "Paso decidido");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "mcm"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Hasta el final"); assert.equal(r.player.comboBonus, 12); assert.equal(r.state.finale, undefined); assert.equal(r.player.attack, null); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("MCM intro blocks action until the shared timeline completes and faces the rival on either side", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "MCM", fighter: "mcm" as const, wins: 3 }, { name: "Javier", fighter: "javier" as const, wins: 3 }] as const;
    const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
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
      const action = Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 345 && Math.abs(dx) > 180 && r.player.energy >= 25 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < WORLD.left + 50 || r.player.x > WORLD.right - 50) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0 && e.impact) landed.add(e.impact);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete MCM fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
