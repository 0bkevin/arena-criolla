import test from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 200) {
  const configs = [{ name: "Audit Momoy", fighter: "momoy" as const, wins: 3 }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "momoy-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("grounded roots immobilize walking in both directions and dashing; a fresh jump after hit recovery breaks them", () => {
  for (const side of [0, 1] as const) for (const direction of ["left", "right"] as const) {
    const r = setup(side); const target = 1 - side;
    r.inputs[side].actions.special++; r.advance(18);
    assert.ok(r.rival.rootTicks > 0);
    const rootedX = r.rival.x;
    r.inputs[target][direction] = true;
    // A jump pressed during hit stun does not escape.
    r.inputs[target].actions.jump++; r.advance(4);
    assert.equal(r.rival.grounded, true); assert.ok(r.rival.rootTicks > 0); assert.equal(r.rival.jumps, 0);
    while (r.rival.stun > 0) { r.advance(1); assert.equal(r.rival.x, rootedX); assert.equal(r.rival.vx, 0); }
    r.inputs[target].actions.dash++; r.advance(1); assert.equal(r.rival.dash, 0); assert.equal(r.rival.x, rootedX);
    r.advance(4); assert.equal(r.rival.x, rootedX);
    assert.ok(r.rival.rootTicks > 0);
    r.inputs[target].actions.jump++; r.advance(1);
    assert.equal(r.rival.rootTicks, 0); assert.equal(r.rival.grounded, false); assert.equal(r.rival.jumps, 1); assert.ok(r.rival.y < WORLD.floor); assert.ok(r.rival.vy < 0);
    r.advance(12); assert.notEqual(r.rival.x, rootedX);
  }
});

test("roots miss when either fighter is airborne at contact", () => {
  for (const side of [0, 1] as const) for (const jumper of ["actor", "target"] as const) {
    const r = setup(side); r.inputs[side].actions.special++; r.advance(16);
    r.inputs[jumper === "actor" ? side : 1 - side].actions.jump++; r.advance(2);
    // Still within the technique's vertical reach, so only the grounded rule can reject it.
    assert.ok(Math.abs(r.player.y - r.rival.y) < TECHNIQUES.roots.height);
    assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.rival.rootTicks, 0);
  }
});
