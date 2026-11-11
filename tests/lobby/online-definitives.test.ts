import test from "node:test";
import assert from "node:assert/strict";
import { makeArenaServer } from "../../server/index";
import {
  emptyInput,
  type Input,
  type MatchState,
  stepMatch,
} from "../../shared/engine/engine";
import { finaleById } from "../../shared/engine/finales/finales";
import type { FighterId } from "../../shared/roster/roster";
import { onlineMatch, TestClient } from "../helpers/online-match";

{
  const side = 1 as 0 | 1;
  test("rooms synchronize a guest's cinematic capture, damage, paused clock and release over real sockets", async () => {
    const match = await onlineMatch("canaima", ["capriles", "nacho"], [2, 2]);
    let stopHold = () => {};
    try {
      const state = match.active.state!;
      state.players.forEach((player, index) => {
        player.x = index === 0 ? 330 : 530;
        player.energy = 100;
      });
      const input = emptyInput();
      input.actions.super++;
      input.superHeld = true;
      stopHold = (side === 0 ? match.a : match.b).hold(state.id, input);
      const capture = await match.a.wait("state", (message) =>
        Boolean(message.state.finale),
      );
      stopHold();
      const remoteCapture = await match.b.wait(
        "state",
        (message) =>
          message.state.finale?.tick === capture.state.finale!.tick &&
          message.state.finale.startedTick ===
            capture.state.finale!.startedTick,
      );
      assert.deepEqual(capture.state, remoteCapture.state);
      assert.equal(capture.state.finale!.owner, side);
      assert.equal(capture.state.finale!.target, 1 - side);
      assert.equal(capture.state.players[1 - side].hp, 100);
      const positions = capture.state.players.map((player) => [
        player.x,
        player.y,
      ]);
      const damageBeats = finaleById(
        capture.state.finale!.fighter,
      )!.damageBeats;
      const beat = await match.a.wait("state", (message) =>
        Boolean(
          message.state.finale &&
          message.state.finale.tick >= damageBeats[0] &&
          message.state.finale.tick < damageBeats[1],
        ),
      );
      const remoteBeat = await match.b.wait(
        "state",
        (message) =>
          message.state.finale?.tick === beat.state.finale!.tick &&
          message.state.finale.startedTick === beat.state.finale!.startedTick,
      );
      assert.deepEqual(beat.state, remoteBeat.state);
      assert.equal(beat.state.tick, capture.state.tick);
      assert.equal(beat.state.remaining, capture.state.remaining);
      assert.deepEqual(
        beat.state.players.map((player) => [player.x, player.y]),
        positions,
      );
      assert.equal(beat.state.players[side].hits, 1);
      assert.ok(
        Math.abs(
          beat.state.players[1 - side].hp -
            (100 - beat.state.finale!.damage / 3),
        ) < 1e-8,
      );
      const replay: MatchState = JSON.parse(JSON.stringify(capture.state));
      const replayInputs: [Input, Input] = [emptyInput(), emptyInput()];
      replay.players.forEach((player, index) => {
        replayInputs[index].actions = { ...player.lastActions };
      });
      for (
        let frame = capture.state.finale!.tick;
        frame < beat.state.finale!.tick;
        frame++
      )
        stepMatch(replay, replayInputs);
      assert.deepEqual(
        replay,
        beat.state,
        "network snapshots replay the identical scene between broadcasts",
      );
      const released = await match.a.wait(
        "state",
        (message) =>
          !message.state.finale && message.state.players[side].hits === 1,
        (capture.state.finale!.duration / 60) * 1000 + 1000,
      );
      const remoteReleased = await match.b.wait(
        "state",
        (message) =>
          !message.state.finale &&
          message.state.tick === released.state.tick &&
          message.state.players[side].hits === 1,
      );
      assert.deepEqual(released.state, remoteReleased.state);
      assert.equal(released.state.players[side].attack, null);
      assert.equal(released.state.players[1 - side].stocks, 2);
      assert.ok(
        Math.abs(
          released.state.players[1 - side].hp -
            (100 - capture.state.finale!.damage),
        ) < 1e-8,
      );
      assert.equal(
        Math.sign(released.state.players[1 - side].vx),
        finaleById(capture.state.finale!.fighter)?.release?.force === 0
          ? 0
          : side === 0
            ? 1
            : -1,
      );
      assert.ok(released.state.players[side].cooldown > 0);
    } finally {
      stopHold();
      await match.close();
    }
  });
}

test("rooms allow Vicente's definitive from zero wins and enforce its energy cost for both players", async () => {
  for (const wins of [0]) {
    for (const energy of [89, 90]) {
      const match = await onlineMatch(
        "poliedro",
        ["zavarce", "zavarce"],
        [wins, wins],
      );
      const stopHolds: (() => void)[] = [];
      try {
        const state = match.active.state!;
        state.players.forEach((player) => {
          player.energy = energy;
        });
        const input = emptyInput();
        input.actions.super++;
        input.superHeld = true;
        stopHolds.push(
          match.a.hold(state.id, input),
          match.b.hold(state.id, input),
        );
        const preparing = await match.a.wait("state", (message) =>
          message.state.players.every(
            (player) => player.lastActions.super === 1,
          ),
        );
        assert.ok(
          preparing.state.players.every(
            (player) => player.attack === null && !player.superUsed,
          ),
        );
        const received =
          energy >= 90
            ? await match.a.wait("state", (message) =>
                message.state.players.every((player) => player.superUsed),
              )
            : preparing;
        const remote = await match.b.wait(
          "state",
          (message) => message.state.tick === received.state.tick,
        );
        assert.deepEqual(remote.state, received.state);
        assert.equal(received.state.projectiles.length, 0);
        for (const player of received.state.players) {
          assert.equal(player.config.wins, wins);
          assert.equal(player.attack, energy >= 90 ? "super" : null);
          if (energy >= 90) {
            assert.ok(player.energy < 3);
            assert.ok(player.cooldown > 0);
          } else {
            assert.ok(player.energy >= 89 && player.energy < 90);
            assert.equal(player.cooldown, 0);
          }
        }
      } finally {
        stopHolds.forEach((stop) => stop());
        await match.close();
      }
    }
  }
});

test("online Carolina reflects a motorcycle from either player", async () => {
  for (const stage of ["poliedro"] as const) {
    for (const side of [0, 1] as const) {
      const fighters: [FighterId, FighterId] =
        side === 0 ? ["zavarce", "carolina"] : ["carolina", "zavarce"];
      const match = await onlineMatch(stage, fighters, [3, 3]);
      try {
        const state = match.active.state!;
        const caster = state.players[side],
          reflector = state.players[1 - side];
        caster.x = side === 0 ? 230 : 850;
        reflector.x = caster.x + (side === 0 ? 245 : -245);
        caster.facing = side === 0 ? 1 : -1;
        reflector.facing = -caster.facing;
        state.players.forEach((player) => {
          player.energy = 100;
        });
        const input = emptyInput();
        input.actions.special++;
        match.a.send({ type: "input", matchId: state.id, input });
        match.b.send({ type: "input", matchId: state.id, input });
        const left = await match.a.wait("state", (message) =>
          message.state.projectiles.some(
            (shot) => shot.kind === "courier" && shot.owner === 1 - side,
          ),
        );
        const right = await match.b.wait(
          "state",
          (message) => message.state.tick === left.state.tick,
        );
        assert.deepEqual(left.state, right.state, `${stage}/P${side + 1}`);
        assert.equal(
          left.state.players[1 - side].hp,
          100,
          "active reflection prevents the immediate hit",
        );
        assert.ok(
          left.state.projectiles.some(
            (shot) =>
              shot.kind === "courier" &&
              shot.owner === 1 - side &&
              Math.sign(shot.vx) === -caster.facing,
          ),
        );
      } finally {
        await match.close();
      }
    }
  }
});

test("anonymous rooms synchronize Lele's launched trap reflected by Carolina", async () => {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const a = new TestClient(url),
    b = new TestClient(url);
  try {
    await Promise.all([a.wait("welcome"), b.wait("welcome")]);
    a.send({
      type: "create",
      name: "Lele",
      fighter: "lele",
      stage: "guaira",
      wins: 0,
      private: true,
    });
    const { room } = await a.wait("room");
    b.send({
      type: "join",
      code: room.code,
      name: "Carolina",
      fighter: "carolina",
      wins: 0,
    });
    await a.wait("room", (m) => m.room.players.length === 2);
    a.send({ type: "ready", ready: true });
    b.send({ type: "ready", ready: true });
    await Promise.all([a.wait("start"), b.wait("start")]);
    const state = server.rooms.get(room.code)!.state!;
    state.phase = "playing";
    state.players.forEach((p) => {
      p.invincible = 0;
      p.energy = 60;
    });
    state.players[0].x = 400;
    state.players[1].x = 630;
    const input = emptyInput();
    input.actions.special++;
    a.send({ type: "input", matchId: state.id, input });
    b.send({ type: "input", matchId: state.id, input });
    const [left, right] = await Promise.all([
      a.wait("state", (m) =>
        m.state.projectiles.some((p) => p.kind === "prank" && p.owner === 1),
      ),
      b.wait("state", (m) =>
        m.state.projectiles.some((p) => p.kind === "prank" && p.owner === 1),
      ),
    ]);
    assert.deepEqual(left.state, right.state);
    assert.equal(left.state.players[0].config.fighter, "lele");
    assert.equal(left.state.players[1].config.fighter, "carolina");
    assert.ok(
      left.state.projectiles.some(
        (p) => p.vx < 0 && p.plantAfter === undefined,
      ),
    );
    assert.ok(left.state.players.every((p) => p.energy < 40));
  } finally {
    a.socket.terminate();
    b.socket.terminate();
    await server.close();
  }
});
