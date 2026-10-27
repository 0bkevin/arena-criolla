import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280) {
  const configs = [
    { name: "Audit Reynaldo", fighter: "reynaldo" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "reynaldo-v28-audit");
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

test("a missed lasso connects from behind on its return and is only blocked facing its incoming direction", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 450); r.inputs[side].actions.special++;
    r.advance(42);
    assert.ok(r.state.projectiles[0], "the outbound lasso is still in flight");
    // Place the rival between Reynaldo and the returning lasso.
    r.rival.x = r.player.x + (side === 0 ? 150 : -150);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    let impact: { direction: number; vx: number; slowTicks: number } | null = null;
    const blocks = new Set<number>();
    let maxSlow = 0;
    for (let n = 0; n < 45; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp < hp) impact = { direction: r.state.effects.find((e) => e.kind === "hit" && e.owner === side)?.direction ?? 0, vx: r.rival.vx, slowTicks: r.rival.slowTicks };
      maxSlow = Math.max(maxSlow, r.rival.slowTicks);
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    if (guard === "rear") {
      // Facing away from Reynaldo means facing the returning lasso: blocked, and a block never slows.
      assert.equal(impact, null); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 1); assert.equal(maxSlow, 0);
    } else {
      assert.ok(impact); assert.equal(impact.direction, side === 0 ? -1 : 1); assert.equal(Math.sign(impact.vx), side === 0 ? -1 : 1); assert.ok(impact.slowTicks > 0);
      assert.equal(r.player.hits, 1); assert.ok(r.rival.hp < 100); assert.equal(blocks.size, 0);
    }
  }
});

test("lasso slowdown applies a 0.6 movement-speed multiplier after hit stun ends", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 200); r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) { r.advance(1); if (r.rival.slowTicks > 1 && r.rival.stun === 0 && !r.state.hitstop) break; }
    assert.equal(r.rival.grounded, true); assert.ok(r.rival.slowTicks > 1); assert.equal(r.rival.stun, 0);
    const control = structuredClone(r.state); control.players[1 - side].slowTicks = 0;
    const direction = side === 0 ? 1 : -1;
    r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const vxBefore = r.rival.vx;
    const speed = fighterById(r.rival.config.fighter).speed;
    stepMatch(r.state, r.inputs); stepMatch(control, r.inputs);
    close(r.rival.vx, vxBefore + (direction * speed * 0.6 - vxBefore) * 0.35);
    close(control.players[1 - side].vx, vxBefore + (direction * speed - vxBefore) * 0.35);
  }
});
