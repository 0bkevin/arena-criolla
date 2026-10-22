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
test("Alí sends three timed ground waves that an airborne rival avoids", () => {
  const s = special("ali");
  s.advance(36);
  assert.equal(s.match.projectiles.length, 3);
  assert.ok(
    s.match.projectiles.every((p) => p.groundOnly && p.kind === "strum"),
  );
  const jump = special("ali", 480);
  jump.advance(12);
  jump.match.players[1].y = WORLD.floor - 50;
  jump.match.players[1].vy = -8;
  jump.match.players[1].grounded = false;
  jump.advance(12);
  assert.equal(jump.match.players[1].hp, 100);
});
test("Giuseppe's three digital packets launch separately and accelerate to a fixed limit", () => {
  const s = special("giuseppe");
  s.match.players[1].invincible = 300;
  s.advance(34);
  assert.equal(s.match.projectiles.length, 3);
  assert.equal(new Set(s.match.projectiles.map((p) => p.age)).size, 3);
  const packet = s.match.projectiles[0];
  assert.equal(packet.kind, "audit");
  assert.ok(packet.vx > 4 && packet.vx <= 11);
  assert.deepEqual(packet.wave, { amplitude: 14, period: 26 });
  s.advance(30);
  assert.equal(packet.vx, 11);
});
test("Giuseppe's packets are blocked from the front without causing damage", () => {
  const s = special("giuseppe", 530);
  s.inputs[1].block = true;
  s.until(() => s.match.effects.some((e) => e.kind === "block"));
  assert.equal(s.match.players[1].hp, 100);
});
test("Gualberto's paired notes separate vertically and reverse direction", () => {
  const s = special("gualberto");
  s.advance(10);
  assert.equal(s.match.projectiles.length, 2);
  assert.ok(s.match.projectiles[0].vy! < 0 && s.match.projectiles[1].vy! > 0);
  s.advance(23);
  assert.ok(s.match.projectiles.every((p) => p.vx < 0));
});
test("Reynaldo pulls and briefly slows a hit, while a facing guard prevents both", () => {
  const s = special("reynaldo", 500);
  s.until(() => s.match.players[1].hp < 100);
  assert.ok(s.match.players[1].vx < 0 && s.match.players[1].slowTicks > 0);
  const guard = special("reynaldo", 500);
  guard.inputs[1].block = true;
  guard.until(() => guard.match.effects.some((e) => e.kind === "block"));
  assert.equal(guard.match.players[1].hp, 100);
  assert.equal(guard.match.players[1].slowTicks, 0);
});
test("Carolina returns a frontal projectile, preserves its physics and damages its original owner", () => {
  const s = special("carolina", 590);
  s.match.projectiles.push(incoming(460));
  s.until(() => s.match.projectiles.some((p) => p.owner === 0));
  const returned = s.match.projectiles.find((p) => p.owner === 0)!;
  assert.ok(returned.vx > 0);
  assert.equal(returned.kind, "installments");
  s.until(() => s.match.players[1].hp < 100);
  assert.equal(s.match.players[0].hp, 100);
});
test("Carolina cannot reflect from behind or outside the couture window", () => {
  const s = special("carolina");
  s.advance(5);
  const behind = incoming(230, 1);
  s.match.projectiles.push(behind);
  s.advance(1);
  assert.equal(behind.owner, 1);
  s.advance(24);
  const late = incoming(s.match.players[0].x + 90);
  s.match.projectiles = [late];
  s.advance(1);
  assert.equal(late.owner, 1);
});
test("Danny's slow sound bubble grows to a bounded collision radius", () => {
  const s = special("danny");
  s.match.players[1].invincible = 300;
  s.advance(19);
  const bubble = s.match.projectiles[0];
  assert.ok(bubble.radius! > 12);
  s.advance(65);
  assert.equal(bubble.radius, 48);
  assert.equal(bubble.vx, 4.8);
});
test("Nacho advances, retreats, and launches a third forward step", () => {
  const s = special("nacho");
  s.advance(7);
  assert.ok(s.match.players[0].vx > 0);
  s.advance(14);
  assert.ok(s.match.players[0].vx < 0);
  s.advance(14);
  assert.ok(s.match.players[0].vx > 0 && s.match.players[0].vy < 0);
});
test("Sarcos's prize bounces twice and then expires with an impact effect", () => {
  const s = special("sarcos");
  s.match.players[1].invincible = 300;
  s.advance(18);
  const prize = s.match.projectiles[0];
  assert.equal(prize.bounces, 2);
  s.until(() => prize.bounces === 1);
  assert.ok(prize.vy! < 0);
  s.until(() => prize.bounces === 0);
  assert.ok(prize.vy! < 0);
  s.until(() => !s.match.projectiles.includes(prize));
  assert.ok(s.match.effects.some((e) => e.kind === "special"));
});
test("Yordano's three fountains are staggered arcs rather than simultaneous shots", () => {
  const s = special("yordano");
  s.advance(13);
  assert.equal(s.match.projectiles.length, 1);
  s.advance(26);
  assert.equal(s.match.projectiles.length, 3);
  assert.equal(new Set(s.match.projectiles.map((p) => p.age)).size, 3);
  assert.ok(
    s.match.projectiles.every((p) => p.gravity! > 0 && p.kind === "fountain"),
  );
});
test("Lila's cocotero fans five different trajectories", () => {
  const s = special("lila");
  s.advance(16);
  assert.equal(s.match.projectiles.length, 5);
  assert.equal(new Set(s.match.projectiles.map((p) => p.vy)).size, 5);
});
test("Rummy's traveling zapateo cannot hit an airborne rival", () => {
  const s = special("rummy", 430);
  s.advance(8);
  s.match.players[1].y = WORLD.floor - 60;
  s.match.players[1].vy = -10;
  s.match.players[1].grounded = false;
  s.advance(10);
  assert.equal(s.match.players[1].hp, 100);
  assert.ok(s.match.players[0].x > 330);
  const grounded = special("rummy", 430);
  grounded.until(() => grounded.match.players[1].hp < 100);
});
test("Chiqui's short fast runway dash brakes instead of crossing the whole arena", () => {
  const s = special("chiqui");
  s.advance(11);
  assert.equal(s.match.players[0].vx, 23);
  s.advance(15);
  assert.ok(Math.abs(s.match.players[0].vx) < 1);
  assert.ok(s.match.players[0].x < 570);
});
test("Norkys's pivot retreats upward and catches an enemy behind her", () => {
  const s = special("norkys", 430);
  s.advance(7);
  s.match.players[1].x = 240;
  s.match.players[0].facing = 1;
  s.advance(1);
  assert.ok(s.match.players[0].vx < 0 && s.match.players[0].vy < 0);
  assert.ok(s.match.players[1].hp < 100);
});
test("Gabriela's second mirror strike reverses knockback and beats a guard facing the first strike", () => {
  const s = special("gabriela", 470);
  s.inputs[1].block = true;
  s.until(() => s.match.effects.some((e) => e.kind === "block"));
  assert.equal(s.match.players[1].hp, 100);
  s.until(() => s.match.players[1].hp < 100);
  assert.ok(s.match.players[1].vx < 0);
});
test("Amanda counters one frontal attack but a strike from behind bypasses her curtain", () => {
  const s = special("amanda", 410);
  s.advance(7);
  s.inputs[1].actions.light++;
  s.until(() => s.match.players[1].hp < 100);
  assert.equal(s.match.players[0].hp, 100);
  assert.equal(s.match.players[0].countered, true);
  const behind = special("amanda", 410);
  behind.advance(7);
  behind.match.projectiles = [incoming(behind.match.players[0].x - 20, 1)];
  behind.advance(1);
  assert.ok(behind.match.players[0].hp < 100);
  assert.equal(behind.match.players[0].countered, false);
});
test("Lele's trap plants, arms after a delay, and can be blocked or jumped", () => {
  const s = special("lele");
  s.advance(10);
  const trap = s.match.projectiles[0];
  s.until(() => trap.vx === 0);
  assert.equal(trap.y, WORLD.floor - 42);
  s.match.players[1].x = trap.x;
  s.match.players[1].grounded = true;
  s.advance(2);
  assert.equal(s.match.players[1].hp, 100);
  s.inputs[1].block = true;
  s.until(() => s.match.effects.some((e) => e.kind === "block"));
  assert.equal(s.match.players[1].hp, 100);
  const jump = special("lele");
  jump.advance(38);
  const peel = jump.match.projectiles[0];
  jump.match.players[1].x = peel.x;
  jump.match.players[1].y = WORLD.floor - 55;
  jump.match.players[1].grounded = false;
  jump.match.players[1].vy = -8;
  jump.advance(8);
  assert.equal(jump.match.players[1].hp, 100);
  assert.ok(jump.match.projectiles.includes(peel));
});
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
