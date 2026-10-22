import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, cpuInput, WORLD, type Input, type Projectile } from "../shared/engine";
import { TECHNIQUES } from "../shared/techniques";
const added: FighterId[] = [
  "ali",
  "gualberto",
  "reynaldo",
  "dudamel",
  "danny",
  "nacho",
  "sarcos",
  "yordano",
  "lila",
  "rummy",
  "chiqui",
  "norkys",
  "gabriela",
  "amanda",
  "lele",
  "giuseppe",
];
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
  const until = (predicate: () => boolean) => {
    for (let i = 0; !predicate() && i < 230; i++) advance(1);
    assert.ok(predicate(), "Expected combat event within 230 frames");
  };
  return { match, inputs, advance, until };
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
test("all sixteen techniques remain deterministic after network serialization", () => {
  for (const fighter of added) {
    const s = special(fighter, 550);
    s.advance(TECHNIQUES[fighterById(fighter).ability].startup);
    const remote = JSON.parse(JSON.stringify(s.match));
    for (let tick = 0; tick < 150; tick++) {
      stepMatch(s.match, s.inputs);
      stepMatch(remote, s.inputs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(s.match)),
        JSON.parse(JSON.stringify(remote)),
        fighter,
      );
    }
  }
});
