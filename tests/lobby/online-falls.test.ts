import test from "node:test";
import assert from "node:assert/strict";
import { emptyInput, WORLD } from "../../shared/engine/engine";
import { finaleById } from "../../shared/engine/finales/finales";
import { onlineMatch } from "../helpers/online-match";

test("online simultaneous falls synchronize both sides of the HP cutoff and keep return protection", async () => {
  for (const [before, after, stocks] of [
    [
      [20, 10],
      [12, 6],
      [2, 2],
    ],
    [
      [10, 9.99],
      [6, 100],
      [2, 1],
    ],
    [
      [9.99, 20],
      [100, 12],
      [1, 2],
    ],
  ] as const) {
    const match = await onlineMatch("poliedro", ["conde", "emilio"]);
    try {
      const state = match.active.state!;
      const nextEffect = state.nextId;
      for (const seat of [0, 1] as const) {
        const player = state.players[seat];
        const empowerment = finaleById(player.config.fighter)!.empowerment!;
        player.hp = before[seat];
        player.energy = 67;
        player.superUsed = true;
        player.transformation = {
          id: empowerment.id,
          ticks: 240,
          damageMultiplier: empowerment.damageMultiplier,
        };
        player.x = seat === 0 ? WORLD.x - 121 : WORLD.x + WORLD.width + 121;
      }
      const returned = await match.a.wait("state", ({ state: snapshot }) =>
        snapshot.effects.some(
          (effect) => effect.id >= nextEffect && effect.kind === "ringout",
        ),
      );
      const peer = await match.b.wait(
        "state",
        (message) => message.state.tick === returned.state.tick,
      );
      assert.deepEqual(peer.state, returned.state);
      assert.equal(returned.state.phase, "playing");
      for (const seat of [0, 1] as const) {
        const player = returned.state.players[seat];
        assert.equal(player.hp, after[seat]);
        assert.equal(player.stocks, stocks[seat]);
        assert.equal(player.superUsed, true);
        assert.ok(player.invincible > 0);
        assert.equal(
          returned.state.effects.filter(
            (effect) =>
              effect.id >= nextEffect &&
              effect.kind === "ringout" &&
              effect.owner === seat,
          ).length,
          1,
        );
        if (before[seat] >= 10) {
          assert.ok(player.fallProtectionTicks! > 0);
          assert.ok(player.fallProtectionTicks! <= 60);
          assert.equal(player.fallProtectionBase, 0);
          assert.equal(player.fallProtectionDashBase, 0);
          assert.ok(player.energy >= 67 && player.energy < 68);
          assert.ok(player.transformation!.ticks < 240);
          assert.ok(player.transformation!.ticks > 200);
        } else {
          assert.equal(player.fallProtectionTicks, undefined);
          assert.equal(player.transformation, undefined);
          assert.ok(player.energy >= 47 && player.energy < 48);
        }
      }
      const later = await match.a.wait(
        "state",
        (message) => message.state.tick >= returned.state.tick + 12,
      );
      for (const seat of [0, 1] as const) {
        const player = later.state.players[seat];
        assert.equal(player.hp, after[seat], "one exit is charged once");
        assert.equal(player.stocks, stocks[seat]);
        assert.ok(
          player.invincible < returned.state.players[seat].invincible,
          "snapshots do not renew protection",
        );
      }
    } finally {
      await match.close();
    }
  }
});

test("an online return accepts fresh input and ends protection when attacking", async () => {
  const match = await onlineMatch();
  try {
    const state = match.active.state!;
    const player = state.players[0];
    player.hp = 20;
    player.x = WORLD.x - 121;
    const returned = await match.a.wait(
      "state",
      (message) => message.state.players[0].fallProtectionTicks !== undefined,
    );
    assert.equal(returned.state.players[0].hp, 12);
    const input = emptyInput();
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: state.id, input });
    const jumped = await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 1,
    );
    assert.ok(jumped.state.players[0].vy < 0);
    assert.ok(jumped.state.players[0].fallProtectionTicks! > 0);
    const ready = await match.a.wait(
      "state",
      (message) => message.state.players[0].cooldown === 0,
    );
    assert.ok(ready.state.players[0].fallProtectionTicks! > 0);
    input.actions.light = 1;
    match.a.send({ type: "input", matchId: state.id, input });
    const attacking = await match.a.wait(
      "state",
      (message) => message.state.players[0].attack === "light",
    );
    assert.equal(attacking.state.players[0].fallProtectionTicks, undefined);
    assert.equal(attacking.state.players[0].invincible, 0);
    const peer = await match.b.wait(
      "state",
      (message) => message.state.tick === attacking.state.tick,
    );
    assert.deepEqual(peer.state, attacking.state);
  } finally {
    await match.close();
  }
});

test("online final-stock falls synchronize draws and winners; rematches clear return metadata", async () => {
  for (const [health, winner] of [
    [[9.99, 9.99], "draw"],
    [[10, 9.99], 0],
    [[9.99, 10], 1],
  ] as const) {
    const match = await onlineMatch();
    try {
      const state = match.active.state!;
      for (const seat of [0, 1] as const) {
        const player = state.players[seat];
        player.stocks = 1;
        player.hp = health[seat];
        player.x = seat === 0 ? WORLD.x - 121 : WORLD.x + WORLD.width + 121;
      }
      const ended = await match.a.wait(
        "state",
        (message) => message.state.phase === "finished",
      );
      const peer = await match.b.wait(
        "state",
        (message) => message.state.phase === "finished",
      );
      assert.deepEqual(peer.state, ended.state);
      assert.equal(ended.state.winner, winner);
      for (const seat of [0, 1] as const) {
        const player = ended.state.players[seat];
        assert.equal(player.stocks, seat === winner ? 1 : 0);
        assert.equal(player.hp, seat === winner ? 6 : 0);
        if (seat === winner) assert.ok(player.fallProtectionTicks! > 0);
      }
      assert.deepEqual(
        match.active.view.players.map((player) => player.wins),
        [winner === 0 ? 1 : 0, winner === 1 ? 1 : 0],
      );
      match.a.send({ type: "rematch" });
      match.b.send({ type: "rematch" });
      const next = await match.a.wait("start");
      const nextPeer = await match.b.wait("start");
      assert.deepEqual(nextPeer.state, next.state);
      for (const player of next.state.players) {
        assert.equal(player.hp, 100);
        assert.equal(player.stocks, 2);
        assert.equal(player.fallProtectionTicks, undefined);
        assert.equal(player.fallProtectionBase, undefined);
        assert.equal(player.fallProtectionDashBase, undefined);
      }
    } finally {
      await match.close();
    }
  }
});
