import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FIGHTERS, isFighter, type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import { REACTION_CLIPS } from "../src/game/reactions";

function special(fighter: FighterId, rivalX = 750) {
  const match = createMatch("guaira", [
    { name: "Uno", fighter, wins: 0 },
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

test("the expanded roster contains fifty-two distinct figures and excludes removed fighters", () => {
  assert.equal(FIGHTERS.length, 52);
  assert.equal(
    new Set(FIGHTERS.map((fighter) => fighter.id)).size,
    FIGHTERS.length,
  );
  assert.equal(
    new Set(FIGHTERS.map((fighter) => fighter.ability)).size,
    FIGHTERS.length,
  );
  assert.equal(isFighter("delsa"), false);
  assert.equal(isFighter("lacava"), false);
  assert.equal(isFighter("john"), false);
  assert.equal(isFighter("kilometro"), false);
  assert.equal(isFighter("zavarce"), true);
  assert.equal(isFighter("vallenilla"), true);
});

test("Vicente summons seven tightly packed motorcycles at once without moving himself", () => {
  const { match, advance } = special("zavarce");
  const origin = match.players[0].x;
  advance(12);
  assert.equal(match.projectiles.length, 7);
  assert.equal(new Set(match.projectiles.map((shot) => shot.x)).size, 7);
  const xs = match.projectiles.map((shot) => shot.x).sort((a, b) => a - b);
  assert.equal(
    xs.at(-1)! - xs[0],
    252,
    "seven full-sized bikes overlap in a compact, elongated pack",
  );
  assert.deepEqual(
    match.projectiles.map((shot) => shot.formationIndex),
    [0, 1, 2, 3, 4, 5, 6],
  );
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

test("Chataing's signal returns toward its source instead of flying forever", () => {
  const { match, advance } = special("chataing");
  advance(13);
  assert.equal(match.projectiles.length, 1);
  assert.ok(match.projectiles[0].vx > 0);
  const outgoingX = match.projectiles[0].x;
  advance(35);
  assert.equal(match.projectiles.length, 1);
  assert.ok(match.projectiles[0].vx < 0);
  assert.ok(match.projectiles[0].x > outgoingX);
  const returnedX = match.projectiles[0].x;
  advance(5);
  assert.ok(match.projectiles[0].x < returnedX);
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

test("the shipped roster has no real-person speech and every generic reaction has a verified asset", async () => {
  const manifest = JSON.parse(
    await readFile("shared/personalities.json", "utf8"),
  );
  assert.deepEqual(
    Object.keys(manifest).sort(),
    FIGHTERS.map((f) => f.id).sort(),
  );
  for (const fighter of FIGHTERS) {
    const character = manifest[fighter.id];
    await stat(`public/assets/${fighter.sprite}.webp`);
    assert.equal(character.lines, undefined);
  }
  assert.deepEqual(await readdir("public/audio"), ["arcade"]);
  const evidence = JSON.parse(
    await readFile("assets/audio-provenance.json", "utf8"),
  );
  assert.equal(evidence.mode, "generic-combat-reactions");
  const files = Object.values(REACTION_CLIPS).flatMap((bank) =>
    Object.values(bank).flat(),
  );
  assert.equal(files.length, 18);
  assert.equal(new Set(files).size, 18);
  assert.deepEqual(
    (await readdir("public/audio/arcade")).sort(),
    files.map((file) => file.split("/").at(-1)).sort(),
  );
  for (const file of files) {
    const clip = evidence.clips.find(
      (candidate: { file: string }) => candidate.file === file,
    );
    assert.ok(clip, `Missing provenance for ${file}`);
    assert.equal(clip.nonverbal, true);
    assert.equal(clip.license, "CC0-1.0");
    assert.ok(clip.duration > 0.1 && clip.duration < 0.8);
    const audio = await readFile(`public${file}`);
    assert.ok(audio.length > 1000);
    assert.equal(createHash("sha256").update(audio).digest("hex"), clip.sha256);
  }
});
