import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
function setup(side: 0 | 1 = 0, distance = 80) {
  const actor = { name: "Bolívar", fighter: "bolivar" as const, wins: 3 },
    rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.invincible = 0;
    p.energy = 100;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * distance;
  target.facing = -source.facing;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}
test("Bolívar's sabre special lands exactly three strikes in place without a projectile", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side),
      x = r.source.x;
    r.inputs[side].actions.special++;
    r.advance(1);
    assert.equal(r.source.energy, 75);
    const hits: number[] = [];
    let hp = r.target.hp;
    for (let i = 0; i < 75; i++) {
      r.advance(1);
      if (r.target.hp < hp) hits.push(r.source.attackTick);
      hp = r.target.hp;
    }
    assert.equal(hits.length, 3, "three separate sabre contacts");
    assert.equal(r.source.hits, 3);
    assert.equal(r.source.x, x);
    assert.equal(r.source.attack, null);
    assert.equal(r.state.projectiles.length, 0);
  }
});
