import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280) {
  const configs = [
    { name: "Audit Sayona", fighter: "sayona" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "sayona-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test("Paso espectral's blink is clamped to the stage edge instead of teleporting out of the arena", () => {
  for (const [side, x, target] of [[0, WORLD.right - 30, WORLD.right - 300], [1, WORLD.left + 30, WORLD.left + 300]] as const) {
    const r = setup(side); r.player.x = x; r.rival.x = target;
    // Airborne with a fixed facing toward the nearby edge.
    r.player.y = 500; r.player.grounded = false; r.player.supportPlatform = null; r.player.facing = side === 0 ? 1 : -1;
    r.inputs[side].actions.special++; r.advance(12);
    close(r.player.x, side === 0 ? WORLD.right : WORLD.left);
    assert.equal(r.player.stocks, 2);
    assert.equal(r.player.hits, 0);
  }
});

test("blink invulnerability rejects a real light strike that lands during it and expires one frame later", () => {
  for (const side of [0, 1] as const) for (const offset of [12, 13]) {
    const r = setup(side, 500);
    r.inputs[side].actions.special++; r.advance(offset);
    r.rival.x = r.player.x + (side === 0 ? 80 : -80); r.rival.vx = 0;
    r.inputs[1 - side].actions.light++; r.advance(6);
    if (offset === 12) { assert.equal(r.player.hp, 100); assert.equal(r.rival.hits, 0); assert.equal(r.player.invincible, 1); }
    else { assert.ok(r.player.hp < 100); assert.equal(r.rival.hits, 1); assert.equal(r.player.attack, null); }
  }
});
