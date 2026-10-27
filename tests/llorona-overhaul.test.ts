import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, emptyInput, stepMatch } from "./helpers/charged-finale-engine";
function setup(side: 0 | 1) {
  const actor = { name: "La Llorona", fighter: "llorona" as const, wins: 3 };
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

test("La Llorona's undertow travels, pulls the rival toward her once and expires", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.x = r.source.x + r.source.facing * 280;
    r.inputs[side].actions.special++;
    for (let i = 0; i < 40 && !r.state.projectiles.length; i++) r.advance(1);
    assert.equal(r.state.projectiles.length, 1);
    assert.equal(r.target.hp, 100, "startup deals no remote damage");
    const wave = r.state.projectiles[0];
    assert.equal(wave.kind, "undertow");
    assert.equal(wave.pulls, true);
    const direction = r.source.facing;
    let contacts = 0,
      previous = 100;
    for (let tick = 0; tick < 130; tick++) {
      r.advance(1);
      if (r.target.hp < previous) {
        contacts++;
        assert.equal(Math.sign(r.target.vx), -direction);
      }
      previous = r.target.hp;
    }
    assert.equal(contacts, 1);
    assert.equal(r.source.hits, 1);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.source.attack, null);
  }
});

