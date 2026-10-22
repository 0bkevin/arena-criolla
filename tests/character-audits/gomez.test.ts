import test from "node:test";
import assert from "node:assert/strict";
import { type FighterId } from "../../shared/content";
import { createMatch, emptyInput, stepMatch, WORLD, type Input, type MatchState } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
import { TECHNIQUES } from "../../shared/techniques";
type Side = 0 | 1;
const advance = (state: MatchState, inputs: [Input, Input], frames: number) => {
  for (let frame = 0; frame < frames; frame++) stepMatch(state, inputs);
};
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const emit = (check: string, evidence: unknown) => console.log(JSON.stringify({ character: "gomez", check, evidence }));
function setup(side: Side = 0, wins = 3, gap = 130) {
  const ids: [FighterId, FighterId] = side === 0 ? ["gomez", "javier"] : ["javier", "gomez"];
  const state = createMatch("caracas", ids.map(fighter => ({ name: fighter, fighter, wins: fighter === "gomez" ? wins : 3 })) as Parameters<typeof createMatch>[1], "gomez-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  advance(state, inputs, INTRO_TOTAL_TICKS);
  state.players[0].x = 540 - gap / 2;
  state.players[1].x = 540 + gap / 2;
  state.players.forEach(p => { p.energy = 100; });
  return { state, inputs, actor: state.players[side], target: state.players[1 - side] };
}
for (const side of [0, 1] as const) {
  test(`Gómez P${side + 1}: command special hits idle front and rear, blocks directionally and recovers`, () => {
    for (const guard of ["idle", "toward", "away"] as const) {
      const { state, inputs, actor, target } = setup(side, 0, 130);
      actor.energy = 50; target.energy = 60;
      inputs[1 - side].block = guard !== "idle";
      if (guard === "away") inputs[1 - side][side === 0 ? "right" : "left"] = true;
      inputs[side].actions.special++; stepMatch(state, inputs); close(actor.energy, 25.035);
      advance(state, inputs, 15);
      assert.equal(target.hp, 100); assert.equal(actor.y, WORLD.floor);
      stepMatch(state, inputs); assert.equal(actor.attackTick, 17); assert.equal(state.projectiles.length, 0);
      if (guard === "toward") { assert.equal(target.hp, 100); assert.equal(actor.hits, 0); assert.ok(state.effects.some(e => e.kind === "block")); }
      else { close(target.hp, 100 - 21 * 1.2 * 1.03); assert.equal(actor.hits, 1); }
      assert.equal(actor.y, WORLD.floor); assert.equal(actor.vy, 0);
      emit(`special-p${side + 1}`, { guard, hp: target.hp, actorEnergy: actor.energy, targetEnergy: target.energy, targetFacing: target.facing, actorY: actor.y, hits: actor.hits });
      advance(state, inputs, 75); assert.equal(actor.attack, null); assert.equal(actor.cooldown, 0); assert.equal(actor.hits, guard === "toward" ? 0 : 1);
    }
    const rear = setup(side, 0, 130);
    rear.inputs[side][side === 0 ? "left" : "right"] = true;
    rear.inputs[side].actions.special++; advance(rear.state, rear.inputs, 17);
    assert.equal(rear.actor.facing, side === 0 ? -1 : 1); assert.equal(rear.actor.hits, 1);
    emit(`rear-radial-p${side + 1}`, { hp: rear.target.hp, actorFacing: rear.actor.facing, displacement: rear.actor.vx * 17 });
  });

  test(`Gómez P${side + 1}: command range is exclusive and a jumping enemy avoids its ground hit`, () => {
    for (const gap of [204, 205, 206]) {
      const run = setup(side, 0, gap); run.inputs[side].actions.special++;
      advance(run.state, run.inputs, 17); assert.equal(run.actor.hits, gap === 204 ? 1 : 0);
      emit(`range-p${side + 1}`, { gap, hp: run.target.hp, hits: run.actor.hits });
    }
    const run = setup(side, 0, 130);
    run.inputs[side].actions.special++; advance(run.state, run.inputs, 15);
    run.inputs[1 - side].actions.jump++; advance(run.state, run.inputs, 2);
    assert.equal(run.target.grounded, false); assert.ok(Math.abs(run.actor.y - run.target.y) < TECHNIQUES.command.height);
    assert.equal(run.target.hp, 100); assert.equal(run.actor.hits, 0);
    emit(`airborne-enemy-p${side + 1}`, { targetY: run.target.y, verticalGap: Math.abs(run.actor.y - run.target.y), targetGrounded: run.target.grounded, hp: run.target.hp });
  });

  test(`Gómez P${side + 1}: records command activated by an airborne attacker without locking an unfixed behavior`, () => {
    const run = setup(side, 0, 130);
    run.inputs[side].actions.special++; advance(run.state, run.inputs, 15);
    run.inputs[side].actions.jump++; advance(run.state, run.inputs, 2);
    assert.equal(run.actor.grounded, false); assert.ok(run.actor.y < WORLD.floor);
    assert.ok(Number.isFinite(run.target.hp));
    emit(`airborne-actor-p${side + 1}`, { attackTick: run.actor.attackTick, actorY: run.actor.y, actorGrounded: run.actor.grounded, targetY: run.target.y, hp: run.target.hp, hits: run.actor.hits });
  });

  test(`Gómez P${side + 1}: basic and advanced input chains and special/super gates`, () => {
    const basic = setup(side, 0, 60);
    basic.inputs[side].actions.light++; advance(basic.state, basic.inputs, 26);
    basic.inputs[side].actions.heavy++; advance(basic.state, basic.inputs, 11);
    assert.equal(basic.actor.combo, "Paso firme"); assert.equal(basic.actor.comboBonus, 3); assert.equal(basic.actor.hits, 2);
    close(basic.target.hp, 100 - (7 * 1.2 + 13 * 1.2 + 3) * 1.03);
    emit(`basic-connected-p${side + 1}`, { hp: basic.target.hp, hits: basic.actor.hits, combo: basic.actor.combo });
    for (const wins of [0, 1]) {
      const run = setup(side, wins, 140);
      run.inputs[side].actions.light++; advance(run.state, run.inputs, 23);
      run.inputs[side].actions.light++; advance(run.state, run.inputs, 23);
      run.inputs[side].actions.heavy++; advance(run.state, run.inputs, 11);
      const bonus = 7;
      assert.equal(run.actor.combo, "Orden cerrada"); assert.equal(run.actor.comboBonus, bonus);
      close(run.target.hp, 100 - (13 * 1.2 + bonus) * 1.03); assert.equal(run.actor.hits, 1);
      emit(`combo-p${side + 1}`, { wins, combo: run.actor.combo, bonus, hp: run.target.hp, hits: run.actor.hits, setupLightsOutsideRange: true });
    }
    const lockedSpecial = setup(side); lockedSpecial.actor.energy = 24;
    lockedSpecial.inputs[side].actions.special++; stepMatch(lockedSpecial.state, lockedSpecial.inputs);
    assert.equal(lockedSpecial.actor.attack, null);
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 100], [3, 100]] as const) {
      const run = setup(side, wins, 150); run.actor.energy = energy; run.inputs[side].actions.super++;
      stepMatch(run.state, run.inputs); const unlocked = energy >= 90;
      assert.equal(run.actor.attack, unlocked ? "super" : null);
      if (unlocked) {
        assert.equal(run.actor.combo, "Golpe de mando"); assert.equal(run.actor.comboBonus, 12); close(run.actor.energy, 10);
        advance(run.state, run.inputs, 8);
        assert.equal(run.state.fieldFinales?.[0]?.fighter, "gomez");
        advance(run.state, run.inputs, 280);
        close(run.target.hp, 100 - (28 * 1.2 + 12) * 1.03); assert.equal(run.actor.hits, 3);
        emit(`super-p${side + 1}`, { hp: run.target.hp, hits: run.actor.hits, combo: run.actor.combo, energy: run.actor.energy });
      }
    }
  });
}
