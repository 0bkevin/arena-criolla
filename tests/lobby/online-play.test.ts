import test from "node:test";
import assert from "node:assert/strict";
import { emptyInput } from "../../shared/engine/engine";
import {
  platformsAtTick,
  STAGES,
  SUPER_INTERRUPT_ENERGY_COST,
} from "../../shared/roster/roster";
import { onlineMatch } from "../helpers/online-match";

test("stalled online input releases held controls without replaying actions, then recovers", async () => {
  const match = await onlineMatch();
  try {
    const input = emptyInput();
    input.left = true;
    input.block = true;
    input.down = true;
    input.actions.light = 1;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    const held = await match.a.wait(
      "state",
      (message) => message.state.players[0].blocking,
    );
    const released = await match.a.wait(
      "state",
      (message) =>
        message.state.tick > held.state.tick &&
        !message.state.players[0].blocking,
    );
    assert.equal(match.client.input.left, false);
    assert.equal(match.client.input.right, false);
    assert.equal(match.client.input.down, false);
    assert.equal(match.client.input.block, false);
    assert.equal(
      match.client.input.actions.light,
      1,
      "expiry preserves consumed action counters",
    );
    assert.equal(match.active.state!.players[0].hits, 0);

    input.left = false;
    input.right = true;
    input.block = false;
    input.down = false;
    const x = match.active.state!.players[0].x;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    await match.a.wait(
      "state",
      (message) =>
        message.state.tick > released.state.tick &&
        message.state.players[0].x > x + 8,
    );
    assert.equal(match.client.input.right, true, "fresh input resumes control");
    assert.equal(
      match.active.state!.players[0].attack,
      null,
      "old attack is not replayed",
    );
  } finally {
    await match.close();
  }
});

test("online super charging cancels on release and on a stalled client's expired hold", async () => {
  for (const release of [true, false]) {
    const match = await onlineMatch();
    try {
      match.active.state!.players[0].energy = 100;
      const input = emptyInput();
      input.actions.super = 1;
      input.superHeld = true;
      match.a.send({ type: "input", matchId: match.active.state!.id, input });
      const charging = await match.a.wait(
        "state",
        (message) => message.state.players[0].superChargeTicks > 0,
      );
      assert.equal(charging.state.players[0].superUsed, false);
      if (release) {
        input.superHeld = false;
        match.a.send({ type: "input", matchId: match.active.state!.id, input });
      }
      const cancelled = await match.a.wait(
        "state",
        (message) =>
          message.state.tick > charging.state.tick &&
          message.state.players[0].superChargeTicks === 0,
      );
      assert.equal(cancelled.state.players[0].superUsed, false);
      assert.equal(cancelled.state.players[0].energy, 100);
      assert.equal(match.client.input.superHeld, false);
      assert.equal(match.client.input.actions.super, 1);
      const peer = await match.b.wait(
        "state",
        (message) => message.state.tick === cancelled.state.tick,
      );
      assert.deepEqual(peer.state, cancelled.state);
    } finally {
      await match.close();
    }
  }
});

test("consecutive release and repress packets cannot reuse an online charge", async () => {
  const match = await onlineMatch();
  let stopHold = () => {};
  try {
    const state = match.active.state!;
    state.players[0].energy = 100;
    const input = emptyInput();
    input.superHeld = true;
    input.actions.super = 1;
    stopHold = match.a.hold(state.id, input);
    await match.a.wait(
      "state",
      (message) => message.state.players[0].superChargeTicks >= 8,
    );
    input.superHeld = false;
    match.a.send({ type: "input", matchId: state.id, input });
    input.superHeld = true;
    input.actions.super++;
    match.a.send({ type: "input", matchId: state.id, input });
    const restarted = await match.a.wait(
      "state",
      (message) => message.state.players[0].lastActions.super === 2,
    );
    assert.equal(restarted.state.players[0].superUsed, false);
    assert.ok(
      restarted.state.players[0].superChargeTicks > 0 &&
        restarted.state.players[0].superChargeTicks < 10,
    );
    const activated = await match.a.wait(
      "state",
      (message) => message.state.players[0].superUsed,
    );
    const peer = await match.b.wait(
      "state",
      (message) => message.state.tick === activated.state.tick,
    );
    assert.deepEqual(peer.state, activated.state);
  } finally {
    stopHold();
    await match.close();
  }
});

test("online hits interrupt a charge and synchronize its penalty without consuming the use", async () => {
  {
    const side = 1 as 0 | 1;
    const match = await onlineMatch("caracas", ["capriles", "javier"]);
    let stopHold = () => {};
    try {
      const state = match.active.state!;
      state.players[0].x = 330;
      state.players[1].x = 410;
      state.players.forEach((player) => {
        player.energy = 100;
      });
      const input = emptyInput();
      input.actions.super = 1;
      input.superHeld = true;
      stopHold = (side === 0 ? match.a : match.b).hold(state.id, input);
      await match.a.wait(
        "state",
        (message) => message.state.players[side].superChargeTicks >= 5,
      );
      const hit = emptyInput();
      hit.actions.light = 1;
      (side === 0 ? match.b : match.a).send({
        type: "input",
        matchId: state.id,
        input: hit,
      });
      const interrupted = await match.a.wait(
        "state",
        (message) =>
          message.state.players[side].superChargeInterruptedTick !== undefined,
      );
      const player = interrupted.state.players[side];
      assert.equal(player.superChargeTicks, 0);
      assert.equal(player.superUsed, false);
      assert.ok(player.hp < 100);
      assert.ok(
        Math.abs(player.energy - (100 - SUPER_INTERRUPT_ENERGY_COST)) < 1,
        "the interruption charges its energy penalty",
      );
      const peer = await match.b.wait(
        "state",
        (message) => message.state.tick === interrupted.state.tick,
      );
      assert.deepEqual(peer.state, interrupted.state);
    } finally {
      stopHold();
      await match.close();
    }
  }
});

test("older action counters cannot trigger a second jump or overwrite held controls", async () => {
  const match = await onlineMatch();
  try {
    const input = emptyInput();
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 1,
    );
    const older = emptyInput();
    older.right = true;
    match.a.send({
      type: "input",
      matchId: match.active.state!.id,
      input: older,
    });
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(match.client.input.actions.jump, 1);
    assert.equal(match.client.input.right, false);
    assert.equal(match.active.state!.players[0].jumps, 1);
    input.actions.jump = 2;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 2,
    );
  } finally {
    await match.close();
  }
});

test("rematches reject previous-match input and accept the first fresh action", async () => {
  const match = await onlineMatch();
  try {
    const previousId = match.active.state!.id;
    const input = emptyInput();
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: previousId, input });
    await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 1,
    );
    match.active.state!.players[1].stocks = 1;
    match.active.state!.players[1].hp = 0;
    await match.a.wait(
      "state",
      (message) => message.state.phase === "finished",
    );
    match.a.send({ type: "rematch" });
    match.b.send({ type: "rematch" });
    const [next, peer] = await Promise.all([
      match.a.wait("start"),
      match.b.wait("start"),
    ]);
    assert.deepEqual(next.state, peer.state);
    assert.notEqual(next.state.id, previousId);
    assert.equal(next.state.remaining, 120 * 60);
    assert.equal(next.state.phase, "intro");
    input.right = true;
    input.actions.jump = 5;
    match.a.send({ type: "input", matchId: previousId, input });
    match.a.send({ type: "input", input });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(match.client.input, emptyInput());
    match.active.state!.phase = "playing";
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: next.state.id, input });
    const jumped = await match.a.wait(
      "state",
      (message) =>
        message.state.id === next.state.id &&
        message.state.players[0].jumps === 1,
    );
    assert.ok(jumped.state.players[0].x > 330);
    assert.equal(jumped.state.players[0].config.wins, 1);
  } finally {
    await match.close();
  }
});

test("online double knockouts synchronize a draw and award neither player a win", async () => {
  const match = await onlineMatch();
  try {
    match.active.state!.players.forEach((player) => {
      player.stocks = 1;
      player.hp = 0;
    });
    const [a, b] = await Promise.all([
      match.a.wait("state", (message) => message.state.phase === "finished"),
      match.b.wait("state", (message) => message.state.phase === "finished"),
    ]);
    assert.equal(a.state.winner, "draw");
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(
      match.active.view.players.map((player) => player.wins),
      [0, 0],
    );
    match.a.send({ type: "rematch" });
    match.b.send({ type: "rematch" });
    const next = await match.a.wait("start");
    assert.ok(
      next.state.players.every(
        (player) => player.stocks === 2 && player.config.wins === 0,
      ),
    );
  } finally {
    await match.close();
  }
});

test("online riders agree on moving-platform carry, jumping and dropping", async () => {
  for (const stage of STAGES.filter((s) =>
    s.platforms.some((p) => p.motion),
  ).slice(0, 1)) {
    const match = await onlineMatch(stage.id);
    try {
      const state = match.active.state!;
      const index = stage.platforms.findIndex((p) => p.motion);
      const rider = state.players[0];
      const placeRider = () => {
        const platform = platformsAtTick(stage.id, state.tick)[index];
        Object.assign(rider, {
          x: platform.x + platform.width / 2,
          y: platform.y,
          vx: 0,
          vy: 0,
          grounded: true,
          supportPlatform: index,
          jumps: 0,
          dropThrough: 0,
        });
        state.players[1].x = 50;
        return state.tick;
      };
      const start = placeRider();
      const carried = await match.a.wait(
        "state",
        (m) => m.state.tick >= start + 10,
      );
      const remote = await match.b.wait(
        "state",
        (m) => m.state.tick === carried.state.tick,
      );
      assert.deepEqual(carried.state, remote.state, stage.id);
      const surface = platformsAtTick(stage.id, carried.state.tick)[index];
      assert.equal(carried.state.players[0].supportPlatform, index);
      assert.equal(carried.state.players[0].y, surface.y);
      assert.ok(
        Math.abs(carried.state.players[0].x - surface.x - surface.width / 2) <
          0.002,
      );

      const input = emptyInput();
      input.down = true;
      match.a.send({ type: "input", matchId: state.id, input });
      const dropped = await match.a.wait(
        "state",
        (m) => m.state.players[0].dropThrough > 0,
      );
      assert.equal(dropped.state.players[0].supportPlatform, null);
      assert.equal(dropped.state.players[0].grounded, false);
      input.down = false;
      match.a.send({ type: "input", matchId: state.id, input });
      const landed = await match.a.wait(
        "state",
        (m) =>
          m.state.tick > dropped.state.tick &&
          m.state.players[0].supportPlatform === -1,
      );
      const landedRemote = await match.b.wait(
        "state",
        (m) => m.state.tick === landed.state.tick,
      );
      assert.deepEqual(landed.state, landedRemote.state, stage.id + " floor");
      assert.equal(landed.state.players[0].stocks, 2);

      const jumpTick = placeRider();
      input.actions.jump++;
      match.a.send({ type: "input", matchId: state.id, input });
      const jumped = await match.a.wait(
        "state",
        (m) => m.state.tick > jumpTick && m.state.players[0].jumps === 1,
      );
      assert.equal(jumped.state.players[0].supportPlatform, null);
      assert.ok(jumped.state.players[0].vy < 0);
      const jumpedRemote = await match.b.wait(
        "state",
        (m) => m.state.tick === jumped.state.tick,
      );
      assert.deepEqual(jumped.state, jumpedRemote.state, stage.id + " jump");
    } finally {
      await match.close();
    }
  }
});
