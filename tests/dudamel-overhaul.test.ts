import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch } from "./helpers/charged-finale-engine";
function setup(side: 0 | 1) {
  const actor = { name: "Dudamel", fighter: "dudamel" as const, wins: 3 };
  const rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * 180;
  target.facing = -source.facing;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}

test("Dudamel's cadenza travels before damaging, grows in flight and hits only once", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.x = r.source.x + r.source.facing * 350;
    r.inputs[side].actions.special++;
    for (let i = 0; i < 40 && !r.state.projectiles.length; i++) r.advance(1);
    const shot = r.state.projectiles[0];
    assert.ok(shot);
    assert.equal(shot.kind, "cadenza");
    assert.equal(r.target.hp, 100, "no damage before the note reaches the rival");
    const firstX = shot.x,
      firstRadius = shot.radius!;
    r.advance(15);
    assert.ok(Math.abs(shot.x - firstX) > 100);
    assert.ok(shot.radius! > firstRadius, "the note grows while travelling");
    assert.equal(r.target.hp, 100);
    for (let i = 0; i < 50 && r.target.hp === 100; i++) r.advance(1);
    assert.ok(r.target.hp < 100);
    assert.equal(r.source.hits, 1);
    r.advance(80);
    assert.equal(r.source.hits, 1);
    assert.equal(r.state.projectiles.length, 0);
  }
});
