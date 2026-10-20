import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, type FighterId } from "../../shared/content";
import { createMatch, emptyInput, stepMatch, cpuInput, WORLD, type Input, type MatchState, type Action } from "../../shared/engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, samplePose, selectionProgress } from "../../shared/presentation";
import { TECHNIQUES } from "../../shared/techniques";

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

test("Javier intro gates both sides and settles into the correct ready facing", () => {
  for (const side of [0, 1] as const) {
    const s = createMatch("caracas", side === 0 ? [{ name: "J", fighter: "javier", wins: 0 }, { name: "V", fighter: "zavarce", wins: 0 }] : [{ name: "V", fighter: "zavarce", wins: 0 }, { name: "J", fighter: "javier", wins: 0 }]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].right = true;
    inputs[side].actions.special++;
    const startX = s.players[side].x;
    advance(s, inputs, INTRO_TOTAL_TICKS - 1);
    assert.equal(s.phase, "intro");
    assert.equal(s.players[side].x, startX);
    assert.equal(s.players[side].attack, null);
    stepMatch(s, inputs);
    assert.equal(s.phase, "playing");
    assert.equal(s.players[side].facing, side === 0 ? 1 : -1);
  }
  const presentation = presentationById("javier");
  assert.equal(presentation.battleFrame, 0);
  assert.equal(samplePose(presentation.introBeats, 0.5).frame, presentation.battleFrame);
  assert.equal(samplePose(presentation.selectionBeats, 1).frame, 0);
  assert.equal(selectionProgress("javier", 2800), 1);
  for (let frame = 0; frame < 8; frame++) {
    // The authored hurt pose faces left and recoils right; mirror it for P1.
    const sourceFacing = frame === 7 ? -1 : 1;
    assert.equal(normalizedFacing("javier", frame, 1), sourceFacing);
    assert.equal(normalizedFacing("javier", frame, -1), -sourceFacing);
  }
});

for (const side of [0, 1] as const) {
  test(`Javier P${side + 1}: right, left, neutral stance, and dash`, () => {
    const { s, inputs, p } = setup(side, 0, 420);
    const start = p.x;
    inputs[side].right = true;
    advance(s, inputs, 20);
    assert.ok(p.x > start + 80);
    assert.equal(p.facing, 1);
    inputs[side].right = false;
    inputs[side].left = true;
    const rightX = p.x;
    advance(s, inputs, 20);
    assert.ok(p.x < rightX - 70);
    assert.equal(p.facing, -1);
    inputs[side].left = false;
    advance(s, inputs, 40);
    assert.ok(Math.abs(p.vx) < 0.01);
    assert.equal(p.grounded, true);
    assert.equal(p.facing, s.players[1 - side].x >= p.x ? 1 : -1);
    inputs[side].actions.dash++;
    stepMatch(s, inputs);
    close(Math.abs(p.vx), 14);
    assert.ok(p.invincible > 0);
    console.log(JSON.stringify({ check: "movement", side, start, rightX, neutralX: p.x - p.vx, dashVx: p.vx }));
  });

  test(`Javier P${side + 1}: two jumps, rejected third jump, and landing`, () => {
    const { s, inputs, p } = setup(side);
    inputs[side].actions.jump++;
    stepMatch(s, inputs);
    assert.ok(p.y < WORLD.floor);
    assert.equal(p.jumps, 1);
    advance(s, inputs, 10);
    inputs[side].actions.jump++;
    stepMatch(s, inputs);
    assert.equal(p.jumps, 2);
    const secondVy = p.vy;
    inputs[side].actions.jump++;
    stepMatch(s, inputs);
    assert.equal(p.jumps, 2);
    assert.ok(p.vy > secondVy);
    advance(s, inputs, 120);
    assert.equal(p.grounded, true);
    assert.equal(p.jumps, 0);
    assert.equal(p.y, WORLD.floor);
  });

  test(`Javier P${side + 1}: light and heavy connect once at their startup frames`, () => {
    for (const [action, startup, damage] of [["light", 6, 7], ["heavy", 11, 13]] as const) {
      const { s, inputs, p, target } = setup(side, 0, 80);
      inputs[side].actions[action]++;
      advance(s, inputs, startup - 1);
      assert.equal(target.hp, 100);
      stepMatch(s, inputs);
      close(target.hp, 100 - damage * 0.97 * 1.02);
      assert.equal(p.hits, 1);
      advance(s, inputs, 50);
      assert.equal(p.hits, 1);
      console.log(JSON.stringify({ check: action, side, hp: target.hp, hits: p.hits }));
    }
  });

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

  test(`Javier P${side + 1}: basic/upgraded combo and two-win definitive`, () => {
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
      assert.equal(combo.p.combo, wins ? "Réplica al instante" : "Finta de ceja");
      assert.equal(combo.p.comboBonus, wins ? 7 : 3);
      advance(combo.s, combo.inputs, 16);
      assert.ok(combo.p.hits >= 2);
      console.log(JSON.stringify({ check: "combo", side, wins, name: combo.p.combo, bonus: combo.p.comboBonus, hits: combo.p.hits, hp: combo.target.hp, history: combo.p.history }));
    }
    for (const wins of [0, 1, 2, 3]) {
      const superMove = setup(side, wins, 150);
      superMove.p.energy = 100;
      superMove.inputs[side].actions.super++;
      stepMatch(superMove.s, superMove.inputs);
      assert.equal(superMove.p.attack, wins >= 2 ? "super" : null);
      if (wins >= 2) {
        assert.equal(superMove.p.combo, "Remate de mialma");
        assert.equal(superMove.p.comboBonus, 12);
        advance(superMove.s, superMove.inputs, 8);
        assert.equal(superMove.s.fieldFinales?.[0]?.fighter, "javier");
        advance(superMove.s, superMove.inputs, 200);
        close(superMove.target.hp, 100 - (28 * 0.97 + 12) * 1.02);
        assert.equal(superMove.p.hits, 3);
        console.log(JSON.stringify({ check: "super", side, hp: superMove.target.hp, energy: superMove.p.energy, name: superMove.p.combo }));
      }
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
function cpuBout(javierSide: Side) {
  const { s } = setup(javierSide, 3, 420);
  let inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const specials = [0, 0];
  const supers = [0, 0];
  let steps = 0;
  while (s.phase === "playing" && steps < 6500) {
    inputs = [scriptedInput(s, inputs[0]), cpuInput(s, inputs[1], "hard")];
    const attacksBefore = s.players.map((p) => p.attack);
    stepMatch(s, inputs);
    s.players.forEach((p, i) => {
      if (p.attack === "special" && attacksBefore[i] !== "special") specials[i]++;
      if (p.attack === "super" && attacksBefore[i] !== "super") supers[i]++;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.hp >= 0 && p.hp <= 100);
    });
    steps++;
  }
  assert.equal(s.phase, "finished");
  assert.ok(s.players.some((p) => p.hits > 0));
  return { javierSide, winner: s.winner, steps, tick: s.tick, remaining: s.remaining, specials, supers, players: s.players.map((p) => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })), state: s };
}
test("Javier completes deterministic full fights as P1 versus CPU and as the P2 CPU", () => {
  for (const side of [0, 1] as const) {
    const first = cpuBout(side), repeated = cpuBout(side);
    assert.deepEqual(first.state, repeated.state);
    const { state: _state, ...summary } = first;
    console.log(JSON.stringify({ check: "cpu-full-fight", ...summary }));
  }
  assert.equal(TECHNIQUES[fighterById("javier").ability].radial, true);
});

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
