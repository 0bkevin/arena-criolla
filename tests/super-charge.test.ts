import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPER_CHARGE_TICKS,
  SUPER_INTERRUPT_ENERGY_COST,
  type FighterId,
} from "../shared/content";
import {
  cpuInput,
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";
import { ControlSources } from "../src/game/controls";

function setup(side: 0 | 1 = 0, fighter: FighterId = "capriles", gap = 420) {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: side === 0 ? fighter : "javier", wins: 0 },
    { name: "Dos", fighter: side === 1 ? fighter : "javier", wins: 0 },
  ]);
  state.phase = "playing";
  for (const p of state.players) {
    p.energy = 100;
    p.invincible = 0;
  }
  state.players[1].x = state.players[0].x + gap;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames = 1) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  const press = () => {
    inputs[side].superHeld = true;
    inputs[side].actions.super++;
  };
  return { state, inputs, advance, press, player: state.players[side] };
}

test("both players must hold for 0.8 seconds (48 active ticks) before spending 90 energy and their only use", () => {
  assert.equal(SUPER_CHARGE_TICKS, 48);
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.press();
    r.advance(SUPER_CHARGE_TICKS - 1);
    assert.equal(r.player.superChargeTicks, 47);
    assert.equal(r.player.attack, null);
    assert.equal(r.player.energy, 100);
    assert.equal(r.player.superUsed, false);
    r.advance();
    assert.equal(r.player.superChargeTicks, 0);
    assert.equal(r.player.attack, "super");
    assert.equal(r.player.energy, 10);
    assert.equal(r.player.superUsed, true);
  }
});

test("a tap or early release cancels for free and requires a fresh press", () => {
  for (const frames of [1, 27, SUPER_CHARGE_TICKS - 1]) {
    const r = setup();
    r.press();
    r.advance(frames);
    r.inputs[0].superHeld = false;
    r.advance(100);
    assert.equal(r.player.superChargeTicks, 0);
    assert.equal(r.player.superUsed, false);
    assert.equal(r.player.energy, 100);
    r.inputs[0].superHeld = true;
    r.advance(60);
    assert.equal(r.player.superChargeTicks, 0);
    r.press();
    r.advance(SUPER_CHARGE_TICKS);
    assert.equal(r.player.superUsed, true);
  }
});

test("regaining enough energy during a held contact cannot arm a charge", () => {
  const r = setup();
  r.player.energy = 89;
  r.press();
  r.advance(100);
  assert.ok(r.player.energy > 90);
  assert.equal(r.player.superChargeTicks, 0);
  assert.equal(r.player.superUsed, false);
  r.inputs[0].superHeld = false;
  r.advance();
  r.press();
  r.advance(SUPER_CHARGE_TICKS);
  assert.equal(r.player.superUsed, true);
});

test("release and repress between ticks starts a fresh 48-tick charge", () => {
  const r = setup();
  const sources = new ControlSources(r.inputs[0]);
  sources.press("key", "super");
  r.advance(40);
  sources.release("key");
  sources.press("key", "super");
  assert.equal(r.inputs[0].actions.super, 2);
  r.advance();
  assert.equal(r.player.superChargeTicks, 1);
  r.advance(SUPER_CHARGE_TICKS - 2);
  assert.equal(r.player.superChargeTicks, 47);
  assert.equal(r.player.superUsed, false);
  r.advance();
  assert.equal(r.player.superUsed, true);
});

test("overlapping input sources continue one hold without restarting its charge", () => {
  const r = setup();
  const sources = new ControlSources(r.inputs[0]);
  sources.press("key", "super");
  r.advance(20);
  sources.press("touch", "super");
  assert.equal(r.inputs[0].actions.super, 1);
  r.advance(10);
  sources.release("key");
  assert.equal(r.inputs[0].superHeld, true);
  r.advance(SUPER_CHARGE_TICKS - 31);
  assert.equal(r.player.superUsed, false);
  r.advance();
  assert.equal(r.player.superUsed, true);
});

test("charging suppresses attacks, guard, jump and invincible dodge without queuing them", () => {
  const r = setup();
  r.player.invincible = 110;
  r.press();
  r.advance();
  assert.equal(r.player.invincible, 0);
  r.inputs[0].block = true;
  for (const action of ["light", "heavy", "special", "jump", "dash"] as const)
    r.inputs[0].actions[action]++;
  r.advance(20);
  assert.equal(r.player.blocking, false);
  assert.equal(r.player.attack, null);
  assert.equal(r.player.jumps, 0);
  assert.equal(r.player.dash, 0);
  assert.equal(r.player.energy, 100);
  r.inputs[0].superHeld = false;
  r.inputs[0].block = false;
  r.advance(80);
  assert.equal(r.player.attack, null);
  assert.equal(r.player.jumps, 0);
  assert.equal(r.player.dash, 0);
});

test("charging keeps movement available at a slower pace", () => {
  const normal = setup(),
    charging = setup();
  normal.inputs[0].right = charging.inputs[0].right = true;
  charging.press();
  normal.advance(20);
  charging.advance(20);
  assert.ok(charging.player.x > 330);
  assert.ok(charging.player.x - 330 < (normal.player.x - 330) * 0.6);
});

test("a real hit interrupts either player once, debits exactly 15 and preserves the only use", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, "capriles", 80);
    r.press();
    r.advance(10);
    r.inputs[side].block = true;
    r.inputs[1 - side].actions.light++;
    for (let frame = 0; frame < 12 && r.player.hp === 100; frame++) r.advance();
    assert.ok(r.player.hp < 100);
    assert.equal(r.player.superChargeTicks, 0);
    assert.equal(r.player.energy, 100 - SUPER_INTERRUPT_ENERGY_COST);
    assert.equal(r.player.superChargeInterruptedTick, r.state.tick);
    assert.equal(r.player.superUsed, false);
    r.inputs[side].block = false;
    r.advance(180);
    assert.equal(r.player.attack, null);
    assert.equal(r.player.superChargeTicks, 0);
    r.player.energy = 100;
    r.inputs[side].superHeld = false;
    r.advance();
    r.press();
    r.advance(SUPER_CHARGE_TICKS);
    assert.equal(r.player.superUsed, true);
  }
});

test("an incoming cinematic capture also interrupts a vulnerable charge", () => {
  const r = setup(0, "capriles", 100);
  r.state.players[1].config.fighter = "capriles";
  r.inputs[1].superHeld = true;
  r.inputs[1].actions.super++;
  r.advance(SUPER_CHARGE_TICKS - 9);
  r.press();
  r.advance(18);
  assert.equal(r.state.finale?.owner, 1);
  assert.equal(r.player.superChargeTicks, 0);
  assert.equal(r.player.superUsed, false);
  assert.equal(r.player.energy, 85);
});

test("hitstop pauses the charge but release cancels it immediately", () => {
  const r = setup();
  r.press();
  r.advance(10);
  r.state.hitstop = 5;
  r.advance(3);
  assert.equal(r.player.superChargeTicks, 10);
  r.inputs[0].superHeld = false;
  r.advance();
  assert.equal(r.player.superChargeTicks, 0);
  assert.equal(r.player.superUsed, false);
});

test("losing a stock or starting a new fight clears incomplete charge without consuming the use", () => {
  const r = setup();
  r.press();
  r.advance(25);
  r.player.hp = 0;
  r.advance();
  assert.equal(r.player.stocks, 1);
  assert.equal(r.player.superChargeTicks, 0);
  assert.equal(r.player.superUsed, false);
  r.advance(180);
  assert.equal(r.player.superChargeTicks, 0);
  const rematch = createMatch(r.state.stage, [
    r.state.players[0].config,
    r.state.players[1].config,
  ]);
  assert.ok(
    rematch.players.every((p) => p.superChargeTicks === 0 && !p.superUsed),
  );
});

test("charge state serializes and replays through the same activation boundary", () => {
  const r = setup();
  r.press();
  r.advance(26);
  const copy: MatchState = JSON.parse(JSON.stringify(r.state));
  for (let frame = 0; frame < 40; frame++) {
    r.advance();
    stepMatch(copy, r.inputs);
    assert.deepEqual(copy, r.state);
  }
  assert.equal(r.player.superUsed, true);
});

test("the hard CPU holds for the complete charge and stops after its single use", () => {
  const r = setup(1, "capriles", 180);
  r.state.tick = 90;
  for (let frame = 0; frame < 120; frame++) {
    r.inputs[1] = cpuInput(r.state, r.inputs[1], "hard");
    r.advance();
  }
  assert.equal(r.player.superUsed, true);
  assert.equal(r.inputs[1].superHeld, false);
});
