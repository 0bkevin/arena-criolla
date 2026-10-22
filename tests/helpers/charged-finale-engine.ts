import { SUPER_CHARGE_TICKS } from "../../shared/content";
import {
  stepMatch as step,
  type Input,
  type MatchState,
} from "../../shared/engine";

export * from "../../shared/engine";

/**
 * Choreography fixtures begin on the last frame of an already held charge.
 * This keeps their exact attack/contact timelines independent of preparation.
 * super-charge.test.ts and socket tests use the unmodified engine and real holds.
 */
export function stepMatch(state: MatchState, inputs: [Input, Input]) {
  if (state.phase === "playing" && !state.finale && !state.hitstop) {
    for (let side = 0; side < 2; side++) {
      const player = state.players[side],
        input = inputs[side];
      if (input.actions.super === player.lastActions.super) continue;
      input.superHeld = true;
      if (
        !player.superUsed &&
        !input.block &&
        player.cooldown <= 1 &&
        player.stun <= 1 &&
        !player.attack &&
        !player.dash
      ) {
        player.superChargeTicks = SUPER_CHARGE_TICKS - 1;
        // This press was already consumed during the prepared hold.
        player.lastActions.super = input.actions.super;
      }
    }
  }
  step(state, inputs);
}
