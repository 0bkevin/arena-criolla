import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput } from "../shared/engine";
import { STAGES, type BuiltInFighterId } from "../shared/content";
import type { ServerMessage } from "../shared/protocol";

class Peer {
  readonly messages: ServerMessage[] = [];
  readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      this.messages.push(JSON.parse(raw.toString()) as ServerMessage);
    });
  }

  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }

  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () =>
      true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const end = Date.now() + 4_000;
    while (Date.now() < end) {
      const index = this.messages.findIndex(
        (message) =>
          message.type === type &&
          predicate(message as Extract<ServerMessage, { type: T }>),
      );
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<
          ServerMessage,
          { type: T }
        >;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${type}`);
  }
}

async function listeningServer() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "arena-roster-v41-"));
  try {
    const server = await makeArenaServer({
      serveClient: false,
      creator: {
        dataDir,
        databasePath: ":memory:",
        provider: null,
      },
    });
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address === "object");
    return {
      server,
      url: `ws://127.0.0.1:${address.port}/ws`,
      close: async () => {
        await server.close();
        await rm(dataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }
}

async function startPair(
  server: Awaited<ReturnType<typeof makeArenaServer>>,
  host: Peer,
  guest: Peer,
  fighters: [BuiltInFighterId, BuiltInFighterId],
  stage: (typeof STAGES)[number]["id"],
) {
  host.send({
    type: "create",
    name: "Host",
    fighter: fighters[0],
    stage,
    wins: 0,
    private: true,
  });
  const { room: created } = await host.wait("room");
  guest.send({
    type: "join",
    code: created.code,
    name: "Guest",
    fighter: fighters[1],
    wins: 0,
  });
  await host.wait("room", (message) => message.room.players.length === 2);
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const [first, second] = await Promise.all([
    host.wait("start"),
    guest.wait("start"),
  ]);
  assert.deepEqual(first.state, second.state);
  const active = server.rooms.get(created.code);
  assert.ok(active, "created room remains available after start");
  return { code: created.code, state: active.state!, start: first.state };
}

const NEW_FIGHTERS = [
  "javier",
  "dayana",
  "deyna",
  "nacho",
  "capriles",
  "lorenzo",
  "carolina",
  "bolivar",
  "edgar",
  "melanio",
] as const satisfies readonly BuiltInFighterId[];

test("new fighters create, join, select and start online on every stage", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url);
  const guest = new Peer(fixture.url);
  try {
    const [hostWelcome] = await Promise.all([
      host.wait("welcome"),
      guest.wait("welcome"),
    ]);

    for (let i = 0; i < STAGES.length; i++) {
      const createdHostFighter = NEW_FIGHTERS[i % NEW_FIGHTERS.length];
      const createdGuestFighter = NEW_FIGHTERS[(i + 1) % NEW_FIGHTERS.length];
      const hostFighter = NEW_FIGHTERS[(i + 2) % NEW_FIGHTERS.length];
      const guestFighter = NEW_FIGHTERS[(i + 3) % NEW_FIGHTERS.length];
      const stage = STAGES[i].id;
      const createdStage = STAGES[(i + 1) % STAGES.length].id;
      const guestAttempt = STAGES[(i + 2) % STAGES.length].id;

      host.send({
        type: "create",
        name: `Host ${i}`,
        fighter: createdHostFighter,
        stage: createdStage,
        wins: 2,
        private: true,
      });
      const { room: created } = await host.wait(
        "room",
        (message) => message.room.players[0]?.name === `Host ${i}`,
      );
      guest.send({
        type: "join",
        code: created.code,
        name: `Guest ${i}`,
        fighter: createdGuestFighter,
        wins: 1,
      });
      await host.wait("room", (message) => message.room.players.length === 2);

      guest.send({
        type: "select",
        fighter: guestFighter,
        wins: 5,
        stage: guestAttempt,
      });
      const guestSelected = await host.wait(
        "room",
        (message) => message.room.players[1]?.wins === 5,
      );
      assert.equal(guestSelected.room.players[1].fighter, guestFighter);
      assert.equal(
        guestSelected.room.stage,
        createdStage,
        "a joining player cannot change the host's stage",
      );

      host.send({ type: "ready", ready: true });
      await host.wait("room", (message) => message.room.players[0]?.ready);

      // The host can change fighter and stage together. Changing stage clears
      // readiness, and the joiner's stage proposal remains ignored.
      host.send({
        type: "select",
        fighter: hostFighter,
        wins: 3,
        stage,
      });
      const reset = await host.wait(
        "room",
        (message) =>
          message.room.stage === stage &&
          message.room.players[0]?.fighter === hostFighter &&
          message.room.players[0]?.wins === 3 &&
          message.room.players.every((player) => !player.ready),
      );
      assert.equal(reset.room.players[1].fighter, guestFighter);

      host.send({ type: "ready", ready: true });
      guest.send({ type: "ready", ready: true });
      const [hostStart, guestStart] = await Promise.all([
        host.wait("start"),
        guest.wait("start"),
      ]);
      assert.equal(hostStart.index, 0);
      assert.equal(guestStart.index, 1);
      assert.deepEqual(hostStart.state, guestStart.state);
      assert.equal(hostStart.state.stage, stage);
      assert.deepEqual(
        hostStart.state.players.map((player) => player.config.fighter),
        [hostFighter, guestFighter],
      );
      assert.deepEqual(
        hostStart.state.players.map((player) => player.config.wins),
        [3, 5],
      );

      const active = fixture.server.rooms.get(created.code)!.state!;
      active.phase = "playing";
      active.players.forEach((player, index) => {
        player.invincible = 0;
        player.energy = 100;
        player.x = index === 0 ? 400 : 700;
      });
      const hostInput = emptyInput();
      const guestInput = emptyInput();
      hostInput.actions.special = 1;
      guestInput.actions.special = 1;
      host.send({ type: "input", matchId: active.id, input: hostInput });
      guest.send({ type: "input", matchId: active.id, input: guestInput });
      const specialStarted = (
        message: Extract<ServerMessage, { type: "state" }>,
      ) =>
        message.state.id === active.id &&
        message.state.players.every(
          (player) => player.lastActions.special === 1,
        );
      const [hostState, guestState] = await Promise.all([
        host.wait("state", specialStarted),
        guest.wait("state", specialStarted),
      ]);
      assert.deepEqual(hostState.state, guestState.state);
      assert.ok(hostState.state.players.every((player) => player.energy < 80));

      if (i === 0) {
        // Finish and rematch one of the new-fighter matchups. The previous
        // match's ID must not authorize input after the server creates a new one.
        const previousId = active.id;
        active.players[1].stocks = 1;
        active.players[1].hp = 0;
        await Promise.all([
          host.wait("state", (message) => message.state.phase === "finished"),
          guest.wait("state", (message) => message.state.phase === "finished"),
        ]);
        host.send({ type: "rematch" });
        guest.send({ type: "rematch" });
        const [rematchHost, rematchGuest] = await Promise.all([
          host.wait("start"),
          guest.wait("start"),
        ]);
        assert.notEqual(rematchHost.state.id, previousId);
        assert.deepEqual(rematchHost.state, rematchGuest.state);
        assert.equal(rematchHost.state.stage, stage);
        assert.deepEqual(
          rematchHost.state.players.map((player) => player.config.fighter),
          [hostFighter, guestFighter],
        );
        assert.deepEqual(
          rematchHost.state.players.map((player) => player.config.wins),
          [4, 5],
        );

        const next = fixture.server.rooms.get(created.code)!.state!;
        next.phase = "playing";
        const stale = emptyInput();
        stale.right = true;
        stale.actions.jump = 1;
        host.send({ type: "input", matchId: previousId, input: stale });
        await new Promise((resolve) => setTimeout(resolve, 80));
        assert.deepEqual(
          fixture.server.clients.get(hostWelcome.id)?.input,
          emptyInput(),
          "a stale packet cannot repopulate the rematch input",
        );
        assert.equal(next.players[0].jumps, 0);
        assert.equal(next.players[0].x, 330);

        const fresh = emptyInput();
        fresh.right = true;
        fresh.actions.jump = 1;
        host.send({ type: "input", matchId: next.id, input: fresh });
        const freshState = await host.wait(
          "state",
          (message) =>
            message.state.id === next.id &&
            message.state.players[0].jumps === 1,
        );
        assert.ok(freshState.state.players[0].x > 330);
      }

      host.send({ type: "leave" });
      await Promise.all([
        host.wait("left"),
        guest.wait(
          "room",
          (message) =>
            message.room.code === created.code &&
            message.room.players.length === 1,
        ),
      ]);
      guest.send({ type: "leave" });
      await guest.wait("left");
      assert.equal(fixture.server.rooms.size, 0);
      host.messages.length = 0;
      guest.messages.length = 0;
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
  } finally {
    host.socket.terminate();
    guest.socket.terminate();
    await fixture.close();
  }
});

test("new-fighter rooms can rejoin by invitation code after an in-match disconnect", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url);
  const guest = new Peer(fixture.url);
  let rejoined: Peer | undefined;
  try {
    await Promise.all([host.wait("welcome"), guest.wait("welcome")]);
    const first = await startPair(
      fixture.server,
      host,
      guest,
      ["javier", "dayana"],
      "canaima",
    );
    first.state.phase = "playing";
    const originalId = first.state.id;
    guest.socket.terminate();
    await host.wait("opponent-left");
    const waiting = await host.wait(
      "room",
      (message) =>
        message.room.code === first.code &&
        message.room.status === "waiting" &&
        message.room.players.length === 1,
    );
    assert.equal(waiting.room.players[0].fighter, "javier");

    rejoined = new Peer(fixture.url);
    await rejoined.wait("welcome");
    rejoined.send({
      type: "join",
      code: first.code,
      name: "Rejoined",
      fighter: "dayana",
      wins: 0,
    });
    const restored = await host.wait(
      "room",
      (message) =>
        message.room.code === first.code && message.room.players.length === 2,
    );
    assert.equal(restored.room.stage, "canaima");
    assert.deepEqual(
      restored.room.players.map((player) => player.fighter),
      ["javier", "dayana"],
    );
    host.send({ type: "ready", ready: true });
    rejoined.send({ type: "ready", ready: true });
    const [restartedHost, restartedGuest] = await Promise.all([
      host.wait("start"),
      rejoined.wait("start"),
    ]);
    assert.notEqual(restartedHost.state.id, originalId);
    assert.deepEqual(restartedHost.state, restartedGuest.state);
    assert.deepEqual(
      restartedHost.state.players.map((player) => player.config.fighter),
      ["javier", "dayana"],
    );
  } finally {
    [host, guest, rejoined].forEach((peer) => peer?.socket.terminate());
    await fixture.close();
  }
});
