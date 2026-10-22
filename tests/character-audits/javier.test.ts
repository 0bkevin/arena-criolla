import test from "node:test";
import assert from "node:assert/strict";
import { type FighterId } from "../../shared/content";
import { createMatch, emptyInput, stepMatch, cpuInput, WORLD, type Input, type MatchState, type Action } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";

type Side = 0 | 1;
const advance = (s: MatchState, inputs: [Input, Input], frames: number) => {
  for (let frame = 0; frame < frames; frame++) stepMatch(s, inputs);
};
function setup(side: Side, wins = 0, gap = 130) {
  const ids: [FighterId, FighterId] = side === 0 ? ["javier", "zavarce"] : ["zavarce", "javier"];
  const s = createMatch("caracas", ids.map((fighter) => ({ name: fighter, fighter, wins: fighter === "javier" ? wins : 3 })) as Parameters<typeof createMatch>[1], "javier-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  advance(s, inputs, INTRO_TOTAL_TICKS);
  s.players[0].x = 540 - gap / 2;
  s.players[1].x = 540 + gap / 2;
  return { s, inputs, p: s.players[side], target: s.players[1 - side] };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
for (const side of [0, 1] as const) {
  test(`Javier P${side + 1}: radial special hits front and rear, rises, respects range and guard`, () => {
    for (const guard of [false, true]) {
      const { s, inputs, p, target } = setup(side, 0, 130);
      p.energy = 50;
      target.energy = 60;
      inputs[1 - side].block = guard;
      inputs[side].actions.special++;
      advance(s, inputs, 8);
      assert.equal(target.hp, 100);
      assert.equal(p.y, WORLD.floor);
      stepMatch(s, inputs);
      assert.ok(p.y < WORLD.floor);
      assert.ok(p.vy < 0);
      assert.equal(s.projectiles.length, 0);
      if (guard) {
        assert.equal(target.hp, 100);
        assert.equal(p.hits, 0);
        assert.ok(target.energy < 51);
        assert.ok(s.effects.some((effect) => effect.kind === "block"));
      } else {
        close(target.hp, 100 - 16 * 0.97 * 1.02);
        assert.equal(p.hits, 1);
      }
      console.log(JSON.stringify({ check: "special", side, guard, hp: target.hp, actorY: p.y, actorVy: p.vy, actorEnergy: p.energy, targetEnergy: target.energy, hits: p.hits }));
      advance(s, inputs, 90);
      assert.equal(p.attack, null);
      assert.equal(p.grounded, true);
      assert.equal(p.hits, guard ? 0 : 1);
    }
    const rear = setup(side, 0, 130);
    // Turn away on the activation frame, then remain in the attack's startup.
    rear.inputs[side][side === 0 ? "left" : "right"] = true;
    rear.inputs[side].actions.special++;
    advance(rear.s, rear.inputs, 9);
    assert.equal(rear.p.facing, side === 0 ? -1 : 1);
    assert.equal(rear.p.hits, 1);
    for (const gap of [169, 171]) {
      const range = setup(side, 0, gap);
      range.inputs[side].actions.special++;
      advance(range.s, range.inputs, 9);
      assert.equal(range.p.hits, gap < 170 ? 1 : 0);
    }
    const locked = setup(side);
    locked.p.energy = 24;
    locked.inputs[side].actions.special++;
    stepMatch(locked.s, locked.inputs);
    assert.equal(locked.p.attack, null);
  });

  test(`Javier P${side + 1}: basic/upgraded combo and definitive from zero wins`, () => {
    const basic = setup(side, 0, 25);
    basic.inputs[side].actions.light++;
    advance(basic.s, basic.inputs, 25);
    basic.inputs[side].actions.heavy++;
    advance(basic.s, basic.inputs, 16);
    assert.equal(basic.p.combo, "Finta de ceja");
    assert.equal(basic.p.comboBonus, 3);
    assert.equal(basic.p.hits, 2);
    for (const wins of [0, 1]) {
      const combo = setup(side, wins, 25);
      combo.inputs[side].actions.light++;
      advance(combo.s, combo.inputs, 25);
      combo.inputs[side].actions.light++;
      advance(combo.s, combo.inputs, 25);
      combo.inputs[side].actions.heavy++;
      stepMatch(combo.s, combo.inputs);
      assert.equal(combo.p.combo, "Réplica al instante");
      assert.equal(combo.p.comboBonus, 7);
      advance(combo.s, combo.inputs, 16);
      assert.ok(combo.p.hits >= 2);
      console.log(JSON.stringify({ check: "combo", side, wins, name: combo.p.combo, bonus: combo.p.comboBonus, hits: combo.p.hits, hp: combo.target.hp, history: combo.p.history }));
    }
    for (const wins of [0, 1, 2, 3]) {
      const superMove = setup(side, wins, 150);
      superMove.p.energy = 100;
      superMove.inputs[side].actions.super++;
      stepMatch(superMove.s, superMove.inputs);
      assert.equal(superMove.p.attack, "super");
      assert.equal(superMove.p.combo, "Remate de mialma");
      assert.equal(superMove.p.comboBonus, 12);
      advance(superMove.s, superMove.inputs, 8);
      assert.equal(superMove.s.fieldFinales?.[0]?.fighter, "javier");
      advance(superMove.s, superMove.inputs, 200);
      close(superMove.target.hp, 100 - (28 * 0.97 + 12) * 1.02);
      assert.equal(superMove.p.hits, 3);
      console.log(JSON.stringify({ check: "super", side, hp: superMove.target.hp, energy: superMove.p.energy, name: superMove.p.combo }));
    }
    const lowEnergy = setup(side, 3);
    lowEnergy.p.energy = 89;
    lowEnergy.inputs[side].actions.super++;
    stepMatch(lowEnergy.s, lowEnergy.inputs);
    assert.equal(lowEnergy.p.attack, null);
  });
}

function scriptedInput(s: MatchState, prior: Input): Input {
  const next = { ...prior, actions: { ...prior.actions } };
  const p = s.players[0], target = s.players[1], dx = target.x - p.x;
  next.left = dx < -95;
  next.right = dx > 95;
  next.block = false;
  if (p.cooldown === 0 && p.stun === 0 && Math.abs(dx) < 165) {
    const action: Action = p.energy >= 90 && s.tick % 180 < 20 ? "super" : p.energy >= 25 && s.tick % 100 < 20 ? "special" : s.tick % 3 ? "light" : "heavy";
    next.actions[action]++;
  }
  if (target.y < p.y - 70 && s.tick % 34 === 0) next.actions.jump++;
  return next;
}
test("Javier CPU selects and connects his own radial special in its deterministic close-range opportunity", () => {
  const { s, p, target } = setup(1, 0, 130);
  s.tick = 600;
  p.energy = 50;
  const inputs: [Input, Input] = [emptyInput(), cpuInput(s, emptyInput(), "hard")];
  assert.equal(inputs[1].actions.special, 1);
  advance(s, inputs, 9);
  assert.equal(p.attack, "special");
  assert.equal(p.hits, 1);
  close(target.hp, 84.1696);
});
