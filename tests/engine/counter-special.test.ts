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
