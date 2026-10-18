import test from "node:test";
import assert from "node:assert/strict";
import type { FighterId, StageId } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";

type Side = 0 | 1;

function scene(stage: StageId, rival: FighterId, side: Side, gap = 260) {
  const vicente = { name: "Vicente", fighter: "zavarce", wins: 0 } as const;
  const opponent = { name: rival, fighter: rival, wins: 3 };
  const state = createMatch(
    stage,
    side === 0 ? [vicente, opponent] : [opponent, vicente],
  );
  state.phase = "playing";
  for (const player of state.players) {
    player.invincible = 0;
    player.energy = 100;
  }
  const caster = state.players[side],
    target = state.players[1 - side];
  caster.x = side === 0 ? 230 : 850;
  target.x = caster.x + (side === 0 ? gap : -gap);
  caster.facing = side === 0 ? 1 : -1;
  target.facing = -caster.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  return { state, caster, target, side, inputs, advance };
}

test("front-facing reflection of newly spawned bikes is independent of player order", () => {
  for (const gap of [80, 120, 180]) {
    const outcomes = [];
    for (const side of [0, 1] as const) {
      const run = scene("poliedro", "dudamel", side, gap);
      run.inputs[side].actions.special++;
      run.inputs[1 - side].actions.special++;
      run.advance(12);
      outcomes.push({
        reflected: run.state.projectiles.filter((shot) => shot.owner !== side)
          .length,
        defenderHp: run.target.hp,
      });
    }
    assert.ok(
      outcomes[0].reflected > 0,
      `gap ${gap}: the conducting window is active`,
    );
    assert.deepEqual(
      outcomes[0],
      outcomes[1],
      `gap ${gap}: either player must reflect the newly spawned motorcycles`,
    );
  }
});
