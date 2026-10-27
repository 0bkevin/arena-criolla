import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import type { MatchState } from "../shared/engine";
import { simulateMoveDemo } from "../src/game/move-demo";

/** Distinct hit effects dealt by the demonstrating fighter, in order. */
function contacts(states: MatchState[]) {
  const seen = new Set<number>();
  return states.flatMap((state) =>
    state.effects.flatMap((effect) => {
      if (effect.kind !== "hit" || effect.owner !== 0 || seen.has(effect.id))
        return [];
      seen.add(effect.id);
      return [{ state, impact: effect.impact }];
    }),
  );
}

// The fighter guide plays these scripted engine runs; a tuning change can make
// a fighter's preview whiff silently, so every fighter's previews must connect.
for (const fighter of BUILT_IN_FIGHTERS) {
  test(`${fighter.id}: every move preview runs the real engine and connects`, () => {
    for (const move of ["light", "heavy", "special", "final"] as const) {
      const states = simulateMoveDemo(fighter.id, move);
      const attack = move === "final" ? "super" : move;
      assert.ok(
        states.some((state) => state.players[0].attack === attack),
        move,
      );
      assert.ok(
        states.some((state) => state.players[1].hp < 100),
        `${move} never connected`,
      );
      if (move === "final")
        assert.ok(states.some((state) => state.players[0].superUsed));
      // Playback and scrubbing must retain independent, unmodified snapshots.
      assert.equal(states[0].players[0].attack, null);
      assert.equal(states[0].players[1].hp, 100);
    }
    for (const move of ["combo1", "combo2"] as const) {
      const hits = contacts(simulateMoveDemo(fighter.id, move));
      assert.deepEqual(
        hits.map((hit) => hit.impact),
        move === "combo1" ? ["light", "heavy"] : ["light", "light", "heavy"],
        move,
      );
      assert.equal(
        hits.at(-1)!.state.players[0].combo,
        fighter.combos[move === "combo1" ? 0 : 1],
        `${move} did not register as the named combo`,
      );
    }
  });
}
