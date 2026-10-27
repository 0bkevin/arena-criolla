import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 201) {
  const configs = [{ name: "Audit Lele", fighter: "lele" as const, wins: 3 }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lele-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("Broma resbalosa cannot hurt a rival standing on it until it arms, then hits exactly once", () => {
  for (const side of [0, 1] as const) {
    // The rival stands where the trap plants itself.
    const r = setup(side);
    r.inputs[side].actions.special++;
    let overlappedWhileUnarmed = false;
    for (let n = 0; n < 170; n++) {
      r.advance(1);
      const trap = r.state.projectiles.find((p) => p.kind === "prank");
      if (trap && (trap.age ?? 0) < (trap.armAfter ?? 0)) {
        assert.equal(r.rival.hp, 100, `unarmed trap hurt the rival at age ${trap.age}`);
        if (Math.abs(trap.x - r.rival.x) < 42) overlappedWhileUnarmed = true;
      }
    }
    assert.ok(overlappedWhileUnarmed, "the rival must overlap the trap before it arms");
    assert.equal(r.player.hits, 1);
    assert.ok(r.rival.hp < 100);
    assert.equal(r.state.projectiles.length, 0);
  }
});
