import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS, STAGES, fighterById } from "../shared/content";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "./helpers/charged-finale-engine";

function setup(wins = 0) {
  const state = createMatch("caracas", [
    { name: "Pana 1", fighter: "zavarce", wins },
    { name: "Pana 2", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.invincible = 0;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, inputs };
}
const advance = (state: MatchState, inputs: [Input, Input], frames: number) => {
  for (let i = 0; i < frames; i++) stepMatch(state, inputs);
};

test("the intro gates combat and starts after the countdown", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "zavarce", wins: 0 },
    { name: "Dos", fighter: "capriles", wins: 0 },
  ]);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].right = true;
  advance(state, inputs, INTRO_TOTAL_TICKS - 1);
  assert.equal(state.phase, "intro");
  assert.equal(state.players[0].x, 330);
  stepMatch(state, inputs);
  assert.equal(state.phase, "playing");
  stepMatch(state, inputs);
  assert.ok(state.players[0].x > 330);
});

test("light hits remove health and apply knockback exactly once per attack", () => {
  const { state, inputs } = setup();
  state.players[1].x = 410;
  inputs[0].actions.light++;
  advance(state, inputs, 8);
  assert.ok(state.players[1].hp < 100);
  assert.equal(state.players[0].hits, 1);
  assert.ok(state.players[1].vx > 0);
  advance(state, inputs, 15);
  assert.equal(state.players[0].hits, 1);
});

test("blocking prevents damage when facing the attacker and costs energy", () => {
  const { state, inputs } = setup();
  state.players[1].x = 410;
  state.players[1].energy = 60;
  inputs[1].block = true;
  inputs[0].actions.heavy++;
  advance(state, inputs, 13);
  assert.equal(state.players[1].hp, 100);
  assert.ok(state.players[1].energy < 60);
  assert.ok(state.effects.some((e) => e.kind === "block"));
});

test("a second jump works in the air; a third is rejected; landing resets it", () => {
  const { state, inputs } = setup();
  inputs[0].actions.jump++;
  advance(state, inputs, 10);
  assert.equal(state.players[0].jumps, 1);
  assert.ok(state.players[0].y < WORLD.floor);
  inputs[0].actions.jump++;
  stepMatch(state, inputs);
  assert.equal(state.players[0].jumps, 2);
  const vy = state.players[0].vy;
  inputs[0].actions.jump++;
  stepMatch(state, inputs);
  assert.equal(state.players[0].jumps, 2);
  assert.ok(state.players[0].vy > vy);
  advance(state, inputs, 120);
  assert.equal(state.players[0].jumps, 0);
  assert.equal(state.players[0].grounded, true);
});

test("crossing the arena boundary costs a stock and the final stock ends the match", () => {
  const { state, inputs } = setup();
  state.players[1].x = WORLD.x - 140;
  stepMatch(state, inputs);
  assert.equal(state.players[1].stocks, 1);
  assert.equal(state.players[1].hp, 100);
  assert.ok(state.players[1].invincible > 0);
  state.players[1].y = WORLD.height + 180;
  stepMatch(state, inputs);
  assert.equal(state.players[1].stocks, 0);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 0);
});

test("both combo sequences are available to either player from zero wins", () => {
  for (const side of [0, 1] as const) {
    for (const advanced of [false, true]) {
      const { state, inputs } = setup();
      const player = state.players[side];
      const fighter = fighterById(player.config.fighter);
      const actions = advanced
        ? (["light", "light", "heavy"] as const)
        : (["light", "heavy"] as const);
      for (const action of actions) {
        inputs[side].actions[action]++;
        advance(state, inputs, action === "light" ? 23 : 1);
      }
      const label = `${fighter.id}/P${side + 1}/${advanced ? "advanced" : "basic"}`;
      assert.equal(player.combo, fighter.combos[advanced ? 1 : 0], label);
      assert.equal(player.comboBonus, advanced ? 7 : 3, label);
    }
  }
});

test("the definitive requires and consumes 90 energy for either player regardless of wins", () => {
  for (const side of [0, 1] as const) {
    for (const [energy, attack, remaining] of [
      [89, null, 89.035],
      [90, "super", 0.035],
    ] as const) {
      const { state, inputs } = setup();
      const player = state.players[side];
      player.energy = energy;
      inputs[side].actions.super++;
      stepMatch(state, inputs);
      assert.equal(player.attack, attack);
      assert.ok(Math.abs(player.energy - remaining) < 1e-8);
    }
  }
});

test("every stage counts down, stops at timeout and resets for a rematch", () => {
  for (const stage of STAGES) {
    const state = createMatch(stage.id, [
      { name: "Uno", fighter: "zavarce", wins: 0 },
      { name: "Dos", fighter: "javier", wins: 0 },
    ]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    advance(state, inputs, INTRO_TOTAL_TICKS);
    assert.equal(state.remaining, 120 * 60, stage.id);
    assert.equal(state.phase, "playing", stage.id);

    stepMatch(state, inputs);
    assert.equal(state.remaining, 120 * 60 - 1, stage.id);
    assert.equal(state.phase, "playing", stage.id);

    // Exercise the timeout boundary without simulating two idle minutes per stage.
    state.remaining = 2;
    stepMatch(state, inputs);
    assert.equal(state.remaining, 1, stage.id);
    assert.equal(state.phase, "playing", stage.id);
    stepMatch(state, inputs);
    assert.equal(state.remaining, 0, stage.id);
    assert.equal(state.phase, "finished", stage.id);
    assert.equal(state.winner, "draw", stage.id);

    const finished = structuredClone(state);
    advance(state, inputs, 120);
    assert.deepEqual(state, finished, stage.id);

    const rematch = createMatch(stage.id, [
      state.players[0].config,
      state.players[1].config,
    ]);
    assert.equal(rematch.remaining, 120 * 60, stage.id);
    assert.equal(rematch.phase, "intro", stage.id);
  }
});

test("timeout uses remaining stocks and health, including a true draw", () => {
  const first = setup();
  first.state.remaining = 1;
  first.state.players[0].hp = 80;
  stepMatch(first.state, first.inputs);
  assert.equal(first.state.winner, 1);
  const second = setup();
  second.state.remaining = 1;
  stepMatch(second.state, second.inputs);
  assert.equal(second.state.winner, "draw");
});

test("simultaneous final-stock knockouts and ringouts end in a draw", () => {
  for (const cause of ["health", "ringout"] as const) {
    const { state, inputs } = setup();
    state.players.forEach((player) => {
      player.stocks = 1;
      if (cause === "health") player.hp = 0;
      else player.y = WORLD.y + WORLD.height + 180;
    });
    stepMatch(state, inputs);
    assert.equal(state.phase, "finished", cause);
    assert.equal(state.winner, "draw", cause);
    assert.deepEqual(
      state.players.map((player) => player.stocks),
      [0, 0],
    );
  }
});

test("simultaneous stock losses count both players before choosing a winner", () => {
  for (const survivor of [0, 1]) {
    const { state, inputs } = setup();
    state.players.forEach((player, index) => {
      player.stocks = index === survivor ? 2 : 1;
      player.hp = 0;
    });
    stepMatch(state, inputs);
    assert.equal(state.winner, survivor);
    assert.equal(state.players[survivor].stocks, 1);
    assert.equal(state.players[survivor].hp, 100);
    assert.equal(state.players[1 - survivor].stocks, 0);
  }
});

test("projectile knockouts resolve before timeout, including simultaneous final hits", () => {
  for (const owners of [[0], [1], [0, 1]]) {
    const { state, inputs } = setup();
    state.remaining = 1;
    state.players.forEach((player) => {
      player.stocks = 1;
      player.hp = 1;
    });
    state.projectiles = owners.map((owner) => ({
      id: state.nextId++,
      owner,
      x: state.players[1 - owner].x,
      y: state.players[1 - owner].y - 70,
      vx: 0,
      life: 30,
      kind: "note",
      damage: 10,
    }));
    stepMatch(state, inputs);
    assert.equal(state.phase, "finished");
    assert.equal(state.winner, owners.length === 2 ? "draw" : owners[0]);
    for (const owner of owners)
      assert.equal(state.players[1 - owner].stocks, 0);
  }
});

test("all active characters execute their individual specials with finite physics", () => {
  for (const fighter of FIGHTERS) {
    const { state, inputs } = setup(fighter.specialUnlockWins ?? 0);
    state.players[0].config.fighter = fighter.id;
    state.players[0].energy = 50;
    state.players[1].x =
      fighter.id === "bolivar" || fighter.id === "dorangel"
        ? state.players[0].x + 80
        : 450;
    inputs[0].actions.special++;
    stepMatch(state, inputs);
    assert.ok(state.players[0].energy < 26, fighter.id);
    advance(state, inputs, 69);
    // A planted trap deliberately misses a stationary opponent at the wrong
    // distance. Move the opponent onto the armed trap to verify its collision.
    if (fighter.ability === "prank") {
      const trap = state.projectiles.find((shot) => shot.kind === "prank");
      assert.ok(trap && trap.age! >= trap.armAfter! && trap.vx === 0);
      state.players[1].x = trap.x;
      state.players[1].y = WORLD.floor;
      state.players[1].grounded = true;
      stepMatch(state, inputs);
    }
    state.players.forEach((p) => {
      assert.ok(Number.isFinite(p.x), fighter.id);
      assert.ok(Number.isFinite(p.y), fighter.id);
      assert.ok(p.hp >= 0 && p.hp <= 100, fighter.id);
    });
    assert.ok(
      state.players[0].hits > 0 || state.players[1].hp < 100,
      `${fighter.id} special should connect`,
    );
  }
});

test("equal initial states and inputs produce identical simulation states", () => {
  const first = setup();
  const second = setup();
  for (let tick = 0; tick < 1200; tick++) {
    for (const run of [first, second]) {
      run.inputs[0].right = tick % 180 < 70;
      run.inputs[0].left = tick % 180 > 130;
      if (tick % 50 === 0) run.inputs[0].actions.heavy++;
      if (tick % 100 === 0) run.inputs[0].actions.jump++;
      if (tick % 40 === 0) run.inputs[1].actions.light++;
      run.inputs[1].left = true;
      stepMatch(run.state, run.inputs);
    }
  }
  assert.deepEqual(first.state, second.state);
});
