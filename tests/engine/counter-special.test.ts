import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../../shared/engine/engine";

test("a connected counter consumes its special's follow-up strike", () => {
  const state = createMatch("caracas", [
    { name: "Edgar", fighter: "edgar", wins: 3 },
    { name: "Rival", fighter: "chataing", wins: 3 },
  ]);
  state.phase = "playing";
  const [counter, rival] = state.players;
  counter.x = 400;
  rival.x = 440;
  counter.facing = 1;
  rival.facing = -1;
  for (const player of state.players) {
    player.energy = 100;
    player.invincible = 0;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.special++;
  let damageEvents = 0;
  let hp = rival.hp;
  for (let tick = 0; tick < 120; tick++) {
    if (tick === 5) inputs[1].actions.heavy++;
    stepMatch(state, inputs);
    if (rival.hp < hp) damageEvents++;
    hp = rival.hp;
  }
  assert.equal(counter.countered, true, "the counter connected");
  assert.equal(damageEvents, 1, "the follow-up must not hit as well");
});

test("a parry against an invincible rival preserves the special strike", () => {
  const state = createMatch("caracas", [
    { name: "Edgar", fighter: "edgar", wins: 3 },
    { name: "Capriles", fighter: "capriles", wins: 3 },
  ]);
  state.phase = "playing";
  const [counter, rival] = state.players;
  counter.x = 400;
  rival.x = 620;
  counter.facing = 1;
  rival.facing = -1;
  state.players.forEach((player) => {
    player.energy = 100;
    player.invincible = 0;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.special++;
  inputs[1].actions.special++;
  let parriedInvincible = false;
  for (let tick = 0; tick < 110; tick++) {
    inputs[1].left = tick > 2;
    const wasCountered = counter.countered;
    stepMatch(state, inputs);
    if (!wasCountered && counter.countered && rival.invincible > 0)
      parriedInvincible = true;
  }
  assert.ok(
    parriedInvincible,
    "the counter parried while the rival was invincible",
  );
  assert.ok(rival.hp < 100, "the follow-up strike still damages the rival");
});
