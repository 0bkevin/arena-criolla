import test from "node:test";
import assert from "node:assert/strict";
import { MAX_FIGHTER_SEPARATION, WORLD } from "../shared/arena";
import { platformsAtTick } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";

function fight() {
  const state = createMatch("poliedro", [
    { name: "A", fighter: "zavarce", wins: 0 },
    { name: "B", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => (p.invincible = 0));
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, inputs };
}

test("both retreat directions stop at the shared maximum separation", () => {
  for (const mirrored of [false, true]) {
    const { state, inputs } = fight();
    if (mirrored) [state.players[0].x, state.players[1].x] = [750, 330];
    inputs[0][mirrored ? "right" : "left"] = true;
    inputs[1][mirrored ? "left" : "right"] = true;
    for (let frame = 0; frame < 180; frame++) {
      stepMatch(state, inputs);
      assert.ok(
        Math.abs(state.players[0].x - state.players[1].x) <=
          MAX_FIGHTER_SEPARATION + 1e-8,
      );
    }
    assert.ok(
      Math.abs(
        Math.abs(state.players[0].x - state.players[1].x) -
          MAX_FIGHTER_SEPARATION,
      ) < 1e-8,
    );
    assert.ok(state.players.every((p) => p.stocks === 2 && p.grounded));
  }
});

test("dashing away is limited and moving toward the rival remains responsive", () => {
  const { state, inputs } = fight();
  state.players[0].x = 210;
  state.players[1].x = 210 + MAX_FIGHTER_SEPARATION;
  state.players[0].facing = -1;
  inputs[0].left = true;
  inputs[0].actions.dash++;
  for (let frame = 0; frame < 20; frame++) stepMatch(state, inputs);
  assert.ok(Math.abs(state.players[0].x - 210) < 1e-8);
  inputs[0].left = false;
  inputs[0].right = true;
  for (let frame = 0; frame < 10; frame++) stepMatch(state, inputs);
  assert.ok(state.players[0].x > 240);
  assert.ok(
    state.players[1].x - state.players[0].x < MAX_FIGHTER_SEPARATION - 30,
  );
});

test("a rooted fighter cannot grant retreat space through blocked approach inputs", () => {
  for (const mirrored of [false, true]) {
    for (const trappedIndex of [0, 1]) {
      const { state, inputs } = fight();
      [state.players[0].x, state.players[1].x] = mirrored
        ? [870, 210]
        : [210, 870];
      const trapped = state.players[trappedIndex];
      const rival = state.players[1 - trappedIndex];
      const origin = trapped.x;
      trapped.rootTicks = 60;
      const toward = rival.x > trapped.x ? "right" : "left";
      inputs[trappedIndex][toward] = true;
      inputs[1 - trappedIndex][toward] = true;
      for (let frame = 0; frame < 20; frame++) {
        stepMatch(state, inputs);
        assert.equal(trapped.x, origin);
        assert.ok(
          Math.abs(rival.x - trapped.x) <= MAX_FIGHTER_SEPARATION + 1e-8,
        );
      }
      inputs[1 - trappedIndex][toward] = false;
      inputs[trappedIndex].actions.jump++;
      stepMatch(state, inputs);
      assert.equal(trapped.rootTicks, 0);
      assert.ok(Math.abs(rival.x - trapped.x) < MAX_FIGHTER_SEPARATION);
    }
  }
});

test("a backward blink obeys the same retreat boundary", () => {
  const { state, inputs } = fight();
  const p = state.players[0];
  p.config.fighter = "sayona";
  p.x = 210;
  p.y = WORLD.floor - 80;
  p.grounded = false;
  p.supportPlatform = null;
  p.facing = -1;
  state.players[1].x = p.x + MAX_FIGHTER_SEPARATION;
  inputs[0].actions.special++;
  for (let frame = 0; frame < 12; frame++) stepMatch(state, inputs);
  assert.equal(p.attack, "special");
  assert.ok(Math.abs(p.x - 210) < 1e-8);
});

test("a real heavy hit can still launch the victim beyond the spacing boundary and cause a ringout", () => {
  const { state, inputs } = fight();
  const victim = state.players[0],
    attacker = state.players[1];
  victim.x = 330;
  attacker.x = 410;
  inputs[1].actions.heavy++;
  for (let frame = 0; frame < 12; frame++) stepMatch(state, inputs);
  assert.ok(victim.stun > 0 && victim.vx < 0 && victim.hp < 100);
  victim.x = WORLD.left + 4;
  attacker.x = victim.x + MAX_FIGHTER_SEPARATION;
  state.hitstop = 0;
  stepMatch(state, inputs);
  assert.ok(attacker.x - victim.x > MAX_FIGHTER_SEPARATION);
  for (let frame = 0; frame < 120 && victim.stocks === 2; frame++)
    stepMatch(state, inputs);
  assert.equal(victim.stocks, 1);
  assert.equal(attacker.stocks, 2);
});

test("blocked projectiles retain their recoil and can push a neutral defender off either ledge", () => {
  for (const mirrored of [false, true]) {
    for (const gap of [600, MAX_FIGHTER_SEPARATION]) {
      const { state, inputs } = fight();
      const defender = state.players[1];
      const direction = mirrored ? -1 : 1;
      defender.x = mirrored ? WORLD.left - 3 : WORLD.right + 3;
      defender.facing = -direction;
      state.players[0].x = defender.x - direction * gap;
      inputs[1].block = true;
      state.projectiles.push({
        id: 1,
        owner: 0,
        x: defender.x - direction * 30,
        y: WORLD.floor - 80,
        vx: direction * 5,
        life: 60,
        kind: "installments",
        damage: 7,
      });
      stepMatch(state, inputs);
      assert.ok(state.effects.some((effect) => effect.kind === "block"));
      assert.equal(defender.hp, 100);
      const copy = structuredClone(state);
      for (let frame = 0; frame < 120 && defender.stocks === 2; frame++) {
        stepMatch(state, inputs);
        stepMatch(copy, inputs);
        assert.deepEqual(state, copy);
      }
      assert.equal(defender.stocks, 1, `mirrored=${mirrored}, gap=${gap}`);
      assert.equal(state.players[0].stocks, 2);
    }
  }
});

test("a moving platform can carry its rider through the retreat boundary without slipping", () => {
  const { state, inputs } = fight();
  state.stage = "merida";
  const index = 2;
  const platform = platformsAtTick(state.stage, 0)[index];
  const rider = state.players[1];
  rider.x = platform.x + platform.width / 2;
  rider.y = platform.y;
  rider.supportPlatform = index;
  state.players[0].x = rider.x - MAX_FIGHTER_SEPARATION;
  stepMatch(state, inputs);
  const moved = platformsAtTick(state.stage, state.tick)[index];
  assert.equal(rider.grounded, true);
  assert.equal(rider.supportPlatform, index);
  assert.ok(Math.abs(rider.x - moved.x - moved.width / 2) < 0.002);
});

test("existing wide states never snap together and the spacing rule survives network serialization", () => {
  const { state, inputs } = fight();
  state.players[0].x = 80;
  state.players[1].x = 980;
  const copy = JSON.parse(JSON.stringify(state));
  inputs[0].left = true;
  inputs[1].right = true;
  for (let frame = 0; frame < 30; frame++) {
    stepMatch(state, inputs);
    stepMatch(copy, inputs);
    assert.deepEqual(state, copy);
  }
  assert.ok(Math.abs(state.players[0].x - 80) < 1e-8);
  assert.ok(Math.abs(state.players[1].x - 980) < 1e-8);
  inputs[0].left = false;
  inputs[0].right = true;
  for (let frame = 0; frame < 10; frame++) stepMatch(state, inputs);
  assert.ok(state.players[0].x > 110);
});
