import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS, type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, cpuInput, WORLD, type Input, type Projectile } from "../shared/engine";
import { TECHNIQUES } from "../shared/techniques";
function special(fighter: FighterId, rivalX = 950) {
  const match = createMatch("guaira", [
    { name: "Uno", fighter, wins: 3 },
    { name: "Dos", fighter: "zavarce", wins: 0 },
  ]);
  match.phase = "playing";
  match.players.forEach((p) => {
    p.invincible = 0;
  });
  match.players[0].energy = 60;
  match.players[1].x = rivalX;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.special++;
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(match, inputs);
  };
  return { match, inputs, advance };
}
function incoming(x: number, direction = -1): Projectile {
  return {
    id: 700,
    owner: 1,
    x,
    y: WORLD.floor - 75,
    vx: direction * 8,
    life: 80,
    kind: "installments",
    damage: 9,
    force: 4,
    direction,
  };
}
test("defensive CPU fighters trigger their distinct specials when threatened", () => {
  for (const fighter of ["carolina", "amanda"] as const) {
    const s = special("ali");
    s.match.players[1].config.fighter = fighter;
    s.match.tick = 12;
    s.match.players[1].energy = 60;
    s.match.players[1].x = 490;
    if (fighter === "carolina")
      s.match.projectiles = [{ ...incoming(360, 1), owner: 0 }];
    else s.match.players[0].attack = "heavy";
    const input = cpuInput(s.match, emptyInput(), "normal");
    assert.equal(input.actions.special, 1);
    assert.equal(input.block, false);
  }
});
test("every fighter's special replays identically after a mid-technique network serialization", () => {
  for (const fighter of FIGHTERS) {
    const s = special(fighter.id, 550);
    s.advance(TECHNIQUES[fighter.ability].startup);
    assert.ok(s.match.players[0].energy < 60, `${fighter.id}: special started`);
    const remote = JSON.parse(JSON.stringify(s.match));
    for (let tick = 0; tick < 150; tick++) {
      stepMatch(s.match, s.inputs);
      stepMatch(remote, s.inputs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(s.match)),
        JSON.parse(JSON.stringify(remote)),
        fighter.id,
      );
    }
  }
});
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
