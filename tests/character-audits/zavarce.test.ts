import test from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
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
test("Entrega exprés summons one motorcycle and recovers without dashing", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side, 600, 3);
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
    assert.deepEqual([...spawned.values()], [12]);
    assert.equal(run.player.x, startX);
    assert.equal(run.player.dash, 0);
    assert.equal(run.player.invincible, 0);
    assert.equal(run.player.attack, null);
    assert.equal(run.player.cooldown, 0);
    assert.equal(run.state.projectiles.length, 0, "unconnected bikes expire");
    assert.equal(run.player.hits, 0);
  }
});

test("the single Yummy motorcycle hits or is blocked on either side and is consumed once", () => {
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
        else assert.equal(run.player.hits, 1);
        if (blocking) {
          assert.equal(run.rival.hp, 100);
          assert.equal(blockEffects, 1);
          assert.ok(run.rival.energy < 100);
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
test("Vicente can use his single motorcycle special from zero wins, for either player", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1, 2, 3, 4]) {
      for (const energy of [24, 25, 100]) {
        const run = setup(side, 600, wins);
        run.player.energy = energy;
        run.inputs[side].actions.special++;
        run.advance(12);
        const unlocked = energy >= 25;
        assert.equal(run.player.attack, unlocked ? "special" : null);
        assert.equal(run.state.projectiles.length, unlocked ? 1 : 0);
        assert.equal(run.player.cooldown > 0, unlocked);
        assert.equal(run.state.effects.some(e => e.kind === "special"), unlocked);
        if (!unlocked) {
          assert.ok(run.player.energy >= energy, "a locked special spends no energy");
          assert.deepEqual(run.player.history, []);
          assert.equal(run.rival.hp, 100);
        }
      }
    }
  }
});

test("the CPU can use Vicente's motorcycle from zero wins", () => {
  for (const wins of [0, 1, 2, 3]) {
    const run = setup(1, 300, wins);
    run.state.tick = 600;
    const input = cpuInput(run.state, emptyInput(), "normal");
    assert.equal(input.actions.special, 1);
  }
});
