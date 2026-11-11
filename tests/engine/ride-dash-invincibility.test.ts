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

// Start a real dash while the ride is approaching; these timings put a
// contact inside the dash immunity window for each formation.
for (const [id, gap, delay, strikes] of [
  ["bolivar", 120, 11, 7],
  ["gomez", 120, 30, 3],
  ["gomez", 120, 11, 3],
  ["lorenzo", 120, 30, 3],
  ["lorenzo", 120, 11, 3],
  ["mcm", 120, 30, 4],
  ["zavarce", 180, 4, 7],
  ["simon", 120, 20, 3],
] as const) {
  test(`${id}: approaching ride contacts a dashing rival at delay ${delay}`, () => {
    const state = match(id),
      [source, target] = state.players;
    target.x = WORLD.right - 300;
    source.x = target.x - gap;
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[0].actions.super++;
    let start = -1,
      dashed = false;
    for (let t = 0; t < 360; t++) {
      inputs[1].left = inputs[1].right = false;
      if (start < 0 && state.fieldFinales?.length) start = t;
      if (
        !dashed &&
        start >= 0 &&
        t >= start + delay &&
        !target.cooldown &&
        !target.stun
      ) {
        inputs[1].left = true;
        inputs[1].actions.dash++;
        dashed = true;
      }
      stepMatch(state, inputs);
    }
    assert.ok(dashed);
    assert.equal(source.hits, strikes);
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

test("a ride hit replaces dash-only immunity with post-hit protection", () => {
  const state = match("mcm"),
    target = state.players[1];
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.super++;
  let hit = false;
  for (let tick = 0; tick < 200 && !hit; tick++) {
    // Keep the target in the dash-only window when the real ride arrives.
    target.invincible = target.dashOnlyInvincible = 8;
    stepMatch(state, inputs);
    hit = target.hp < 100;
  }
  assert.ok(hit);
  assert.equal(target.dashOnlyInvincible, 0);
  assert.ok(target.invincible > 0);
});

test("stock loss clears dash-only immunity on respawn", () => {
  const state = match("mcm"),
    target = state.players[1];
  target.invincible = target.dashOnlyInvincible = 8;
  target.hp = 0;
  stepMatch(state, [emptyInput(), emptyInput()]);
  assert.equal(target.stocks, 1);
  assert.equal(target.dashOnlyInvincible, 0);
  assert.ok(target.invincible > 8);
});

test("a blink grants protection even when dash immunity overlaps it", () => {
  const state = match("sayona"),
    source = state.players[0];
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.special++;
  const start = source.x;
  for (let tick = 0; tick < 40 && source.x === start; tick++) {
    source.invincible = source.dashOnlyInvincible = 8;
    stepMatch(state, inputs);
  }
  assert.notEqual(source.x, start);
  assert.ok(source.invincible > source.dashOnlyInvincible);
});

test("a technique dash preserves longer non-dash protection", () => {
  const state = match("carlos"),
    source = state.players[0];
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.special++;
  for (let tick = 0; tick < 40 && !source.dash; tick++) {
    source.invincible = 20;
    source.dashOnlyInvincible = 0;
    stepMatch(state, inputs);
  }
  assert.ok(source.dash > 0);
  assert.ok(source.invincible > 8);
  assert.equal(source.dashOnlyInvincible, 0);
});
