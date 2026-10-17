import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS, type FighterId } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../shared/engine";
import { TECHNIQUES } from "../shared/techniques";

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

test("ten folklore fighters remain available alongside the thirty-six-person culture roster", () => {
  const legends = FIGHTERS.filter((f) => f.category === "folklore");
  assert.deepEqual(
    legends.map((f) => f.id),
    [
      "silbon",
      "llorona",
      "sayona",
      "lionza",
      "florentino",
      "diablo",
      "knoche",
      "momoy",
      "tiotigre",
      "tioconejo",
    ],
  );
  assert.equal(FIGHTERS.filter((f) => f.category !== "folklore").length, 36);
  assert.ok(
    [
      "zavarce",
      "vallenilla",
      "javier",
      "capriles",
      "renny",
      "gomez",
      "simon",
      "conde",
      "emilio",
      "maite",
      "oscar",
      "puma",
      "chataing",
      "george",
      "mcm",
    ].every((id) => FIGHTERS.some((f) => f.id === id)),
  );
  assert.equal(new Set(legends.map((f) => f.special)).size, 10);
  assert.ok(
    legends.every((f) => f.combos.length === 3 && f.sprite.endsWith("-v12")),
  );
});

test("El Silbón's whistle waves vertically and accelerates up to its speed cap", () => {
  const { match, advance } = special("silbon");
  match.players[1].invincible = 300;
  advance(TECHNIQUES.whistle.startup);
  const shot = match.projectiles[0];
  assert.ok(shot);
  const initialSpeed = shot.vx;
  const initialY = shot.y;
  advance(16);
  assert.ok(shot.vx > initialSpeed);
  assert.notEqual(shot.y, initialY);
  assert.ok(Math.abs(shot.y - shot.originY!) <= 28);
  advance(25);
  assert.ok(shot.vx <= 12);
});

test("La Llorona pulls an unguarded enemy toward her, but a facing block deflects the wave", () => {
  const hit = special("llorona", 500);
  hit.until(() => hit.match.players[1].hp < 100);
  assert.ok(hit.match.players[1].vx < 0);
  const guarded = special("llorona", 500);
  guarded.inputs[1].block = true;
  guarded.until(() => guarded.match.effects.some((e) => e.kind === "block"));
  assert.equal(guarded.match.players[1].hp, 100);
  assert.ok(guarded.match.players[1].vx > 0);
});

test("La Sayona's blink closes a nearby gap but cannot teleport across the arena", () => {
  const near = special("sayona", 550);
  near.advance(12);
  assert.ok(near.match.players[0].x > 450);
  assert.ok(near.match.players[1].hp < 100);
  const far = special("sayona", 950);
  far.advance(12);
  assert.equal(far.match.players[0].x, 540);
  assert.equal(far.match.players[1].hp, 100);
  assert.ok(far.match.players[0].invincible > 0);
});

test("María Lionza's ground spirit hits a standing fighter and can be jumped", () => {
  const grounded = special("lionza", 500);
  grounded.advance(38);
  assert.ok(grounded.match.players[1].hp < 100);
  const jumping = special("lionza", 500);
  jumping.inputs[1].actions.jump++;
  jumping.advance(38);
  assert.equal(jumping.match.players[1].hp, 100);
});

test("Florentino's note follows enemy height while retaining its horizontal direction", () => {
  const { match, advance } = special("florentino");
  match.players[1].y = 200;
  match.players[1].grounded = false;
  match.players[1].vy = -5;
  advance(14);
  const note = match.projectiles[0];
  const y = note.y;
  advance(10);
  assert.ok(note.y < y);
  assert.equal(note.vx, 8);
});

test("the Diablo's arcing fireball explodes at the floor and deals damage only once", () => {
  const { match, advance } = special("diablo");
  advance(19);
  const fire = match.projectiles[0];
  assert.ok(fire.vy! < 0);
  fire.x = 850;
  fire.y = WORLD.floor - 21;
  fire.vy = 2;
  advance(1);
  assert.equal(match.projectiles.length, 0);
  assert.ok(match.players[1].hp < 100);
  assert.equal(match.players[0].hits, 1);
  const health = match.players[1].hp;
  advance(8);
  assert.equal(match.players[1].hp, health);
});

test("Knoche's elixir slows only unblocked hits and wears off", () => {
  const hit = special("knoche", 500);
  hit.until(() => hit.match.players[1].slowTicks > 0);
  assert.ok(hit.match.players[1].hp < 100);
  hit.until(() => hit.match.players[1].slowTicks === 0);
  const guarded = special("knoche", 500);
  guarded.inputs[1].block = true;
  guarded.until(() => guarded.match.effects.some((e) => e.kind === "block"));
  assert.equal(guarded.match.players[1].hp, 100);
  assert.equal(guarded.match.players[1].slowTicks, 0);
  // Compare speed with room to move before the shared retreat boundary.
  const slow = special("knoche", 750);
  const normal = special("knoche", 750);
  for (const run of [slow, normal]) {
    run.inputs[0].actions.special = 0;
    run.inputs[1].right = true;
  }
  slow.match.players[1].slowTicks = 60;
  slow.advance(10);
  normal.advance(10);
  assert.ok(slow.match.players[1].vx < normal.match.players[1].vx * 0.7);
});

test("Momoy roots stop ground movement and a jump breaks the trap after hit recovery", () => {
  const run = special("momoy", 475);
  run.until(() => run.match.players[1].rootTicks > 0);
  run.inputs[1].right = true;
  const trappedX = run.match.players[1].x;
  run.until(() => run.match.players[1].stun === 0 && run.match.hitstop === 0);
  assert.ok(run.match.players[1].rootTicks > 0);
  assert.equal(run.match.players[1].x, trappedX);
  run.inputs[1].actions.jump++;
  run.advance(1);
  assert.equal(run.match.players[1].rootTicks, 0);
  assert.equal(run.match.players[1].grounded, false);
  const airborne = special("momoy", 475);
  airborne.inputs[1].actions.jump++;
  airborne.advance(20);
  assert.equal(airborne.match.players[1].hp, 100);
  assert.equal(airborne.match.players[1].rootTicks, 0);
});

test("Tío Tigre pounces with two claw hits and brakes before crossing the arena", () => {
  const { match, advance } = special("tiotigre", 430);
  advance(8);
  assert.equal(match.players[0].hits, 1);
  assert.ok(match.players[0].vy < 0);
  advance(32);
  assert.equal(match.players[0].hits, 2);
  assert.ok(match.players[0].x < 600);
  assert.equal(match.projectiles.length, 0);
});

test("Tío Conejo retreats while launching a projectile with one ground bounce", () => {
  const { match, advance } = special("tioconejo");
  advance(9);
  assert.ok(match.players[0].x < 330);
  assert.ok(match.players[0].vy < 0);
  const carrot = match.projectiles[0];
  assert.ok(carrot.vx > 0);
  carrot.y = WORLD.floor - 21;
  carrot.vy = 3;
  advance(1);
  assert.equal(carrot.bounces, 0);
  assert.ok(carrot.vy! < 0);
  advance(90);
  assert.equal(match.projectiles.length, 0);
  assert.equal(match.players[0].stocks, 2);
  assert.ok(match.players[0].x > WORLD.left);
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
