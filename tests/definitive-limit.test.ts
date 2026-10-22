import test from "node:test";
import assert from "node:assert/strict";
import { SUPER_CHARGE_TICKS, type FighterId } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";

function setup(fighter: FighterId = "capriles", side: 0 | 1 = 0) {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: side === 0 ? fighter : "javier", wins: 0 },
    { name: "Dos", fighter: side === 1 ? fighter : "javier", wins: 0 },
  ]);
  state.phase = "playing";
  for (const player of state.players) {
    player.invincible = 0;
    player.energy = 100;
  }
  state.players[1].x = state.players[0].x + 100;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames = 1) => {
    for (let frame = 0; frame < frames; frame++) stepMatch(state, inputs);
  };
  return { state, inputs, advance, player: state.players[side] };
}

test("the definitive remains spent after capture, transformation, projectile and field attacks finish", () => {
  // One shared usage guard; cover each distinct attack/cleanup path once.
  for (const fighter of [
    "capriles",
    "conde",
    "maite",
    "dayana",
    "deyna",
    "zavarce",
  ] as const) {
    for (const side of [0, 1] as const) {
      const r = setup(fighter, side);
      const context = `${fighter}/P${side + 1}`;
      r.inputs[side].actions.super++;
      r.inputs[side].superHeld = true;
      r.advance(SUPER_CHARGE_TICKS);
      assert.equal(r.player.attack, "super", context);
      r.advance(600);
      assert.equal(r.state.phase, "playing", context);
      assert.equal(r.player.attack, null, context);
      assert.equal(r.player.cooldown, 0, context);
      assert.equal(r.state.finale, undefined, context);
      assert.equal(r.state.fieldFinales, undefined, context);

      r.player.energy = 100;
      r.inputs[side].actions.super++;
      r.advance();
      assert.equal(r.player.attack, null, `${context}: second use rejected`);
      assert.equal(r.player.energy, 100, `${context}: no second energy debit`);
    }
  }
});

test("failed activation does not consume the definitive", () => {
  for (const side of [0, 1] as const) {
    const r = setup("capriles", side);
    r.player.energy = 89;
    r.inputs[side].superHeld = true;
    r.inputs[side].actions.super++;
    r.advance();
    assert.equal(r.player.attack, null);
    r.player.energy = 100;
    r.inputs[side].actions.super++;
    r.advance(SUPER_CHARGE_TICKS);
    assert.equal(r.player.attack, "super");
  }
});

test("a missed definitive and losing a life still consume the fight's only use", () => {
  for (const side of [0, 1] as const) {
    const r = setup("capriles", side);
    // Stay beyond capture range so the attack misses.
    r.state.players[1].x = r.state.players[0].x + 420;
    r.inputs[side].actions.super++;
    r.inputs[side].superHeld = true;
    r.advance(SUPER_CHARGE_TICKS + 60);
    assert.equal(r.state.players[1 - side].hp, 100);
    assert.equal(r.state.finale, undefined);
    r.player.hp = 0;
    r.advance();
    assert.equal(r.player.stocks, 1);
    r.advance(180);

    // Network snapshots must carry the restriction through a reconnect.
    const restored: MatchState = JSON.parse(JSON.stringify(r.state));
    restored.players[side].energy = 100;
    r.inputs[side].actions.super++;
    stepMatch(restored, r.inputs);
    assert.equal(restored.players[side].attack, null);
    assert.equal(restored.players[side].energy, 100);

    const rematch = createMatch(r.state.stage, [
      r.state.players[0].config,
      r.state.players[1].config,
    ]);
    rematch.phase = "playing";
    rematch.players[side].energy = 100;
    for (let frame = 0; frame < SUPER_CHARGE_TICKS; frame++)
      stepMatch(rematch, r.inputs);
    assert.equal(rematch.players[side].attack, "super");
  }
});

test("each player has their own definitive use", () => {
  const r = setup("javier");
  r.inputs[0].actions.super++;
  r.inputs[0].superHeld = true;
  r.advance(600);
  r.state.players[1].energy = 100;
  r.inputs[1].actions.super++;
  r.inputs[1].superHeld = true;
  r.advance(SUPER_CHARGE_TICKS);
  assert.equal(r.state.players[1].attack, "super");
});

test("blocking or interrupting a definitive does not restore its use", () => {
  for (const side of [0, 1] as const) {
    for (const defense of ["block", "interrupt"]) {
      const r = setup("capriles", side);
      r.inputs[side].superHeld = true;
      r.inputs[side].actions.super++;
      r.advance(SUPER_CHARGE_TICKS);
      if (defense === "block") r.inputs[1 - side].block = true;
      else r.inputs[1 - side].actions.light++;
      r.advance(60);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.player.attack, null);
      if (defense === "interrupt") assert.ok(r.player.hp < 100);
      else assert.equal(r.state.players[1 - side].hp, 100);
      r.player.energy = 100;
      r.inputs[side].actions.super++;
      r.advance();
      assert.equal(r.player.attack, null);
      assert.equal(r.player.energy, 100);
    }
  }
});
