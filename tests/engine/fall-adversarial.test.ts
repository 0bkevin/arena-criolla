import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../../shared/engine/engine";
import { fighterById } from "../../shared/roster/roster";

function setup() {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "zavarce", wins: 0 },
    { name: "Dos", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => (p.invincible = 0));
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, inputs };
}

test("simultaneous mixed lethal and surviving falls resolve in either seat order", () => {
  for (const lethalSeat of [0, 1] as const) {
    const { state, inputs } = setup();
    const lethal = state.players[lethalSeat];
    const survivor = state.players[1 - lethalSeat];
    lethal.stocks = 1;
    lethal.hp = 9.99;
    survivor.hp = 10;
    lethal.x = WORLD.x - 121;
    survivor.x = WORLD.x + WORLD.width + 121;

    stepMatch(state, inputs);

    assert.equal(lethal.stocks, 0, `lethal seat ${lethalSeat}`);
    assert.equal(lethal.hp, 0, `lethal seat ${lethalSeat}`);
    assert.equal(survivor.stocks, 2, `survivor seat ${1 - lethalSeat}`);
    assert.equal(survivor.hp, 6, `survivor seat ${1 - lethalSeat}`);
    assert.equal(state.phase, "finished");
    assert.equal(state.winner, 1 - lethalSeat);
    for (const seat of [0, 1] as const)
      assert.equal(
        state.effects.filter(
          (effect) => effect.kind === "ringout" && effect.owner === seat,
        ).length,
        1,
        `seat ${seat} emits one fall effect`,
      );
  }
});

test("a real heavy hit and side-boundary exit in one tick damage before fall resolution", () => {
  const { state, inputs } = setup();
  const attacker = state.players[0];
  const victim = state.players[1];
  attacker.x = 1099;
  victim.x = 1253;
  attacker.y = victim.y = 450;
  attacker.grounded = victim.grounded = false;
  attacker.supportPlatform = victim.supportPlatform = null;
  attacker.facing = 1;
  victim.facing = -1;
  inputs[0].actions.heavy++;

  for (let tick = 0; tick < 11; tick++) stepMatch(state, inputs);

  const hpAfterHit =
    100 -
    10.4 *
      fighterById(attacker.config.fighter).damage *
      fighterById(victim.config.fighter).armor;
  assert.equal(attacker.hits, 1, "the heavy attack lands before ring-out");
  assert.equal(victim.stocks, 2);
  assert.ok(Math.abs(victim.hp - hpAfterHit * 0.6) < 1e-10);
  assert.equal(victim.fallProtectionTicks, 60);
  assert.equal(
    state.effects.filter(
      (effect) => effect.kind === "ringout" && effect.owner === 1,
    ).length,
    1,
  );
});

test("a surviving fall at the timeout boundary is scored after its HP loss", () => {
  const { state, inputs } = setup();
  const falling = state.players[0];
  const rival = state.players[1];
  falling.hp = 100;
  rival.hp = 80;
  falling.x = WORLD.x - 121;
  state.remaining = 1;

  stepMatch(state, inputs);

  assert.equal(falling.stocks, 2);
  assert.equal(falling.hp, 60);
  assert.equal(rival.hp, 80);
  assert.equal(state.remaining, 0);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 1, "timeout uses health after the resolved fall");
});
