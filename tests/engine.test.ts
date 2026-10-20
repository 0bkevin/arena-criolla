import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS } from "../shared/content";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "../shared/engine";

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

test("a special consumes energy and a projectile can hit a distant opponent", () => {
  const { state, inputs } = setup();
  state.players[0].config.fighter = "vallenilla";
  state.players[0].energy = 50;
  state.players[1].x = 610;
  inputs[0].actions.special++;
  advance(state, inputs, 12);
  assert.ok(state.players[0].energy < 26);
  assert.equal(state.projectiles.length, 1);
  advance(state, inputs, 120);
  assert.ok(state.players[1].hp < 100);
  assert.equal(state.projectiles.length, 0);
});

test("character wins unlock the advanced combo and gate the definitive", () => {
  const locked = setup(0);
  locked.state.players[0].energy = 100;
  locked.inputs[0].actions.super++;
  stepMatch(locked.state, locked.inputs);
  assert.equal(locked.state.players[0].attack, null);
  const first = setup(1);
  first.inputs[0].actions.light++;
  advance(first.state, first.inputs, 23);
  first.inputs[0].actions.light++;
  advance(first.state, first.inputs, 23);
  first.inputs[0].actions.heavy++;
  stepMatch(first.state, first.inputs);
  assert.equal(first.state.players[0].combo, "Ruta directa");
  assert.equal(first.state.players[0].comboBonus, 7);
  const unlocked = setup(3);
  unlocked.state.players[0].energy = 100;
  unlocked.inputs[0].actions.super++;
  stepMatch(unlocked.state, unlocked.inputs);
  assert.equal(unlocked.state.players[0].attack, "super");
  assert.ok(unlocked.state.players[0].energy < 26);
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
      fighter.id === "bolivar" ? state.players[0].x + 80 : 450;
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
