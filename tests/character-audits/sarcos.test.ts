import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280) {
  const configs = [
    { name: "Audit Sarcos", fighter: "sarcos" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "sarcos-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}
const isBlast = (e: { kind: string; strength?: number }) => e.kind === "special" && e.strength === 1.5;

test("the prize bounces off the floor exactly twice and ends in one terminal explosion without a target", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 830); r.inputs[side].actions.special++;
    let bounces = 0, previousBounces: number | undefined;
    for (let n = 0; n < 118; n++) {
      r.advance(1); const shot = r.state.projectiles[0];
      if (!shot) continue;
      const remaining = shot.bounces ?? 0;
      if (previousBounces !== undefined && remaining < previousBounces) { bounces++; assert.ok((shot.vy ?? 0) < 0, "a bounce sends the prize upward"); }
      previousBounces = remaining;
    }
    assert.equal(bounces, 2);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    assert.equal(r.state.effects.filter((e) => e.owner === side && isBlast(e)).length, 1);
  }
});

test("the terminal prize blast obeys directional guards and does not hit twice", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, guard === "rear" ? 550 : 720);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(118);
    assert.equal(r.state.projectiles.length, 0);
    assert.ok(r.state.effects.some(isBlast));
    assert.ok(r.state.effects.some((e) => e.kind === (guard === "front" ? "block" : "hit") && e.owner === side));
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    if (guard === "front") assert.equal(r.rival.hp, 100); else assert.ok(r.rival.hp < 100);
    const hp = r.rival.hp; r.advance(10); assert.equal(r.rival.hp, hp);
  }
});
