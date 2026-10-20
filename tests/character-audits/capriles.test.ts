import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { CHOREOGRAPHIES } from "../../shared/choreography";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";

type Side = 0 | 1;
function setup(side: Side = 0, gap = 120, wins = 3) {
  const configs = [
    { name: "Audit Capriles", fighter: "capriles" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("caracas", side === 0 ? [...configs] : [configs[1], configs[0]], "capriles-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  state.players[0].x = 540 - gap / 2;
  state.players[1].x = 540 + gap / 2;
  const player = state.players[side], rival = state.players[1 - side];
  player.energy = 100;
  rival.energy = 60;
  return { state, inputs, advance, player, rival, side };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const emit = (check: string, evidence: unknown) => console.log(JSON.stringify({ character: "capriles", check, evidence }));

test("Capriles retains his researched casual identity and mirrored one-shot greeting", () => {
  const fighter = fighterById("capriles");
  assert.equal(fighter.sprite, "capriles-v39");
  assert.equal(fighter.ability, "sprint");
  assert.equal(fighter.special, "Sprint tricolor");
  assert.deepEqual(fighter.combos, ["¡Qué manguangua, ah!", "Hay un camino", "Meta tricolor"]);
  assert.equal(presentationById("capriles").battleFrame, 0);
  assert.equal(presentationById("capriles").introName, "Se yergue y cruza los brazos");
  assert.equal(presentationById("capriles").prop, "none");
  assert.equal(selectionProgress("capriles", 2800), 1);
  assert.equal(selectionProgress("capriles", 5600), 1);
  for (let frame = 0; frame < 8; frame++) {
    assert.equal(normalizedFacing("capriles", frame, 1), 1);
    assert.equal(normalizedFacing("capriles", frame, -1), -1);
  }
  emit("presentation", { choreography: CHOREOGRAPHIES.capriles.name, profile: presentationById("capriles") });
});

for (const side of [0, 1] as const) {
  test(`Capriles P${side + 1}: intro gates movement and consumed attacks until combat`, () => {
    const configs = [{ name: "C", fighter: "capriles" as const, wins: 3 }, { name: "J", fighter: "javier" as const, wins: 3 }] as const;
    const state = createMatch("caracas", side === 0 ? [...configs] : [configs[1], configs[0]]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].right = true;
    inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro");
    assert.equal(state.players[side].x, start);
    assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs);
    assert.equal(state.phase, "playing");
    assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
    inputs[side].right = false;
    stepMatch(state, inputs);
    assert.equal(state.players[side].attack, null);
  });

  test(`Capriles P${side + 1}: walks, turns, double-jumps, rejects a third jump and lands`, () => {
    const run = setup(side, 420);
    run.player.x = 540;
    run.rival.x = 900;
    const start = run.player.x;
    run.inputs[side].right = true;
    run.advance(20);
    const right = run.player.x;
    assert.ok(right > start + 100);
    assert.equal(run.player.facing, 1);
    run.inputs[side].right = false; run.inputs[side].left = true;
    run.advance(20);
    assert.ok(run.player.x < right - 90);
    assert.equal(run.player.facing, -1);
    run.inputs[side].left = false;
    run.advance(40);
    assert.ok(Math.abs(run.player.vx) < 0.001);
    assert.equal(run.player.facing, 1);
    run.inputs[side].actions.jump++;
    run.advance(10);
    assert.equal(run.player.jumps, 1);
    assert.ok(run.player.y < WORLD.floor);
    const firstJumpY = run.player.y;
    run.inputs[side].actions.jump++;
    run.advance(1);
    assert.equal(run.player.jumps, 2);
    const secondVy = run.player.vy;
    run.inputs[side].actions.jump++;
    run.advance(1);
    assert.equal(run.player.jumps, 2);
    assert.ok(run.player.vy > secondVy);
    run.advance(120);
    assert.equal(run.player.y, WORLD.floor);
    assert.equal(run.player.grounded, true);
    assert.equal(run.player.jumps, 0);
    emit("movement", { side, start, right, finalX: run.player.x, firstJumpY, finalY: run.player.y });
  });

  test(`Capriles P${side + 1}: light and heavy startup, damage, knockback and single hit`, () => {
    for (const [attack, startup, damage] of [["light", 6, 7], ["heavy", 11, 13]] as const) {
      const run = setup(side, 80);
      run.inputs[side].actions[attack]++;
      run.advance(startup - 1);
      assert.equal(run.rival.hp, 100);
      run.advance(1);
      close(100 - run.rival.hp, damage * 0.88 * 1.03);
      assert.equal(run.player.hits, 1);
      assert.equal(Math.sign(run.rival.vx), side === 0 ? 1 : -1);
      assert.ok(run.state.effects.some(e => e.kind === "hit" && e.impact === attack));
      run.advance(45);
      assert.equal(run.player.hits, 1);
      emit(attack, { side, hp: run.rival.hp, hits: run.player.hits });
    }
  });

  test(`Capriles P${side + 1}: sprint hits idle, respects facing guard, and defeats a turned guard`, () => {
    for (const guard of ["idle", "facing", "away"] as const) {
      const run = setup(side, 120);
      run.inputs[1 - side].block = guard !== "idle";
      if (guard === "away") run.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      run.inputs[side].actions.special++;
      run.advance(8);
      assert.equal(run.rival.hp, 100);
      assert.equal(run.player.dash, 0);
      run.advance(1);
      assert.equal(run.player.attack, "special");
      assert.equal(run.player.attackTick, 9);
      assert.equal(run.player.dash, TECHNIQUES.sprint.dash!.ticks);
      assert.equal(run.player.invincible, TECHNIQUES.sprint.dash!.invincibility);
      close(run.player.vx, (side === 0 ? 1 : -1) * 16);
      assert.equal(run.state.projectiles.length, 0);
      // A retreating target must actually be reached during the dash.
      for (let frame = 0; frame < 12 && !run.player.attackHit; frame++) run.advance(1);
      if (guard === "facing") {
        assert.equal(run.rival.hp, 100);
        assert.equal(run.player.hits, 0);
        assert.ok(run.rival.energy < 51);
        assert.ok(run.state.effects.some(e => e.kind === "block"));
      } else {
        close(100 - run.rival.hp, 16 * 0.88 * 1.03);
        assert.equal(run.player.hits, 1);
      }
      emit("special", { side, guard, hp: run.rival.hp, energy: run.player.energy, rivalEnergy: run.rival.energy, dash: run.player.dash, vx: run.player.vx, hits: run.player.hits });
    }
    const locked = setup(side);
    locked.player.energy = 24;
    locked.inputs[side].actions.special++;
    locked.advance(1);
    assert.equal(locked.player.attack, null);
  });

  test(`Capriles P${side + 1}: combo names and advanced/definitive win and energy gates`, () => {
    for (const wins of [0, 1]) {
      const run = setup(side, 140, wins);
      run.inputs[side].actions.light++; run.advance(23);
      run.inputs[side].actions.light++; run.advance(23);
      run.inputs[side].actions.heavy++; run.advance(11);
      assert.equal(run.player.combo, wins ? "Hay un camino" : "¡Qué manguangua, ah!");
      assert.equal(run.player.comboBonus, wins ? 7 : 3);
      close(100 - run.rival.hp, (13 * 0.88 + (wins ? 7 : 3)) * 1.03);
      assert.equal(run.player.hits, 1);
      emit("combo-gate", { side, wins, name: run.player.combo, bonus: run.player.comboBonus, hits: run.player.hits, hp: run.rival.hp, note: "setup lights are outside range; heavy lands" });
    }
    for (const wins of [0, 2, 3]) {
      const run = setup(side, 200, wins);
      run.inputs[side].actions.super++; run.advance(9);
      if (run.state.finale) run.advance(run.state.finale.duration);
      if (wins < 3) { assert.equal(run.player.attack, null); assert.equal(run.rival.hp, 100); }
      else {
        assert.equal(run.player.combo, "Meta tricolor");
        assert.equal(run.player.comboBonus, 12);
        close(100 - run.rival.hp, (28 * 0.88 + 12) * 1.03);
        assert.equal(run.player.hits, 1);
        assert.ok(run.player.energy < 39);
      }
      emit("super-gate", { side, wins, hp: run.rival.hp, energy: run.player.energy, combo: run.player.combo });
    }
    const depleted = setup(side, 200, 3);
    depleted.player.energy = 74;
    depleted.inputs[side].actions.super++; depleted.advance(1);
    assert.equal(depleted.player.attack, null);
  });
}

test("Sprint distance and recovery probes log actual dash crossing and post-dash behavior", () => {
  for (const side of [0, 1] as const) for (const gap of [120, 214, 215, 220, 240, 300, 420]) {
    const run = setup(side, gap);
    run.inputs[side].actions.special++;
    const startX = run.player.x;
    const rivalStartX = run.rival.x;
    let crossing: number | null = null;
    let closestDuringDash = Infinity;
    let dashEnded: { step: number; attackTick: number; x: number; vx: number } | null = null;
    for (let n = 1; n <= 40; n++) {
      run.advance(1);
      if (run.player.dash) closestDuringDash = Math.min(closestDuringDash, Math.abs(run.player.x - run.rival.x));
      if (crossing === null && (run.player.x - run.rival.x) * (side === 0 ? 1 : -1) >= 0) crossing = n;
      if (!dashEnded && n > 9 && !run.player.dash) dashEnded = { step: n, attackTick: run.player.attackTick, x: run.player.x, vx: run.player.vx };
      assert.ok(Number.isFinite(run.player.x) && Number.isFinite(run.rival.x));
    }
    emit("range-probe", { side, gap, hp: run.rival.hp, hits: run.player.hits, crossing, closestDuringDash, dashEnded, displacement: Math.abs(run.player.x - startX), rivalDisplacement: Math.abs(run.rival.x - rivalStartX), stocks: run.player.stocks });
  }
  for (const side of [0, 1] as const) {
    const run = setup(side, 700);
    const startX = run.player.x;
    run.inputs[side].actions.special++;
    const samples = [];
    for (let step = 1; step <= 50; step++) {
      run.advance(1);
      assert.ok(Number.isFinite(run.player.x));
      if ([9, 20, 21, 39, 40, 41, 42, 50].includes(step)) samples.push({ step, x: run.player.x, vx: run.player.vx, dash: run.player.dash, attack: run.player.attack, attackTick: run.player.attackTick, cooldown: run.player.cooldown, displacement: Math.abs(run.player.x - startX) });
    }
    emit("empty-lane-recovery", { side, samples });
  }
});

test("Both named Capriles input combos can connect all strikes with actual approach inputs", () => {
  for (const side of [0, 1] as const) for (const advanced of [false, true]) {
    const run = setup(side, 80, advanced ? 1 : 0);
    const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
    for (const attack of attacks) {
      for (let n = 0; n < 70 && (run.player.cooldown || Math.abs(run.rival.x - run.player.x) > 80 || !run.rival.grounded); n++) {
        const dx = run.rival.x - run.player.x;
        run.inputs[side].left = dx < -70; run.inputs[side].right = dx > 70;
        run.advance(1);
      }
      run.inputs[side].left = false; run.inputs[side].right = false;
      run.advance(8);
      run.inputs[side].actions[attack]++;
      run.advance(attack === "light" ? 23 : 14);
    }
    assert.equal(run.player.hits, attacks.length);
    assert.equal(run.player.combo, advanced ? "Hay un camino" : "¡Qué manguangua, ah!");
    assert.equal(run.player.comboBonus, advanced ? 7 : 3);
    emit("connected-combo", { side, name: run.player.combo, hits: run.player.hits, hp: run.rival.hp, elapsed: run.state.tick - INTRO_TOTAL_TICKS });
  }
});

function cpuBout() {
  const run = setup(0, 420, 3);
  const started = new Set<string>();
  let steps = 0;
  for (; steps < 6500 && run.state.phase !== "finished"; steps++) {
    const p = run.player, target = run.rival, dx = target.x - p.x;
    run.inputs[0].left = steps >= 180 && dx < -80;
    run.inputs[0].right = steps >= 180 && dx > 80;
    run.inputs[0].block = steps >= 180 && target.attack === "heavy" && Math.abs(dx) < 160 && run.state.tick % 120 < 30;
    if (steps >= 180 && !p.cooldown && !p.stun && !run.inputs[0].block && Math.abs(dx) < 220) {
      const attack = p.energy >= 75 && run.state.tick % 180 < 30 ? "super" : p.energy >= 25 && run.state.tick % 100 < 35 ? "special" : Math.abs(dx) < 145 ? run.state.tick % 3 ? "light" : "heavy" : null;
      if (attack) run.inputs[0].actions[attack]++;
    }
    if ((target.y < p.y - 70 || p.x < 120 || p.x > 960) && p.jumps < 2 && run.state.tick % 34 === 0) run.inputs[0].actions.jump++;
    run.inputs[1] = cpuInput(run.state, run.inputs[1], "normal");
    const before = p.attack;
    run.advance(1);
    if (p.attack && p.attack !== before) started.add(p.attack);
    for (const player of run.state.players) {
      assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
      assert.ok(player.hp >= 0 && player.hp <= 100);
    }
  }
  assert.equal(run.state.phase, "finished");
  assert.ok(run.player.hits > 0 && run.rival.hits > 0);
  assert.ok(started.has("special"));
  return { state: run.state, steps, started: [...started] };
}
test("A full Capriles bout against normal CPU finishes and replays deterministically", () => {
  const first = cpuBout(), second = cpuBout();
  assert.deepEqual(first, second);
  emit("cpu-bout", { steps: first.steps, tick: first.state.tick, remaining: first.state.remaining, winner: first.state.winner, started: first.started, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});

test("P2 Capriles CPU selects and connects his own sprint special in range", () => {
  const run = setup(1, 120, 0);
  run.state.tick = 600;
  run.player.energy = 50;
  run.inputs[1] = cpuInput(run.state, run.inputs[1], "hard");
  assert.equal(run.inputs[1].actions.special, 1);
  run.advance(9);
  assert.equal(run.player.attack, "special");
  assert.equal(run.player.hits, 1);
  close(run.rival.hp, 85.4976);
  emit("cpu-special", { hp: run.rival.hp, actorX: run.player.x, dash: run.player.dash, hits: run.player.hits });
});
