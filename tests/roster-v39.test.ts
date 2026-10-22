import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "./helpers/charged-finale-engine";
type Side = 0 | 1;
function setup(id: "lorenzo" | "carolina" | "deyna" | "bolivar" | "edgar", side: Side = 0, gap = 140, wins = 3) {
  const state = createMatch(
    "caracas",
    [
      { name: "Uno", fighter: side === 0 ? id : "zavarce", wins },
      { name: "Dos", fighter: side === 1 ? id : "zavarce", wins },
    ],
    "roster-v39",
  );
  state.phase = "playing";
  const actor = state.players[side],
    rival = state.players[1 - side];
  actor.x = side === 0 ? 450 : 750;
  rival.x = actor.x + (side === 0 ? gap : -gap);
  for (const player of state.players) {
    player.y = WORLD.floor;
    player.grounded = true;
    player.invincible = 0;
    player.energy = 100;
    player.facing =
      player === actor ? (side === 0 ? 1 : -1) : side === 0 ? -1 : 1;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let n = 0; n < ticks; n++) stepMatch(state, inputs);
  };
  return { state, actor, rival, inputs, advance, side };
}

test("Lorenzo's three P.A.N. packages take different paths and slow their target", () => {
  const run = setup("lorenzo", 0, 270);
  run.inputs[0].actions.special++;
  run.advance(15);
  assert.equal(run.state.projectiles.length, 3);
  assert.equal(new Set(run.state.projectiles.map((s) => s.vy)).size, 3);
  let slowed = false;
  for (let n = 0; n < 55; n++) {
    run.advance(1);
    slowed ||= run.rival.slowTicks > 0;
  }
  assert.ok(slowed);
  assert.ok(run.rival.hp < 100);
});

test("Carolina reflects a projectile during anticipation, then closes the silk arc", () => {
  for (const side of [0, 1] as const) {
    const run = setup("carolina", side, 190),
      direction = side === 0 ? 1 : -1;
    run.inputs[side].actions.special++;
    run.advance(5);
    run.state.projectiles.push({
      id: run.state.nextId++,
      owner: 1 - side,
      x: run.actor.x + direction * 70,
      y: WORLD.floor - 75,
      vx: -direction * 8,
      life: 70,
      kind: "broadcast",
      damage: 8,
      force: 4,
    });
    run.advance(1);
    const reflected = run.state.projectiles[0];
    assert.equal(reflected.owner, side);
    assert.equal(Math.sign(reflected.vx), direction);
    assert.equal(run.actor.hp, 100);
    run.advance(50);
    assert.ok(run.rival.hp < 100);
  }
});

test("Deyna's single football projectile hits once and has no retired radial pulses", () => {
  const run = setup("deyna", 0, 75);
  run.inputs[0].actions.special++;
  const hitTicks: number[] = [];
  let hp = 100;
  for (let n = 0; n < 50; n++) {
    run.advance(1);
    if (run.rival.hp < hp) hitTicks.push(run.actor.attackTick);
    hp = run.rival.hp;
  }
  assert.deepEqual(hitTicks, [21]);
});

test("Bolívar's sabre connects three close strikes without movement or remote reach", () => {
  for (const side of [0, 1] as const) {
    const run = setup("bolivar", side, 80),
      x = run.actor.x;
    run.inputs[side].actions.special++;
    run.advance(80);
    assert.equal(run.actor.x, x);
    assert.equal(run.actor.hits, 3);
    assert.ok(Math.abs(run.actor.vx) < 0.1);
    const miss = setup("bolivar", side, 140);
    miss.inputs[side].actions.special++;
    miss.advance(80);
    assert.equal(miss.actor.hits, 0);
  }
});

test("Édgar's counter intercepts a facing strike once on either side", () => {
  for (const side of [0, 1] as const) {
    const run = setup("edgar", side, 80);
    run.inputs[side].actions.special++;
    run.advance(5);
    run.inputs[1 - side].actions.light++;
    run.advance(6);
    assert.equal(run.actor.hp, 100);
    assert.equal(run.actor.countered, true);
    assert.ok(run.rival.hp < 100);
  }
});
