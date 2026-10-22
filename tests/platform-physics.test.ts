import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, platformsAtTick, type StageId } from "../shared/content";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../shared/engine";

function scene(stage: StageId, index: number, tick = 0, playerIndex = 0) {
  const state = createMatch(stage, [
    { name: "A", fighter: "zavarce", wins: 0 },
    { name: "B", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.tick = tick;
  const platform = platformsAtTick(stage, tick)[index];
  const player = state.players[playerIndex];
  player.x = platform.x + platform.width / 2;
  player.y = platform.y;
  player.supportPlatform = index;
  state.players[1 - playerIndex].x = Math.max(
    50,
    Math.min(1030, player.x + (player.x < 540 ? 350 : -350)),
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, player, inputs, platform };
}

for (const stage of STAGES) {
  for (const [index, definition] of stage.platforms.entries()) {
    test(`${stage.id} platform ${index}: top landing, underside, jump, drop and both edges across its cycle`, () => {
      const period = definition.motion?.period ?? 1;
      const phases = definition.motion
        ? [0, 0.25, 0.5, 0.75].map((f) => Math.floor(f * period))
        : [0];
      for (const tick of phases) {
        for (const playerIndex of [0, 1]) {
          const landed = scene(stage.id, index, tick, playerIndex);
          landed.player.y -= 8;
          landed.player.vy = 5;
          landed.player.grounded = false;
          landed.player.supportPlatform = null;
          landed.player.jumps = 2;
          for (let frame = 0; frame < 4; frame++)
            stepMatch(landed.state, landed.inputs);
          assert.equal(
            landed.player.supportPlatform,
            index,
            `landing tick ${tick}, P${playerIndex + 1}`,
          );
          assert.equal(
            landed.player.y,
            platformsAtTick(stage.id, landed.state.tick)[index].y,
          );
          assert.equal(landed.player.jumps, 0, "landing restores both jumps");

          const below = scene(stage.id, index, tick, playerIndex);
          below.player.y += 4;
          below.player.vy = -8;
          below.player.grounded = false;
          below.player.supportPlatform = null;
          below.player.jumps = 1;
          stepMatch(below.state, below.inputs);
          assert.equal(
            below.player.grounded,
            false,
            "ascending through underside never lands",
          );
          assert.equal(below.player.jumps, 1);

          const jump = scene(stage.id, index, tick, playerIndex);
          jump.inputs[playerIndex].actions.jump++;
          stepMatch(jump.state, jump.inputs);
          assert.equal(jump.player.grounded, false);
          assert.equal(jump.player.supportPlatform, null);
          assert.ok(
            jump.player.y < platformsAtTick(stage.id, jump.state.tick)[index].y,
          );

          const drop = scene(stage.id, index, tick, playerIndex);
          drop.inputs[playerIndex].down = true;
          stepMatch(drop.state, drop.inputs);
          drop.inputs[playerIndex].down = false;
          assert.equal(drop.player.grounded, false);
          for (let frame = 0; frame < 100; frame++)
            stepMatch(drop.state, drop.inputs);
          assert.equal(drop.player.y, WORLD.floor, `drop tick ${tick}`);
          assert.equal(drop.player.supportPlatform, -1);
          assert.equal(drop.player.stocks, 2);

          for (const direction of ["left", "right"] as const) {
            const edge = scene(stage.id, index, tick, playerIndex);
            edge.inputs[playerIndex][direction] = true;
            let leftSurface = false;
            for (let frame = 0; frame < 90 && !leftSurface; frame++) {
              stepMatch(edge.state, edge.inputs);
              leftSurface = !edge.player.grounded;
            }
            assert.ok(leftSurface, `walk ${direction} off tick ${tick}`);
            assert.equal(edge.player.supportPlatform, null);
          }
        }
      }
    });
  }
}

test("all five moving platforms carry both riders for a complete cycle including reversals", () => {
  for (const stage of STAGES) {
    for (const [index, definition] of stage.platforms.entries()) {
      if (!definition.motion) continue;
      for (const playerIndex of [0, 1]) {
        const { state, player, inputs } = scene(
          stage.id,
          index,
          0,
          playerIndex,
        );
        for (let frame = 0; frame < definition.motion.period; frame++) {
          stepMatch(state, inputs);
          const platform = platformsAtTick(stage.id, state.tick)[index];
          assert.equal(
            player.supportPlatform,
            index,
            `${stage.id} tick ${state.tick}`,
          );
          assert.equal(player.y, platform.y);
          assert.ok(
            Math.abs(player.x - platform.x - platform.width / 2) < 1e-8,
          );
          assert.equal(player.vy, 0);
        }
        assert.equal(player.stocks, 2);
      }
    }
  }
});

test("CPU descends from an elevated platform to pursue a fighter directly below", () => {
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    for (const stage of STAGES)
      for (const [index] of stage.platforms.entries()) {
        const { state, player, inputs } = scene(stage.id, index, 0, 1);
        state.players[0].x = player.x;
        state.players[0].invincible = 10000;
        inputs[1] = cpuInput(state, inputs[1], difficulty);
        assert.equal(
          inputs[1].down,
          true,
          `${stage.id}:${index} should descend`,
        );
        let reached = false;
        for (let frame = 0; frame < 120 && !reached; frame++) {
          inputs[1] = cpuInput(state, inputs[1], difficulty);
          stepMatch(state, inputs);
          reached = player.supportPlatform === -1;
        }
        assert.ok(reached, `${stage.id}:${index} CPU never reaches the floor`);
        assert.equal(player.stocks, 2);
        assert.equal(
          cpuInput(state, inputs[1], difficulty).down,
          false,
          "down must not stay held after landing",
        );
      }
  }
});

test("CPU can climb from the floor to rivals waiting on the platforms", () => {
  const missed: string[] = [];
  for (const difficulty of ["easy", "normal", "hard"] as const)
    for (const stage of STAGES)
      for (const [index, definition] of stage.platforms.entries())
        for (const phase of definition.motion ? [0, 0.25, 0.5, 0.75] : [0]) {
          const { state, inputs } = scene(
            stage.id,
            index,
            Math.floor(phase * (definition.motion?.period ?? 1)),
          );
          state.players[0].invincible = 10000;
          state.players[1].x = state.players[0].x;
          let reached = false;
          for (let frame = 0; frame < 600 && !reached; frame++) {
            inputs[1] = cpuInput(state, inputs[1], difficulty);
            stepMatch(state, inputs);
            reached = state.players[1].supportPlatform === index;
          }
          if (!reached)
            missed.push(`${difficulty}:${stage.id}:${index}:${phase}`);
        }
  assert.deepEqual(missed, [], "CPU cannot reach these platforms");
});

test("the main floor supports crouching, releases at both ledges, and permits recovery from below in every stage", () => {
  for (const stage of STAGES)
    for (const right of [false, true]) {
      const state = createMatch(stage.id, [
        { name: "A", fighter: "zavarce", wins: 0 },
        { name: "B", fighter: "javier", wins: 0 },
      ]);
      state.phase = "playing";
      const p = state.players[0];
      p.x = right ? WORLD.right - 1 : WORLD.left + 1;
      state.players[1].x = p.x + (right ? -300 : 300);
      const inputs: [Input, Input] = [emptyInput(), emptyInput()];
      inputs[0].down = true;
      for (let frame = 0; frame < 15; frame++) stepMatch(state, inputs);
      assert.equal(
        p.supportPlatform,
        -1,
        "down never drops through the main floor",
      );
      inputs[0].down = false;
      inputs[0][right ? "right" : "left"] = true;
      for (let frame = 0; frame < 12; frame++) stepMatch(state, inputs);
      assert.equal(
        p.grounded,
        false,
        `${stage.id}: ${right ? "right" : "left"} ledge`,
      );
      inputs[0][right ? "right" : "left"] = false;
      inputs[0][right ? "left" : "right"] = true;
      inputs[0].actions.jump++;
      let recovered = false;
      for (let frame = 0; frame < 110 && !recovered; frame++) {
        stepMatch(state, inputs);
        recovered = p.supportPlatform === -1;
      }
      assert.ok(
        recovered,
        `${stage.id}: jump recovers through floor underside`,
      );
      assert.equal(p.stocks, 2);
    }
});

test("real heavy attacks detach victims from every moving platform without disabling the attacker's support", () => {
  for (const stage of STAGES)
    for (const [index, definition] of stage.platforms.entries()) {
      if (!definition.motion) continue;
      const { state, player, inputs, platform } = scene(stage.id, index);
      player.x -= 32;
      const victim = state.players[1];
      Object.assign(victim, {
        x: platform.x + platform.width / 2 + 32,
        y: platform.y,
        grounded: true,
        supportPlatform: index,
        invincible: 0,
      });
      inputs[0].actions.heavy++;
      for (let frame = 0; frame < 20 && !player.hits; frame++)
        stepMatch(state, inputs);
      assert.equal(player.hits, 1, stage.id);
      assert.equal(victim.supportPlatform, null);
      assert.ok(victim.vy < 0);
      assert.equal(player.supportPlatform, index);
    }
});
