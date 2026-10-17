import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGES,
  platformsAtTick,
  type Platform,
  type StageId,
} from "../shared/content";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";

function pushPastEdge(
  stage: StageId,
  support: number,
  tick: number,
  victimIndex: number,
  right: boolean,
) {
  const state = createMatch(stage, [
    { name: "A", fighter: "zavarce", wins: 0 },
    { name: "B", fighter: "zavarce", wins: 0 },
  ]);
  state.phase = "playing";
  state.tick = tick;
  const surface: Platform =
    support === -1
      ? {
          x: WORLD.left,
          y: WORLD.floor,
          width: WORLD.right - WORLD.left,
        }
      : platformsAtTick(stage, tick)[support];
  const victim = state.players[victimIndex];
  const pusher = state.players[1 - victimIndex];
  const direction = right ? 1 : -1;
  const edge = right ? surface.x + surface.width : surface.x;
  for (const player of state.players) {
    player.y = surface.y;
    player.grounded = true;
    player.supportPlatform = support;
  }
  victim.x = edge + direction * 4.9;
  pusher.x = victim.x - direction * 43;
  const inputs: [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>] =
    [emptyInput(), emptyInput()];
  inputs[1 - victimIndex][right ? "right" : "left"] = true;

  stepMatch(state, inputs);
  const nextSurface =
    support === -1 ? surface : platformsAtTick(stage, state.tick)[support];
  const nextEdge = right ? nextSurface.x + nextSurface.width : nextSurface.x;
  assert.ok(
    (victim.x - nextEdge) * direction > 5,
    "the real body contact must push the victim outside support",
  );
  assert.equal(
    victim.grounded,
    false,
    "contact must release support immediately",
  );
  assert.equal(victim.supportPlatform, null);
  assert.equal(
    pusher.supportPlatform,
    support,
    "the pusher stays on the surface",
  );
  const afterPushY = victim.y;
  stepMatch(state, inputs);
  // A horizontal surface can legitimately move back underneath the victim.
  if (support === -1 || !surface.motion || surface.motion.axis !== "x") {
    assert.ok(victim.y > afterPushY, "gravity resumes after the push");
    assert.ok(victim.vy > 0);
  }
  assert.equal(victim.stocks, 2);
}

test("body contact releases the main floor at both edges for either player in every stage", () => {
  for (const stage of STAGES)
    for (const victim of [0, 1])
      for (const right of [false, true])
        pushPastEdge(stage.id, -1, 0, victim, right);
});

test("body contact releases every elevated surface at both edges across motion phases", () => {
  for (const stage of STAGES)
    for (const [index, definition] of stage.platforms.entries())
      for (const phase of definition.motion ? [0, 0.25, 0.5, 0.75] : [0])
        for (const victim of [0, 1])
          for (const right of [false, true])
            pushPastEdge(
              stage.id,
              index,
              Math.floor(phase * (definition.motion?.period ?? 1)),
              victim,
              right,
            );
});
