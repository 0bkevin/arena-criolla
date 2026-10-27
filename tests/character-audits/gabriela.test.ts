import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 120) {
  const configs = [
    { name: "Audit Gabriela", fighter: "gabriela" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "gabriela-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("Doble de novela's second pulse strikes from the opposite direction, so guards must turn to stop it", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear", "switch"] as const) {
    const r = setup(side); const direction = side === 0 ? 1 : -1;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const contacts = new Map<number, { kind: string; direction: number }>();
    r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) {
      // "switch" faces the first pulse, then turns to face the reversed second pulse.
      if (guard === "switch" && n >= 20) r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      r.advance(1);
      for (const e of r.state.effects) {
        if (e.owner !== side || e.impact !== "special") continue;
        if ((e.kind === "hit" || e.kind === "block") && !contacts.has(e.id)) contacts.set(e.id, { kind: e.kind, direction: e.direction ?? 0 });
      }
    }
    const contact = [...contacts.values()];
    assert.deepEqual(contact.map((c) => c.direction), [direction, -direction]);
    assert.deepEqual(contact.map((c) => c.kind), guard === "idle" ? ["hit", "hit"] : guard === "front" ? ["block", "hit"] : guard === "rear" ? ["hit", "block"] : ["block", "block"]);
    assert.equal(r.player.hits, guard === "idle" ? 2 : guard === "switch" ? 0 : 1);
    assert.equal(r.rival.hp < 100, guard !== "switch");
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
  }
});
