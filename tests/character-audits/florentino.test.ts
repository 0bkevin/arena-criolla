import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280) {
  const configs = [
    { name: "Audit Florentino", fighter: "florentino" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "florentino-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("Copla certera tracks only height and keeps its horizontal direction after the rival crosses behind", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 720), direction = side === 0 ? 1 : -1;
    r.rival.invincible = 1000;
    let observed = 0, previousX: number | undefined, rose = false, crossed = false;
    r.inputs[side].actions.special++;
    for (let n = 0; n < 120; n++) {
      if (n === 15) r.inputs[1 - side].actions.jump++;
      if (n === 25) r.rival.x = r.player.x - direction * 80;
      if (n === 32) r.inputs[1 - side].actions.jump++;
      r.advance(1);
      const shot = r.state.projectiles[0];
      if (!shot) continue;
      observed++;
      assert.equal(Math.sign(shot.vx), direction);
      if (previousX !== undefined) assert.ok((shot.x - previousX) * direction > 0);
      previousX = shot.x;
      if (shot.y < WORLD.floor - 75) rose = true;
      if ((r.rival.x - r.player.x) * direction < 0) crossed = true;
    }
    assert.ok(observed > 1);
    assert.ok(rose, "the note follows the jumping rival's height");
    assert.ok(crossed, "the rival was behind the caster while the note was in flight");
    assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.state.projectiles.length, 0);
  }
});
