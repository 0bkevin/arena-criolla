import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Action, type Input, type MatchState } from "../helpers/charged-finale-engine";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, wins = 0, gap = 280) {
  const configs = [
    { name: "Pedro", fighter: "vallenilla" as const, wins },
    { name: "Rival", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("guaira", side === 0 ? [...configs] : [configs[1], configs[0]], "vallenilla-v28-audit");
  state.phase = "playing";
  state.players.forEach(p => { p.invincible = 0; p.energy = 100; });
  state.players[1 - side].x = state.players[side].x + (side === 0 ? gap : -gap);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, inputs, side };
}
function advance(s: MatchState, inputs: [Input, Input], frames: number) {
  for (let frame = 0; frame < frames; frame++) stepMatch(s, inputs);
}
function press(inputs: [Input, Input], side: number, action: Action) { inputs[side].actions[action]++; }
function emit(label: string, value: unknown) { console.log(JSON.stringify({ character: "vallenilla", check: label, evidence: value })); }
function waitReady(state: MatchState, inputs: [Input, Input], side: number) {
  let waited = 0;
  while (state.players[side].cooldown > 0 || state.players[side].attack || state.hitstop) {
    stepMatch(state, inputs);
    if (++waited > 180) throw new Error("actor did not recover in 180 frames");
  }
}

test("Vallenilla has the researched identity, dedicated installment technique and mirrored ready stance", () => {
  const fighter = fighterById("vallenilla");
  assert.equal(fighter.name, "Pedro Vallenilla");
  assert.equal(fighter.ability, "installments");
  assert.equal(fighter.special, "Tres cuotas");
  assert.deepEqual(TECHNIQUES.installments.pulses, [0, 10, 20]);
  assert.equal(presentationById("vallenilla").battleFrame, 0);
  for (let frame = 0; frame < 8; frame++) {
    assert.equal(normalizedFacing("vallenilla", frame, 1), 1);
    assert.equal(normalizedFacing("vallenilla", frame, -1), -1);
  }
  assert.equal(selectionProgress("vallenilla", 2800), 1);
  emit("presentation-definition", { intro: presentationById("vallenilla").introName, choreography: CHOREOGRAPHIES.vallenilla.name, actualBeats: CHOREOGRAPHIES.vallenilla.beats });
});

for (const side of [0, 1] as const) {
  test(`Vallenilla P${side + 1}: walks both directions, faces the movement, jumps twice and lands`, () => {
    const { state, inputs } = setup(side);
    const actor = state.players[side];
    const start = actor.x;
    inputs[side].right = true;
    advance(state, inputs, 12);
    assert.ok(actor.x > start + 40);
    assert.equal(actor.facing, 1);
    const right = actor.x;
    inputs[side].right = false; inputs[side].left = true;
    advance(state, inputs, 20);
    assert.ok(actor.x < right - 40);
    assert.equal(actor.facing, -1);
    inputs[side].left = false;
    press(inputs, side, "jump"); advance(state, inputs, 10);
    assert.equal(actor.jumps, 1); assert.ok(actor.y < WORLD.floor);
    const firstJumpY = actor.y;
    press(inputs, side, "jump"); advance(state, inputs, 1);
    assert.equal(actor.jumps, 2);
    press(inputs, side, "jump"); advance(state, inputs, 1);
    assert.equal(actor.jumps, 2);
    advance(state, inputs, 150);
    assert.equal(actor.grounded, true); assert.equal(actor.jumps, 0);
    emit(`movement-p${side + 1}`, { start, right, finalX: actor.x, firstJumpY, landedY: actor.y, facing: actor.facing });
  });

  for (const action of ["light", "heavy"] as const) {
    test(`Vallenilla P${side + 1}: ${action} connects once against idle and is blocked facing forward`, () => {
      const idle = setup(side, 0, 80);
      press(idle.inputs, side, action); advance(idle.state, idle.inputs, 45);
      assert.equal(idle.state.players[side].hits, 1);
      assert.ok(idle.state.players[1 - side].hp < 100);
      const blocking = setup(side, 0, 80);
      blocking.inputs[1 - side].block = true;
      press(blocking.inputs, side, action); advance(blocking.state, blocking.inputs, 15);
      assert.equal(blocking.state.players[1 - side].hp, 100);
      assert.ok(blocking.state.effects.some(e => e.kind === "block" && e.owner === side));
      emit(`${action}-p${side + 1}`, { idleHp: idle.state.players[1 - side].hp, idleHits: idle.state.players[side].hits, blockHp: blocking.state.players[1 - side].hp, blockEnergy: blocking.state.players[1 - side].energy });
    });
  }

  test(`Vallenilla P${side + 1}: special spawns exactly three staggered boxes and damages an idle distant opponent`, () => {
    const { state, inputs } = setup(side, 0, 620);
    const actor = state.players[side]; actor.energy = 50;
    const spawned = new Map<number, { tick: number; vx: number; damage: number; kind: string }>();
    press(inputs, side, "special");
    const impacts: { tick: number; hp: number; hits: number }[] = [];
    for (let frame = 0; frame < 170; frame++) {
      const hp = state.players[1 - side].hp;
      stepMatch(state, inputs);
      for (const p of state.projectiles) if (!spawned.has(p.id)) spawned.set(p.id, { tick: state.tick, vx: p.vx, damage: p.damage, kind: p.kind });
      if (state.players[1 - side].hp !== hp) impacts.push({ tick: state.tick, hp: state.players[1 - side].hp, hits: actor.hits });
    }
    assert.deepEqual([...spawned.values()].map(p => p.tick), [11, 21, 31]);
    assert.ok([...spawned.values()].every(p => p.kind === "installments" && p.vx === (side === 0 ? 9 : -9)));
    assert.ok(impacts.some(impact => impact.hp < 100));
    assert.equal(state.projectiles.length, 0);
    emit(`special-idle-p${side + 1}`, { spawned: [...spawned.values()], impacts, energy: actor.energy, actorX: actor.x, targetX: state.players[1 - side].x });
  });

  test(`Vallenilla P${side + 1}: continuous guard blocks all three installment pulses`, () => {
    const { state, inputs } = setup(side, 0, 280);
    inputs[1 - side].block = true;
    const blocked = new Map<number, number>();
    press(inputs, side, "special");
    advance(state, inputs, 1);
    const energyAfterCost = state.players[side].energy;
    for (let frame = 0; frame < 125; frame++) {
      stepMatch(state, inputs);
      for (const e of state.effects) if (e.kind === "block" && e.owner === side) blocked.set(e.id, state.tick - (e.duration - e.life));
    }
    assert.equal(state.players[1 - side].hp, 100);
    assert.equal(blocked.size, 3);
    assert.equal(state.players[side].hits, 0);
    assert.equal(energyAfterCost, 75);
    emit(`special-block-p${side + 1}`, { blocks: [...blocked.values()], targetEnergy: state.players[1 - side].energy, costAfterOneTick: energyAfterCost, targetHp: state.players[1 - side].hp });
  });

  test(`Vallenilla P${side + 1}: all three boxes hit at midrange and insufficient energy rejects the special`, () => {
    const { state, inputs } = setup(side, 0, 280);
    const origin = state.players[side].x;
    press(inputs, side, "special"); advance(state, inputs, 150);
    assert.equal(state.players[side].hits, 3);
    assert.ok(Math.abs(state.players[1 - side].hp - 81.2746) < 0.00001);
    assert.equal(state.players[side].x, origin);
    assert.equal(state.projectiles.length, 0);
    const locked = setup(side); locked.state.players[side].energy = 24;
    press(locked.inputs, side, "special"); advance(locked.state, locked.inputs, 1);
    assert.equal(locked.state.players[side].attack, null);
    assert.equal(locked.state.projectiles.length, 0);
    emit(`special-midrange-p${side + 1}`, { hits: state.players[side].hits, hp: state.players[1 - side].hp, actorX: state.players[side].x, lockedEnergy: locked.state.players[side].energy });
  });

  test(`Vallenilla P${side + 1}: basic and upgraded movement-assisted combos connect`, () => {
    const results = [];
    for (const [wins, actions] of [[0, ["light", "heavy"]], [1, ["light", "light", "heavy"]]] as const) {
      const { state, inputs } = setup(side, wins, 80);
      inputs[side][side === 0 ? "right" : "left"] = true;
      for (const action of actions) { waitReady(state, inputs, side); press(inputs, side, action); advance(state, inputs, 1); waitReady(state, inputs, side); }
      advance(state, inputs, 17);
      assert.equal(state.players[side].combo, wins === 0 ? "Cuota inicial" : "Cuota atrasada");
      assert.equal(state.players[side].comboBonus, wins === 0 ? 3 : 7);
      assert.ok(state.players[side].hits >= 2);
      results.push({ wins, combo: state.players[side].combo, bonus: state.players[side].comboBonus, hits: state.players[side].hits, targetHp: state.players[1 - side].hp, peakCombo: state.players[side].peakCombo });
    }
    emit(`combos-p${side + 1}`, results);
  });

  test(`Vallenilla P${side + 1}: definitive requires 90 energy from zero wins, then lands with its name`, () => {
    for (const [wins, energy] of [[0, 89], [1, 89], [2, 89]] as const) {
      const { state, inputs } = setup(side, wins, 160); state.players[side].energy = energy;
      press(inputs, side, "super"); advance(state, inputs, 1);
      assert.equal(state.players[side].attack, null);
    }
    const { state, inputs } = setup(side, 0, 160);
    press(inputs, side, "super"); advance(state, inputs, 1);
    assert.equal(state.players[side].attack, "super");
    assert.equal(state.players[side].combo, "Límite aprobado");
    assert.ok(state.players[side].energy < 10.1);
    advance(state, inputs, 55);
    assert.ok(state.players[side].hits > 0);
    assert.equal(state.fieldFinales?.[0]?.fighter, "vallenilla");
    advance(state, inputs, 200);
    assert.ok(state.players[1 - side].hp < 65);
    emit(`super-p${side + 1}`, { hp: state.players[1 - side].hp, hits: state.players[side].hits, combo: state.players[side].combo, energy: state.players[side].energy });
  });
}

test("Vallenilla introduction gates fighting, then settles facing the opponent", () => {
  const { state, inputs } = setup(0);
  state.phase = "intro"; state.tick = 0;
  inputs[0].right = true; press(inputs, 0, "special");
  const start = state.players[0].x;
  advance(state, inputs, INTRO_TOTAL_TICKS - 1);
  assert.equal(state.phase, "intro"); assert.equal(state.players[0].x, start);
  assert.equal(state.projectiles.length, 0);
  advance(state, inputs, 1); assert.equal(state.phase, "playing");
  assert.equal(state.players[0].facing, 1);
  assert.equal(state.players[1].facing, -1);
  emit("intro", { totalTicks: INTRO_TOTAL_TICKS, start, finishX: state.players[0].x, phase: state.phase });
});

test("Vallenilla fights a hard CPU with real movement, jumps, special and ordinary attacks to a result", () => {
  const { state, inputs } = setup(0, 3, 420);
  const started = new Set<string>();
  const hitKinds = new Set<string>();
  const seenEffects = new Set<number>();
  let frames = 0;
  for (; frames < 6200 && state.phase !== "finished"; frames++) {
    const actor = state.players[0], rival = state.players[1];
    const dx = rival.x - actor.x;
    inputs[0].left = dx < -85; inputs[0].right = dx > 85;
    inputs[0].block = rival.attack === "heavy" && Math.abs(dx) < 190 && state.tick % 100 < 35;
    if (actor.cooldown === 0 && !inputs[0].block) {
      if (actor.energy >= 25 && Math.abs(dx) > 180 && Math.abs(dx) < 600) press(inputs, 0, "special");
      else if (Math.abs(dx) < 150 && Math.abs(actor.y - rival.y) < 100) press(inputs, 0, state.tick % 3 ? "light" : "heavy");
    }
    if ((rival.y < actor.y - 60 || actor.x < 100 || actor.x > 980) && actor.jumps < 2 && state.tick % 34 === 0) press(inputs, 0, "jump");
    inputs[1] = cpuInput(state, inputs[1], "hard");
    stepMatch(state, inputs);
    if (actor.attack) started.add(actor.attack);
    for (const e of state.effects) if (!seenEffects.has(e.id)) { seenEffects.add(e.id); if (e.kind === "hit" && e.owner === 0) hitKinds.add(e.impact!); }
  }
  assert.equal(state.phase, "finished");
  assert.ok(state.players[0].hits > 0);
  assert.ok(started.has("special"));
  assert.ok(hitKinds.has("special"));
  emit("cpu-fight", { difficulty: "hard", frames, simulationTicks: state.tick, phase: state.phase, winner: state.winner, started: [...started], hitKinds: [...hitKinds], players: state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
