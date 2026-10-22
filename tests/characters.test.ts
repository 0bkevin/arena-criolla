import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
function special(fighter: FighterId, rivalX = 750) {
  const match = createMatch("guaira", [
    { name: "Uno", fighter, wins: fighterById(fighter).specialUnlockWins ?? 0 },
    { name: "Dos", fighter: "zavarce", wins: 0 },
  ]);
  match.phase = "playing";
  match.players.forEach((player) => {
    player.invincible = 0;
  });
  match.players[0].energy = 50;
  match.players[1].x = rivalX;
  const inputs = [emptyInput(), emptyInput()] as const;
  inputs[0].actions.special++;
  const advance = (frames: number) => {
    for (let frame = 0; frame < frames; frame++) stepMatch(match, [...inputs]);
  };
  return { match, advance, inputs };
}
test("Vicente summons one motorcycle without moving himself", () => {
  const { match, advance } = special("zavarce");
  const origin = match.players[0].x;
  advance(12);
  assert.equal(match.projectiles.length, 1);
  assert.equal(match.projectiles[0].formationIndex, undefined);
  assert.ok(
    match.projectiles.every(
      (shot) => shot.kind === "courier" && shot.vx > 0 && shot.groundOnly,
    ),
  );
  assert.equal(match.players[0].x, origin);
  assert.equal(match.players[0].dash, 0);
  assert.equal(match.players[0].invincible, 0);
  assert.ok(match.players[0].energy < 28);
});

test("Pedro's installments arrive in three separate pulses and expire after crossing the arena", () => {
  const { match, advance } = special("vallenilla", 950);
  advance(12);
  assert.equal(match.projectiles.length, 1);
  advance(10);
  assert.equal(match.projectiles.length, 2);
  advance(10);
  assert.equal(match.projectiles.length, 3);
  assert.equal(new Set(match.projectiles.map((p) => p.x)).size, 3);
  assert.ok(
    match.projectiles.every((p) => p.kind === "installments" && p.owner === 0),
  );
  advance(90);
  assert.ok(match.players[1].hp < 100);
  assert.equal(match.projectiles.length, 0);
});

test("Simón's notes fan out to cover separate vertical paths", () => {
  const { match, advance } = special("simon");
  advance(14);
  assert.equal(match.projectiles.length, 3);
  assert.equal(
    new Set(match.projectiles.map((projectile) => projectile.y)).size,
    3,
  );
  assert.ok(match.projectiles.every((projectile) => projectile.vx > 0));
});

test("Chataing's wired microphone extends, turns and is caught after a miss", () => {
  const { match, advance } = special("chataing", 950);
  advance(13);
  assert.equal(match.projectiles.length, 1);
  assert.ok(match.projectiles[0].vx > 0);
  const outgoingX = match.projectiles[0].x;
  advance(20);
  const peakX = match.projectiles[0].x;
  assert.ok(peakX > outgoingX);
  assert.equal(match.projectiles[0].age, 23);
  advance(1);
  assert.equal(match.projectiles.length, 1);
  assert.ok(match.projectiles[0].vx < 0);
  assert.equal(match.projectiles[0].returning, true);
  assert.ok(match.projectiles[0].x < peakX);
  const returnedX = match.projectiles[0].x;
  advance(5);
  assert.ok(match.projectiles[0].x < returnedX);
  advance(45);
  assert.equal(match.projectiles.length, 0);
  assert.equal(match.players[0].attack, null);
  assert.equal(match.players[1].hp, 100);
});

test("the general's ground shock can be avoided with a jump", () => {
  const grounded = special("gomez", 450);
  grounded.advance(19);
  assert.ok(grounded.match.players[1].hp < 100);
  const airborne = special("gomez", 450);
  airborne.inputs[1].actions.jump++;
  airborne.advance(19);
  assert.equal(airborne.match.players[1].hp, 100);
});

test("Emilio's follow-up strike connects after the first reaction", () => {
  const { match, advance } = special("emilio", 410);
  advance(9);
  assert.equal(match.players[0].hits, 1);
  const healthAfterFirst = match.players[1].hp;
  advance(20);
  assert.equal(match.players[0].hits, 2);
  assert.ok(match.players[1].hp < healthAfterFirst);
});
