import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, presentationById, selectionProgress, normalizedFacing } from "../../shared/presentation";

function setup(side: 0 | 1 = 0, gap = 120, wins = 3) {
  const configs = [
    { name: "Audit Vicente", fighter: "zavarce" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]]);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  for (let n = 0; n < INTRO_TOTAL_TICKS; n++) stepMatch(state, inputs);
  const player = state.players[side];
  const rival = state.players[1 - side];
  player.x = side === 0 ? 250 : 830;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 60;
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  return { state, inputs, player, rival, advance, side };
}

test("Zavarce content and one-shot presentation retain their identity and facing", () => {
  const fighter = fighterById("zavarce");
  assert.equal(fighter.ability, "courier");
  assert.equal(fighter.special, "Entrega exprés");
  assert.deepEqual(fighter.combos, ["Pedido confirmado", "Ruta directa", "Cohete a domicilio"]);
  assert.equal(presentationById("zavarce").introStyle, "defiant");
  assert.equal(presentationById("zavarce").prop, "none");
  assert.equal(selectionProgress("zavarce", 2800), 1);
  assert.equal(selectionProgress("zavarce", 5600), 1);
  for (let frame = 0; frame < 8; frame++) {
    assert.equal(normalizedFacing("zavarce", frame, 1), 1);
    assert.equal(normalizedFacing("zavarce", frame, -1), -1);
  }
});

test("Zavarce walks both directions, turns, double-jumps, rejects a third jump, and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side, 420);
    run.player.x = 540;
    run.rival.x = 900;
    const points: Record<string, number> = { start: run.player.x };
    run.inputs[side].right = true;
    run.advance(24);
    points.right = run.player.x;
    assert.ok(points.right > points.start + 100);
    assert.equal(run.player.facing, 1);
    run.inputs[side].right = false;
    run.inputs[side].left = true;
    run.advance(24);
    points.left = run.player.x;
    assert.ok(points.left < points.right - 100);
    assert.equal(run.player.facing, -1);
    run.inputs[side].left = false;
    run.advance(10);
    run.inputs[side].actions.jump++;
    run.advance(10);
    assert.equal(run.player.jumps, 1);
    assert.ok(run.player.y < WORLD.floor);
    run.inputs[side].actions.jump++;
    run.advance(1);
    assert.equal(run.player.jumps, 2);
    const secondVelocity = run.player.vy;
    run.inputs[side].actions.jump++;
    run.advance(1);
    assert.equal(run.player.jumps, 2);
    assert.ok(run.player.vy > secondVelocity);
    run.advance(90);
    assert.equal(run.player.grounded, true);
    assert.equal(run.player.y, WORLD.floor);
    console.log("movement", JSON.stringify({ side, ...points, finalY: run.player.y, stocks: run.player.stocks }));
  }
});

test("Zavarce light and heavy land once, with the correct damage and knockback, on both sides", () => {
  for (const side of [0, 1] as const) for (const attack of ["light", "heavy"] as const) {
    const run = setup(side, 80);
    run.inputs[side].actions[attack]++;
    run.advance(attack === "light" ? 8 : 13);
    const expected = (attack === "light" ? 7 : 13) * 0.94 * 1.03;
    assert.ok(Math.abs(100 - run.rival.hp - expected) < 1e-9);
    assert.equal(run.player.hits, 1);
    assert.equal(Math.sign(run.rival.vx), side === 0 ? 1 : -1);
    assert.ok(run.state.effects.some(e => e.kind === "hit" && e.impact === attack));
    run.advance(35);
    assert.equal(run.player.hits, 1);
    console.log("attack", JSON.stringify({ side, attack, damage: expected, hp: run.rival.hp, hits: run.player.hits }));
  }
});

test("Entrega exprés summons seven motorcycles together in a compact formation and recovers without dashing", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side, 600, 0);
    run.rival.invincible = 1000;
    const startX = run.player.x;
    const spawned = new Map<number, number>();
    run.inputs[side].actions.special++;
    run.advance(1);
    assert.ok(run.player.energy < 76, "one activation costs 25 energy");
    for (let frame = 2; frame <= 200; frame++) {
      run.advance(1);
      for (const shot of run.state.projectiles) {
        if (!spawned.has(shot.id)) spawned.set(shot.id, frame);
        assert.equal(shot.kind, "courier");
        assert.equal(shot.vx, (side === 0 ? 1 : -1) * 8.5);
        assert.equal(shot.y, WORLD.floor - 42);
        assert.equal(shot.groundOnly, true);
      }
    }
    assert.deepEqual([...spawned.values()], Array(7).fill(12));
    assert.equal(run.player.x, startX);
    assert.equal(run.player.dash, 0);
    assert.equal(run.player.invincible, 0);
    assert.equal(run.player.attack, null);
    assert.equal(run.player.cooldown, 0);
    assert.equal(run.state.projectiles.length, 0, "unconnected bikes expire");
    assert.equal(run.player.hits, 0);
  }
});

test("the compact Yummy pack hits or is blocked on either side, with each motorcycle consumed once", () => {
  for (const side of [0, 1] as const) {
    for (const gap of [120, 420]) {
      for (const blocking of [false, true]) {
        const run = setup(side, gap);
        run.rival.energy = 100;
        run.inputs[1 - side].block = blocking;
        run.inputs[side].actions.special++;
        let blockEffects = 0;
        let lastEffect = -1;
        for (let frame = 0; frame < 150; frame++) {
          run.advance(1);
          for (const effect of run.state.effects) {
            if (effect.id > lastEffect) {
              if (effect.kind === "block") blockEffects++;
              lastEffect = effect.id;
            }
          }
        }
        assert.equal(run.state.projectiles.length, 0);
        if (blocking) assert.equal(run.player.hits, 0);
        else assert.equal(run.player.hits, gap === 120 ? 5 : 7);
        if (blocking) {
          assert.equal(run.rival.hp, 100);
          assert.equal(blockEffects, gap === 120 ? 6 : 7);
          assert.ok(run.rival.energy < 30);
        } else {
          const expected = run.player.hits * TECHNIQUES.courier.damage * 0.94 * 1.03;
          assert.ok(Math.abs(100 - run.rival.hp - expected) < 1e-9);
          assert.equal(Math.sign(run.rival.x - (side === 0 ? 250 + gap : 830 - gap)), side === 0 ? 1 : -1);
        }
      }
    }
  }
});

test("motorcycles can be jumped and cannot be summoned in midair", () => {
  for (const side of [0, 1] as const) {
    const dodge = setup(side, 120);
    dodge.inputs[side].actions.special++;
    dodge.inputs[1 - side].actions.jump++;
    dodge.advance(22);
    dodge.inputs[1 - side].actions.jump++;
    dodge.advance(128);
    assert.equal(dodge.rival.hp, 100);
    assert.equal(dodge.player.hits, 0);
    assert.equal(dodge.state.projectiles.length, 0);

    const airborne = setup(side);
    airborne.inputs[side].actions.jump++;
    airborne.advance(4);
    airborne.inputs[side].actions.special++;
    airborne.advance(1);
    assert.equal(airborne.player.attack, null);
    assert.equal(airborne.player.energy, 100);
    assert.equal(airborne.state.projectiles.length, 0);
  }
});

test("Zavarce specials, advanced combo, and definitive enforce their energy and win gates", () => {
  const special = setup();
  special.player.energy = 24;
  special.inputs[0].actions.special++;
  special.advance(1);
  assert.equal(special.player.attack, null);
  for (const wins of [0, 1, 3]) {
    const run = setup(0, 140, wins);
    run.inputs[0].actions.light++;
    run.advance(23);
    run.inputs[0].actions.light++;
    run.advance(23);
    run.inputs[0].actions.heavy++;
    run.advance(11);
    const bonus = wins >= 1 ? 7 : 3;
    assert.equal(run.player.combo, wins >= 1 ? "Ruta directa" : "Pedido confirmado");
    assert.equal(run.player.comboBonus, bonus);
    assert.ok(Math.abs((100 - run.rival.hp) - (13 * 0.94 + bonus) * 1.03) < 1e-9);
    console.log("combo-gate", JSON.stringify({ wins, combo: run.player.combo, bonus, hp: run.rival.hp, hits: run.player.hits, note: "two setup lights are deliberately outside range; the heavy lands" }));
  }
  for (const side of [0, 1] as const) for (const wins of [0, 3]) {
    const run = setup(side, 200, wins);
    run.inputs[side].actions.super++;
    run.advance(9);
    if (wins < 3) {
      assert.equal(run.player.attack, null);
      assert.equal(run.rival.hp, 100);
    } else {
      assert.equal(run.player.combo, "Cohete a domicilio");
      assert.ok(Math.abs((100 - run.rival.hp) - (28 * 0.94 + 12) * 1.03) < 1e-9);
      assert.equal(run.player.hits, 1);
      assert.ok(run.player.energy < 39);
    }
    console.log("super-gate", JSON.stringify({ side, wins, hp: run.rival.hp, energy: run.player.energy, combo: run.player.combo }));
  }
  const depleted = setup(0, 200, 3);
  depleted.player.energy = 74;
  depleted.inputs[0].actions.super++;
  depleted.advance(1);
  assert.equal(depleted.player.attack, null);
});

test("both named input combos can also connect every strike on both sides with real approach inputs", () => {
  for (const side of [0, 1] as const) for (const advanced of [false, true]) {
    const run = setup(side, 80, advanced ? 1 : 0);
    const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
    for (const attack of attacks) {
      for (let n = 0; n < 70 && (run.player.cooldown || Math.abs(run.rival.x - run.player.x) > 80 || !run.rival.grounded); n++) {
        const dx = run.rival.x - run.player.x;
        run.inputs[side].left = dx < -70;
        run.inputs[side].right = dx > 70;
        run.advance(1);
      }
      run.inputs[side].left = false;
      run.inputs[side].right = false;
      run.advance(8);
      run.inputs[side].actions[attack]++;
      run.advance(attack === "light" ? 23 : 14);
    }
    assert.equal(run.player.hits, attacks.length);
    assert.equal(run.player.combo, advanced ? "Ruta directa" : "Pedido confirmado");
    assert.equal(run.player.comboBonus, advanced ? 7 : 3);
    console.log("connected-combo", JSON.stringify({ side, combo: run.player.combo, hits: run.player.hits, hp: run.rival.hp, elapsed: run.state.tick - INTRO_TOTAL_TICKS }));
  }
});

function cpuFight() {
  const run = setup(0, 420, 3);
  run.player.x = 330;
  run.rival.x = 750;
  let cpu = emptyInput();
  const used = new Set<string>();
  for (let n = 0; n < 5400 && run.state.phase !== "finished"; n++) {
    const p = run.player, target = run.rival;
    const dx = target.x - p.x;
    run.inputs[0].left = n >= 240 && dx < -70;
    run.inputs[0].right = n >= 240 && dx > 70;
    run.inputs[0].block = n >= 240 && target.attack === "heavy" && Math.abs(dx) < 155 && run.state.tick % 120 < 30;
    if (n >= 240 && p.cooldown === 0 && !run.inputs[0].block && p.stun === 0) {
      const attack = Math.abs(dx) < 230 && p.energy >= 75 ? "super" : Math.abs(dx) < 160 && p.energy >= 25 && run.state.tick % 80 < 30 ? "special" : Math.abs(dx) < 145 ? (run.state.tick % 3 ? "light" : "heavy") : null;
      if (attack) { run.inputs[0].actions[attack]++; used.add(attack); }
    }
    if ((target.y < p.y - 70 || p.x < 120 || p.x > 960) && p.jumps < 2 && run.state.tick % 34 === 0) run.inputs[0].actions.jump++;
    cpu = cpuInput(run.state, cpu, "normal");
    run.inputs[1] = cpu;
    run.advance(1);
  }
  assert.equal(run.state.phase, "finished");
  assert.ok(run.player.hits > 0);
  assert.ok(run.rival.hits > 0);
  assert.ok(used.has("special"));
  return { state: run.state, used: [...used] };
}

test("a full Zavarce fight versus a normal CPU finishes and replays deterministically", () => {
  const first = cpuFight(), second = cpuFight();
  assert.deepEqual(first, second);
  console.log("cpu-fight", JSON.stringify({ winner: first.state.winner, phase: first.state.phase, tick: first.state.tick, remaining: first.state.remaining, used: first.used, players: first.state.players.map(p => ({ fighter: p.config.fighter, hits: p.hits, peakCombo: p.peakCombo, stocks: p.stocks, hp: p.hp })) }));
});
