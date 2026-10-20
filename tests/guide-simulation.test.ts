import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import type { MatchState } from "../shared/engine";
import { simulateMoveDemo } from "../docs/finales/moveset-guide/simulation";

function hits(states: MatchState[]) {
  const seen = new Set<number>();
  return states.flatMap((state, frame) => state.effects.flatMap(effect => {
    if (effect.kind !== "hit" || effect.owner !== 0 || seen.has(effect.id)) return [];
    seen.add(effect.id);
    return [{ frame, state, impact: effect.impact }];
  }));
}

for (const fighter of BUILT_IN_FIGHTERS) {
  test(`${fighter.id}: both guide combos connect every real hit and finish inside the combo window`, () => {
    for (const move of ["combo1", "combo2"] as const) {
      const states = simulateMoveDemo(fighter.id, move), contacts = hits(states);
      const expected = move === "combo1" ? ["light", "heavy"] : ["light", "light", "heavy"];
      assert.deepEqual(contacts.map(contact => contact.impact), expected, move);
      assert.equal(contacts.at(-1)!.state.players[0].combo, fighter.combos[move === "combo1" ? 0 : 1]);
      assert.equal(contacts.at(-1)!.state.players[0].comboBonus, move === "combo1" ? 3 : 7);
      const starts = states.flatMap((state, frame) => {
        const previous = states[frame - 1]?.players[0], source = state.players[0];
        return source.attack && (!previous || source.attack !== previous.attack || source.attackTick < previous.attackTick) ? [{ state, frame }] : [];
      });
      assert.deepEqual(starts.map(start => start.state.players[0].attack), expected);
      assert.ok(starts.at(-1)!.state.tick - starts[0].state.tick < 150, "The real combo window expired");
      for (const { frame } of starts) {
        const before = states[frame - 1], source = before.players[0], target = before.players[1];
        assert.equal(source.attack, null); assert.equal(source.cooldown, 0); assert.equal(source.stun, 0);
        assert.equal(before.hitstop, 0); assert.equal(target.invincible, 0);
        assert.ok(source.grounded && target.grounded, "A follow-up was sent before landing");
        assert.ok(Math.abs(source.y - target.y) < 120 && Math.abs(source.x - target.x) < 112, "An input was sent outside normal melee reach");
      }
      for (let index = 0; index < contacts.length; index++) {
        const { state, frame } = contacts[index], before = states[frame - 1];
        assert.ok(state.players[1].hp < before.players[1].hp, "A visual hit had no actual HP effect");
        assert.equal(state.players[0].hits, index + 1, "The engine did not reward the distinct contact");
      }
      const last = states.at(-1)!;
      assert.equal(last.players[0].lastActions.light, move === "combo1" ? 1 : 2);
      assert.equal(last.players[0].lastActions.heavy, 1);
      assert.equal(last.players[0].lastActions.special, 0); assert.equal(last.players[0].lastActions.super, 0);
      assert.ok(states.every(state => state.players[0].energy === 100), "Free combos consumed energy");
      assert.ok(states.every(state => !state.finale && !state.players[0].transformation), "A combo used a definitive shortcut");
    }
  });
}
