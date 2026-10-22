import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS, type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../shared/engine";
function special(fighter: FighterId, rivalX = 950) {
  const match = createMatch("guaira", [
    { name: "Leyenda", fighter, wins: 3 },
    { name: "Rival", fighter: "zavarce", wins: 0 },
  ]);
  match.phase = "playing";
  match.players.forEach((p) => {
    p.invincible = 0;
  });
  match.players[0].energy = 60;
  match.players[1].x = rivalX;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.special++;
  const advance = (frames: number) => {
    for (let i = 0; i < frames; i++) stepMatch(match, inputs);
  };
  const until = (predicate: () => boolean) => {
    for (let i = 0; !predicate() && i < 200; i++) advance(1);
    assert.ok(predicate(), "Expected combat event within 200 frames");
  };
  return { match, inputs, advance, until };
}
test("a lost stock clears slow and root effects", () => {
  const { match, inputs, advance } = special("momoy");
  inputs[0].actions.special = 0;
  match.players[1].slowTicks = 50;
  match.players[1].rootTicks = 30;
  match.players[1].hp = 0;
  advance(1);
  assert.equal(match.players[1].stocks, 1);
  assert.equal(match.players[1].slowTicks, 0);
  assert.equal(match.players[1].rootTicks, 0);
});

test("every folklore matchup remains deterministic across serialized network snapshots", () => {
  const legends = FIGHTERS.filter((f) => f.category === "folklore");
  for (let index = 0; index < legends.length; index++) {
    const first = createMatch("merida", [
      { name: "A", fighter: legends[index].id, wins: 3 },
      { name: "B", fighter: legends[(index + 1) % legends.length].id, wins: 3 },
    ]);
    const second = JSON.parse(JSON.stringify(first));
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    for (let frame = 0; frame < 850; frame++) {
      inputs[0].right = frame % 120 < 45;
      inputs[1].left = frame % 110 < 50;
      for (const input of inputs) {
        if (frame % 70 === 0) input.actions.special++;
        if (frame % 57 === 0) input.actions.heavy++;
        if (frame % 100 === 0) input.actions.jump++;
      }
      stepMatch(first, inputs);
      stepMatch(second, inputs);
      if (frame % 100 === 0) {
        // Undefined optional properties disappear on the wire.
        assert.deepEqual(
          JSON.parse(JSON.stringify(first)),
          JSON.parse(JSON.stringify(second)),
        );
      }
    }
  }
});
