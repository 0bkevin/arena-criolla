import test from "node:test";
import assert from "node:assert/strict";
import { SUPER_CHARGE_TICKS } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";

function setup(cooldown = 5) {
  const state = createMatch("poliedro", [
    { fighter: "zavarce", name: "P1", wins: 3 },
    { fighter: "vallenilla", name: "P2", wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.invincible = 0;
    p.energy = 100;
  });
  state.players[0].cooldown = cooldown;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
  };
  return { state, inputs, advance, player: state.players[0] };
}

test("a slightly early attack executes once when recovery ends for either player", () => {
  for (const side of [0, 1] as const) {
    for (const cooldown of [2, 5, 6]) {
      const { state, inputs, advance } = setup(0);
      state.players[side].cooldown = cooldown;
      inputs[side].actions.heavy++;
      advance(cooldown);
      assert.equal(state.players[side].attack, "heavy");
      advance(60);
      assert.equal(
        state.players[side].history.length,
        1,
        "a held key never repeats the buffered attack",
      );
    }
  }
});

test("attacks more than five frames before recovery ends are discarded", () => {
  const { player, inputs, advance } = setup(8);
  inputs[0].actions.heavy++;
  advance(12);
  assert.equal(player.attack, null);
  assert.equal(player.history.length, 0);
});

test("a real light attack can be followed by a buffered heavy combo", () => {
  const { player, inputs, advance } = setup(0);
  inputs[0].actions.light++;
  advance(19);
  assert.equal(player.cooldown, 3);
  inputs[0].actions.heavy++;
  advance(3);
  assert.equal(player.attack, "heavy");
  assert.deepEqual(
    player.history.map((entry) => entry.action),
    ["light", "heavy"],
  );
  assert.ok(player.combo, "the normal combo rules still apply");
});

test("an unavailable special is not queued and an available one costs energy once", () => {
  for (const energy of [20, 100]) {
    const { player, inputs, advance } = setup();
    player.energy = energy;
    inputs[0].actions.special++;
    advance(5);
    assert.equal(player.attack, energy === 20 ? null : "special");
    assert.ok(Math.abs(player.energy - (energy === 20 ? 20.175 : 75)) < 1e-8);
    player.energy = 100;
    advance(1);
    assert.equal(player.history.length, energy === 20 ? 0 : 1);
  }
});

test("hitstop freezes the short buffer together with attack recovery", () => {
  const { state, player, inputs, advance } = setup();
  inputs[0].actions.heavy++;
  advance(1);
  state.hitstop = 8;
  advance(8);
  assert.equal(player.attack, null);
  advance(4);
  assert.equal(player.attack, "heavy");
});

test("a buffered grounded special is discarded if the fighter leaves the ground", () => {
  const { player, inputs, advance } = setup();
  inputs[0].actions.special++;
  advance(1);
  player.grounded = false;
  player.supportPlatform = null;
  player.y = 300;
  advance(4);
  assert.equal(player.attack, null);
  assert.equal(player.energy, 100);
});

test("the latest fresh attack replaces the earlier buffered attack", () => {
  const { player, inputs, advance } = setup();
  inputs[0].actions.light++;
  advance(1);
  inputs[0].actions.heavy++;
  advance(4);
  assert.equal(player.attack, "heavy");
  assert.equal(player.history.length, 1);
});

test("buffered attacks recheck energy and are not retried after rejection", () => {
  const { player, inputs, advance } = setup();
  inputs[0].actions.special++;
  advance(1);
  player.energy = 0;
  advance(4);
  assert.equal(player.attack, null);
  player.energy = 100;
  advance(3);
  assert.equal(player.attack, null);
  inputs[0].actions.special++;
  advance(1);
  assert.equal(player.attack, "special");
});

test("definitives pressed during recovery are never buffered or charged without a new press", () => {
  for (const side of [0, 1] as const) {
    const { state, inputs, advance } = setup(0);
    const player = state.players[side];
    player.cooldown = 5;
    inputs[side].superHeld = true;
    inputs[side].actions.super++;
    advance(SUPER_CHARGE_TICKS + 5);
    assert.equal(player.bufferedAttack, undefined);
    assert.equal(player.superChargeTicks, 0);
    assert.equal(player.attack, null);
    assert.equal(player.superUsed, false);
    assert.equal(player.energy, 100);
    inputs[side].superHeld = false;
    advance(1);
    inputs[side].superHeld = true;
    inputs[side].actions.super++;
    advance(SUPER_CHARGE_TICKS - 1);
    assert.equal(
      player.attack,
      null,
      "a fresh definitive still needs the full charge",
    );
    advance(1);
    assert.equal(player.attack, "super");
    assert.equal(player.superUsed, true);
  }
});

test("starting a definitive clears a pending normal attack and never queues attacks during charge", () => {
  for (const side of [0, 1] as const) {
    const { state, inputs, advance } = setup(0);
    const player = state.players[side];
    player.cooldown = 2;
    inputs[side].actions.heavy++;
    advance(1);
    assert.equal(player.bufferedAttack?.attack, "heavy");
    inputs[side].superHeld = true;
    inputs[side].actions.super++;
    advance(1);
    assert.equal(player.superChargeTicks, 1);
    assert.equal(player.bufferedAttack, undefined);
    inputs[side].actions.special++;
    advance(1);
    assert.equal(player.bufferedAttack, undefined);
    advance(SUPER_CHARGE_TICKS - 2);
    assert.equal(player.attack, "super");
    assert.deepEqual(
      player.history.map((entry) => entry.action),
      ["super"],
    );
    assert.equal(player.superUsed, true);
  }
});

test("blocking, stun and stock loss cancel an already buffered attack", () => {
  for (const interrupt of ["block", "stun", "stock"] as const) {
    const { player, inputs, advance } = setup();
    inputs[0].actions.heavy++;
    advance(1);
    if (interrupt === "block") inputs[0].block = true;
    if (interrupt === "stun") player.stun = 3;
    if (interrupt === "stock") player.hp = 0;
    advance(1);
    inputs[0].block = false;
    advance(45);
    assert.equal(player.history.length, 0, interrupt);
  }
});

test("buffer state survives a serialized snapshot and executes deterministically", () => {
  const { state, inputs, advance } = setup();
  inputs[0].actions.heavy++;
  advance(1);
  const restored = JSON.parse(JSON.stringify(state));
  for (let i = 0; i < 5; i++) {
    stepMatch(state, inputs);
    stepMatch(restored, structuredClone(inputs));
  }
  assert.equal(state.players[0].attack, "heavy");
  assert.deepEqual(restored, state);
});
