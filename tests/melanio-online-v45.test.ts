import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput, type Input, type MatchState } from "../shared/engine";
import type { BuiltInFighterId } from "../shared/content";
import type { ServerMessage } from "../shared/protocol";

class Peer {
  readonly messages: ServerMessage[] = [];
  readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      this.messages.push(message);
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
    throw new Error(
      `Timed out waiting for ${type}; latest state: ${JSON.stringify(this.messages.filter((message) => message.type === "state").at(-1))}`,
    );
  }

  async state(matchId: string, predicate: (state: MatchState) => boolean) {
    return (
      await this.wait(
        "state",
        (message) => message.state.id === matchId && predicate(message.state),
      )
    ).state;
  }
}

async function listeningServer() {
  const dataDir = await mkdtemp(join(tmpdir(), "melanio-v45-"));
  try {
    const server = await makeArenaServer({
      serveClient: false,
      workshopEnabled: false,
      creator: { dataDir, databasePath: ":memory:", provider: null },
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
) {
  const roomName = `Melanio ${++roomSequence}`;
  host.send({
    type: "create",
    name: roomName,
    fighter: fighters[0],
    stage: "canaima",
    wins: 0,
    private: true,
  });
  const { room } = await host.wait(
    "room",
    (message) => message.room.players[0]?.name === roomName,
  );
  guest.send({
    type: "join",
    code: room.code,
    name: "Guest",
    fighter: fighters[1],
    wins: 0,
  });
  await host.wait("room", (message) => message.room.players.length === 2);
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const [hostStart, guestStart] = await Promise.all([
    host.wait("start"),
    guest.wait("start"),
  ]);
  assert.deepEqual(hostStart.state, guestStart.state);
  const active = server.rooms.get(room.code);
  assert.ok(active?.state);
  active.state.phase = "playing";
  active.state.players.forEach((player, i) => {
    player.x = i === 0 ? 300 : 900;
    player.y = 500;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.supportPlatform = null;
    player.jumps = 0;
    player.invincible = 0;
    player.energy = 100;
    player.attack = null;
    player.attackTick = 0;
    player.cooldown = 0;
  });
  return { code: room.code, state: active.state };
}

let roomSequence = 0;

function input(patch: Partial<Input> = {}): Input {
  return {
    ...emptyInput(),
    ...patch,
    actions: { ...emptyInput().actions, ...patch.actions },
  };
}

function sendInput(peer: Peer, matchId: string, value: Input) {
  peer.send({ type: "input", matchId, input: value });
}

test("Melanio signal returns to its owner with synchronized ownership and velocity on either seat", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url),
    guest = new Peer(fixture.url);
  try {
    await Promise.all([host.wait("welcome"), guest.wait("welcome")]);
    for (const melanioSide of [0, 1] as const) {
      const fighters: [BuiltInFighterId, BuiltInFighterId] =
        melanioSide === 0 ? ["melanio", "javier"] : ["javier", "melanio"];
      const pair = await startPair(fixture.server, host, guest, fighters);
      const actor = melanioSide === 0 ? host : guest;
      const other = melanioSide === 0 ? guest : host;
      const { state } = pair;
      const energy = state.players[melanioSide].energy;
      sendInput(
        actor,
        state.id,
        input({ actions: { ...emptyInput().actions, special: 1 } }),
      );
      const launched = await actor.state(state.id, (s) =>
        s.players[melanioSide].history.some(
          (entry) => entry.action === "special",
        ),
      );
      assert.ok(launched.players[melanioSide].energy < energy - 20);
      const returned = await other.state(state.id, (s) =>
        s.projectiles.some(
          (shot) =>
            shot.kind === "signal" &&
            (shot.age ?? 0) >= (shot.returnAfter ?? Infinity),
        ),
      );
      const signal = returned.projectiles.find(
        (shot) => shot.kind === "signal",
      )!;
      assert.equal(signal.owner, melanioSide);
      assert.equal(Math.sign(signal.vx), melanioSide === 0 ? -1 : 1);
      const mirrored = (
        await actor.wait(
          "state",
          (message) =>
            message.state.id === state.id &&
            message.state.tick === returned.tick,
        )
      ).state;
      assert.deepEqual(returned, mirrored);

      host.send({ type: "leave" });
      await Promise.all([
        host.wait("left"),
        guest.wait(
          "room",
          (message) => message.room.code === pair.code && message.room.players.length === 1,
        ),
      ]);
      guest.send({ type: "leave" });
      await guest.wait("left");
    }
  } finally {
    host.socket.terminate();
    guest.socket.terminate();
    await fixture.close();
  }
});

test("duplicate or reordered Melanio signal inputs cannot emit twice or charge twice", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url),
    guest = new Peer(fixture.url);
  try {
    const [welcome] = await Promise.all([
      host.wait("welcome"),
      guest.wait("welcome"),
    ]);
    const { state } = await startPair(fixture.server, host, guest, [
      "melanio",
      "javier",
    ]);
    const counters = { ...emptyInput().actions, special: 8 };
    const special = input({ actions: counters });
    sendInput(host, state.id, special);
    await guest.state(state.id, (s) =>
      s.players[0].history.some((entry) => entry.action === "special"),
    );
    sendInput(host, state.id, special);
    sendInput(
      host,
      state.id,
      input({ actions: { ...counters, special: 7 } }),
    );
    const returned = await guest.state(state.id, (s) =>
      s.projectiles.some(
        (shot) =>
          shot.kind === "signal" &&
          (shot.age ?? 0) >= (shot.returnAfter ?? Infinity),
      ),
    );
    assert.equal(
      returned.projectiles.filter((shot) => shot.kind === "signal").length,
      1,
    );
    assert.ok(returned.players[0].energy < 78);
    assert.equal(fixture.server.clients.get(welcome.id)?.input.actions.special, 8);
  } finally {
    host.socket.terminate();
    guest.socket.terminate();
    await fixture.close();
  }
});
