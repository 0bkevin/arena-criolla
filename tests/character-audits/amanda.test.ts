import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 80, wins = 3, opponent = "javier") {
  const configs = [{ name: "Audit Amanda", fighter: "amanda", wins }, { name: "Audit rival", fighter: opponent, wins: 3 }];
  const state = createMatch("poliedro", (side === 0 ? configs : [...configs].reverse()) as Parameters<typeof createMatch>[1], "amanda-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 300 : 780;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}

// These are genuine rival light attacks scheduled through inputs, not injected damage.
// Javier's light makes contact six frames after its press.
function timedCounter(side: 0 | 1, contactAt: number) {
  const r = setup(side);
  if (contactAt < 6) { r.inputs[1 - side].actions.light++; r.advance(6 - contactAt); r.inputs[side].actions.special++; r.advance(contactAt); }
  else { r.inputs[side].actions.special++; r.advance(contactAt - 6); r.inputs[1 - side].actions.light++; r.advance(6); }
  return r;
}

test("the curtain counters a frontal strike only inside its window, taking no damage and retaliating", () => {
  const counter = TECHNIQUES[fighterById("amanda").ability].counter!;
  for (const side of [0, 1] as const) for (const contactAt of [counter.from - 1, counter.from, counter.to, counter.to + 1]) {
    const r = timedCounter(side, contactAt);
    // Both players' clocks must advance before either player's contact is resolved.
    const inWindow = contactAt >= counter.from && contactAt <= counter.to;
    assert.equal(r.player.countered, inWindow, `P${side + 1} contact at ${contactAt}`);
    if (inWindow) { assert.equal(r.player.hp, 100); assert.ok(r.rival.hp < 100); }
    else { assert.ok(r.player.hp < 100); assert.equal(r.rival.hp, 100); }
  }
});

test("the curtain counters a frontal heavy, not a strike from behind, and responds only once per activation", () => {
  for (const side of [0, 1] as const) {
    const front = setup(side); front.inputs[side].actions.special++; front.inputs[1 - side].actions.heavy++; front.advance(11);
    assert.equal(front.player.countered, true); assert.equal(front.player.hp, 100); assert.ok(front.rival.hp < 100);
    assert.equal(front.player.hits, 1); assert.equal(Math.sign(front.rival.vx), side === 0 ? 1 : -1);

    const back = setup(side); back.inputs[side].actions.special++; back.advance(1);
    back.rival.x = back.player.x + (side === 0 ? -80 : 80);
    back.inputs[1 - side].actions.light++; back.advance(6);
    assert.equal(back.player.countered, false); assert.ok(back.player.hp < 100); assert.equal(back.rival.hp, 100);

    // Renny's special fires two projectiles; only the first may be countered.
    const once = setup(side, 420, 3, "renny"); once.inputs[1 - side].actions.special++; once.advance(48);
    once.inputs[side].actions.special++;
    const counters = new Set<number>();
    for (let n = 0; n < 75; n++) {
      once.advance(1);
      for (const e of once.state.effects) if (e.kind === "block" && e.owner === side) counters.add(e.id);
    }
    assert.equal(counters.size, 1); assert.equal(once.player.hits, 0);
    assert.ok(once.player.hp < 100); assert.equal(once.rival.hits, 1);
  }
});
