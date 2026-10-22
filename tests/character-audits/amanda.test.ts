import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 80, wins = 3, opponent = "javier") {
  const configs = [{ name: "Audit Amanda", fighter: "amanda", wins }, { name: "Audit rival", fighter: opponent, wins: 3 }];
  const state = createMatch("poliedro", (side === 0 ? configs : [...configs].reverse()) as Parameters<typeof createMatch>[1], "amanda-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 300 : 780;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "amanda", check, evidence: value })); }

test("Amanda keeps her documented counter, theatrical identity, one-shot presentation and eight facings", () => {
  const f = fighterById("amanda");
  assert.equal(f.name, "Amanda Gutiérrez"); assert.equal(f.ability, "curtain"); assert.equal(f.special, "Telón de respuesta");
  assert.deepEqual(f.combos, ["Entrada a escena", "Cambio de acto", "Telón final"]);
  assert.deepEqual(TECHNIQUES.curtain.counter, { from: 6, to: 26, damage: 17, force: 9, range: 220 });
  assert.equal(TECHNIQUES.curtain.startup, 32); assert.equal(TECHNIQUES.curtain.recovery, 45);
  assert.equal(presentationById("amanda").battleFrame, 1);
  assert.equal(selectionProgress("amanda", 2800), 1); assert.equal(selectionProgress("amanda", 5600), 1);
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("amanda", frame, facing), facing);
  emit("identity", { intro: presentationById("amanda").introName, choreography: CHOREOGRAPHIES.amanda.name, technique: TECHNIQUES.curtain });
});

test("Amanda walks left and right, faces movement, double-jumps, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 300); r.player.x = 540; r.rival.x = 920;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > 630); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 80); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); const secondVy = r.player.vy; assert.equal(r.player.jumps, 2);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, right, left, firstY, finalY: r.player.y });
  }
});

test("Amanda light and heavy connect once, face correctly and respect frontal guards on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard === "front" ? 100 : 100 - (action === "light" ? 7 : 13) * 1.05 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.equal(r.player.facing, side === 0 ? 1 : -1);
    r.advance(40); assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits });
  }
});

test("Telón de respuesta consumes 25 energy, strikes once after startup, obeys guard and strict 130 range", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const startX = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    r.advance(30); assert.equal(r.rival.hp, 100); assert.equal(r.player.attackTick, 31);
    r.advance(1); close(r.rival.hp, guard === "front" ? 100 : 100 - 8 * 1.05 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.player.countered, false);
    r.advance(40); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.player.attack, null); assert.equal(r.player.x, startX);
    emit("special-idle", { side, guard, hp: r.rival.hp, energy: r.player.energy, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) for (const gap of [129, 130, 131]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(34);
    assert.equal(r.player.hits, gap < 130 ? 1 : 0);
    emit("special-range", { side, gap, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) {
    const low = setup(side); low.player.energy = 24; low.inputs[side].actions.special++; low.advance(1);
    assert.equal(low.player.attack, null); assert.equal(low.player.hits, 0);
    const rear = setup(side, 70); rear.inputs[side][side === 0 ? "left" : "right"] = true; rear.inputs[side].actions.special++; rear.advance(34);
    assert.equal(rear.player.facing, side === 0 ? -1 : 1); assert.equal(rear.rival.hp, 100);
  }
});

// These are genuine rival light attacks scheduled through inputs, not injected damage.
function timedCounter(side: 0 | 1, contactAt: number) {
  const r = setup(side);
  if (contactAt < 6) { r.inputs[1 - side].actions.light++; r.advance(6 - contactAt); r.inputs[side].actions.special++; r.advance(contactAt); }
  else { r.inputs[side].actions.special++; r.advance(contactAt - 6); r.inputs[1 - side].actions.light++; r.advance(6); }
  return r;
}

test("curtain counter window probes exact incoming-contact ticks 5, 6, 7, 25, 26 and 27 on both sides", () => {
  for (const side of [0, 1] as const) for (const contactAt of [5, 6, 7, 25, 26, 27]) {
    const r = timedCounter(side, contactAt);
    // Both players' clocks must advance before either player's contact is resolved.
    const observedWindow = contactAt >= 6 && contactAt <= 26;
    assert.equal(r.player.countered, observedWindow);
    close(r.player.hp, observedWindow ? 100 : 100 - 7 * fighterById("javier").damage * 0.94);
    close(r.rival.hp, observedWindow ? 100 - 17 * 1.05 * 1.03 : 100);
    emit("counter-window", { side, contactAt, expectedCounter: contactAt >= 6 && contactAt <= 26, observedCounter: r.player.countered, hp: r.player.hp, rivalHp: r.rival.hp, attackTick: r.player.attackTick, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
  }
});

test("curtain counters frontal heavy, rejects rear strikes and spends its response only once per activation", () => {
  for (const side of [0, 1] as const) {
    const front = setup(side); front.inputs[side].actions.special++; front.inputs[1 - side].actions.heavy++; front.advance(11);
    assert.equal(front.player.countered, true); assert.equal(front.player.hp, 100); close(front.rival.hp, 81.6145);
    assert.equal(front.player.hits, 1); assert.equal(Math.sign(front.rival.vx), side === 0 ? 1 : -1);
    const back = setup(side); back.inputs[side].actions.special++; back.advance(1);
    back.rival.x = back.player.x + (side === 0 ? -80 : 80);
    back.inputs[1 - side].actions.light++; back.advance(6);
    assert.equal(back.player.countered, false); close(back.player.hp, 93.6174); assert.equal(back.rival.hp, 100);
    emit("counter-direction", { side, frontal: { hp: front.player.hp, rivalHp: front.rival.hp, hits: front.player.hits }, rear: { hp: back.player.hp, rivalHp: back.rival.hp, facing: back.player.facing } });
    const once = setup(side, 420, 3, "renny"); once.inputs[1 - side].actions.special++; once.advance(48);
    once.inputs[side].actions.special++;
    const blocks = new Set<number>(); let firstCounterTick = 0;
    for (let n = 0; n < 75; n++) {
      once.advance(1);
      if (once.player.countered && !firstCounterTick) firstCounterTick = once.state.tick - INTRO_TOTAL_TICKS;
      for (const e of once.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(blocks.size, 1); assert.equal(firstCounterTick, 54); assert.equal(once.player.hits, 0);
    close(once.player.hp, 100 - 8 * 0.94); assert.equal(once.rival.hits, 1);
    emit("single-counter", { side, blocks: blocks.size, firstCounterTick, hp: once.player.hp, rivalHp: once.rival.hp, hits: once.player.hits });
  }
});

test("real Renny projectiles test counter endpoints 5, 6, 26 and 27 equally on both sides", () => {
  for (const side of [0, 1] as const) for (const contactAt of [5, 6, 26, 27]) {
    const r = setup(side, 420, 3, "renny"); r.inputs[1 - side].actions.special++;
    r.advance(54 - contactAt); r.inputs[side].actions.special++; r.advance(contactAt);
    const active = contactAt >= 6 && contactAt <= 26;
    assert.equal(r.player.countered, active); close(r.player.hp, active ? 100 : 100 - 8 * 0.94);
    assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    emit("projectile-counter-window", { side, contactAt, active, hp: r.player.hp, countered: r.player.countered, attackTick: r.player.attackTick });
  }
});

test("projectile interception has an inclusive counter window and strict 220-pixel retaliation distance", () => {
  for (const side of [0, 1] as const) for (const gap of [219, 220, 221, 420]) {
    const r = setup(side, gap, 3, "renny"); r.inputs[1 - side].actions.special++;
    const travel = Math.ceil((gap - 48 - 42 + 0.0001) / 7.5);
    // First Renny pulse exists on frame 10 and immediately moves once that frame.
    const arrival = 9 + travel;
    r.advance(arrival - 12); r.inputs[side].actions.special++; r.advance(12);
    assert.equal(r.player.countered, true); assert.equal(r.player.hp, 100);
    close(r.rival.hp, gap < 220 ? 100 - 17 * 1.05 * fighterById("renny").armor : 100);
    assert.equal(r.player.hits, gap < 220 ? 1 : 0);
    emit("counter-range", { side, gap, arrival, amandaTick: r.player.attackTick, countered: r.player.countered, hp: r.player.hp, rivalHp: r.rival.hp, hits: r.player.hits });
  }
});

test("Amanda recognizes both combos from zero wins, connects chase sequences and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, "Cambio de acto"); assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 1.05 + 7) * 1.03);
      emit("combo-gate", { side, wins, combo: r.player.combo, bonus: r.player.comboBonus, hits: r.player.hits, hp: r.rival.hp });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, 0);
      const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 80 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) {
          const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1);
        }
        r.inputs[side].left = r.inputs[side].right = false; r.advance(8);
        r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Cambio de acto" : "Entrada a escena");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Telón final"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 57.358); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Amanda intro consumes input without attacks or movement and ends facing the rival", () => {
  for (const side of [0, 1] as const) {
    const configs = [{ name: "Amanda", fighter: "amanda", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }];
    const state = createMatch("poliedro", (side === 0 ? configs : configs.reverse()) as Parameters<typeof createMatch>[1]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
  }
});

function cpuFight() {
  const r = setup(0, 420); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    if (n === 0) r.inputs[0].actions.special++;
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 120 && dx < -85; r.inputs[0].right = n >= 120 && dx > 85;
    r.inputs[0].block = n >= 120 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 20;
    if (n >= 120 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const counter = r.rival.attack && Math.abs(dx) < 220 && r.player.energy >= 25;
      const action = counter ? "special" : Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 125 && r.player.energy >= 25 && r.state.tick % 5 === 0 ? "special" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
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
test("a complete Amanda fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
