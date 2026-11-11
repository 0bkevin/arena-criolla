import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../helpers/charged-finale-engine";
import { hurt } from "../../shared/engine/combat";
import { resolveStocks } from "../../shared/engine/outcome";
import {
  grantDashInvincibility,
  grantNonDashInvincibility,
  tickInvincibility,
} from "../../shared/engine/invincibility";
import type { FighterId } from "../../shared/roster/roster";

function match(id: FighterId) {
  const state = createMatch("caracas", [
    { name: id, fighter: id, wins: 3 },
    { name: "rival", fighter: "chataing", wins: 3 },
  ]);
  state.phase = "playing";
  const [source, target] = state.players;
  target.x = WORLD.right - 500;
  source.x = target.x - 180;
  source.facing = 1;
  target.facing = -1;
  for (const p of state.players) {
    p.energy = 100;
    p.invincible = 0;
  }
  return state;
}

function ride(id: FighterId, delay: number, dash: boolean) {
  const state = match(id),
    [source, target] = state.players;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.super++;
  let first = -1,
    done = false,
    moved = false;
  for (let t = 0; t < 330; t++) {
    if (first < 0 && target.hp < 100) first = t;
    if (dash && first >= 0 && !done && t >= first + delay) {
      inputs[1].actions.dash++;
      if (target.dash > 0) {
        done = true;
        moved = true;
      }
    }
    stepMatch(state, inputs);
  }
  if (dash) assert.ok(moved, `${id}: dash started at delay ${delay}`);
  return source.hits;
}

for (const id of ["mcm", "simon", "bolivar"] as const) {
  test(`${id} ride continues through a dash toward it`, () => {
    const stationary = ride(id, 0, false);
    for (let delay = 0; delay <= 40; delay++)
      assert.equal(ride(id, delay, true), stationary, `delay ${delay}`);
  });
}

test("dash immunity remains for ordinary hits and other protection still blocks rides", () => {
  const state = match("mcm"),
    target = state.players[1];
  grantDashInvincibility(target, 8);
  const hit = (ride: boolean) =>
    hurt(state, 0, 1, 1, 1, target.x, target.y, "heavy", 12, undefined, ride);
  assert.equal(hit(false), false);
  target.invincible = 20;
  grantDashInvincibility(target, 8);
  assert.equal(hit(true), false, "overlapping spawn protection");
  target.invincible = target.dashOnlyInvincible = 0;
  assert.equal(hit(true), true);
  grantDashInvincibility(target, 8);
  assert.equal(hit(true), false, "overlapping post-hit protection");
});

test("guard blocks a ride even during dash immunity", () => {
  const state = match("mcm"),
    target = state.players[1];
  grantDashInvincibility(target, 8);
  target.blocking = true;
  const hp = target.hp;
  assert.equal(
    hurt(state, 0, 1, 1, 1, target.x, target.y, "super", 5, undefined, true),
    true,
  );
  assert.equal(target.hp, hp);
});

test("normal dash replaces respawn protection", () => {
  const state = match("mcm");
  const target = state.players[1];
  target.hp = 0;
  resolveStocks(state);
  assert.equal(target.invincible, 110);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 30; i++) stepMatch(state, inputs);
  assert.ok(target.invincible > 8);
  inputs[1].actions.dash++;
  stepMatch(state, inputs);
  assert.equal(target.invincible, 8);
  assert.equal(target.dashOnlyInvincible, 8);
  for (let i = 0; i < 8; i++) stepMatch(state, inputs);
  assert.equal(target.invincible, 0);
});

test("ride immunity changes only after overlapping protection expires", () => {
  const state = match("mcm");
  const target = state.players[1];
  grantNonDashInvincibility(target, 3);
  grantDashInvincibility(target, 8);
  const hit = () =>
    hurt(state, 0, 1, 1, 1, target.x, target.y, "heavy", 12, undefined, true);
  for (let i = 0; i < 3; i++) {
    assert.equal(hit(), false);
    tickInvincibility(target);
  }
  assert.equal(hit(), true);
});
