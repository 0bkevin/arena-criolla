import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput } from "../shared/engine";
import type { ServerMessage } from "../shared/protocol";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
class Peer {
  messages: ServerMessage[] = [];
  socket: WebSocket;
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) =>
      this.messages.push(JSON.parse(raw.toString())),
    );
  }
  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }
  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = performance.now() + 2000;
    while (performance.now() < deadline) {
      const index = this.messages.findIndex(
        (m) =>
          m.type === type &&
          predicate(m as Extract<ServerMessage, { type: T }>),
      );
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<
          ServerMessage,
          { type: T }
        >;
      await pause(5);
    }
    throw new Error(`Timed out waiting for ${type}`);
  }
}
async function matchFixture() {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const host = new Peer(url),
    guest = new Peer(url);
  const [welcome] = await Promise.all([
    host.wait("welcome"),
    guest.wait("welcome"),
  ]);
  host.send({
    type: "create",
    name: "QA resilience",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: true,
  });
  const { room } = await host.wait("room");
  guest.send({
    type: "join",
    code: room.code,
    name: "QA guest",
    fighter: "capriles",
    wins: 0,
  });
  await host.wait("room", (m) => m.room.players.length === 2);
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  await Promise.all([host.wait("start"), guest.wait("start")]);
  const active = server.rooms.get(room.code)!;
  return {
    server,
    host,
    guest,
    active,
    client: server.clients.get(welcome.id)!,
    close: async () => {
      host.socket.terminate();
      guest.socket.terminate();
      await server.close();
    },
  };
}

test("silent input stream releases held controls without replaying action counters", async () => {
  const f = await matchFixture();
  try {
    const input = emptyInput();
    input.right = true;
    input.block = true;
    input.down = true;
    input.actions.light = 7;
    f.host.send({ type: "input", matchId: f.active.state!.id, input });
    await pause(60);
    assert.equal(f.client.input.right, true);
    await pause(1100);
    assert.equal(
      f.client.input.right,
      false,
      "silent transport must not leave right pressed",
    );
    assert.equal(f.client.input.block, false);
    assert.equal(f.client.input.down, false);
    assert.equal(
      f.client.input.actions.light,
      7,
      "expiry must preserve action counters",
    );
    assert.equal(f.host.socket.readyState, WebSocket.OPEN);
  } finally {
    await f.close();
  }
});

test("queued inputs from the previous match cannot skip or move a rematch", async () => {
  const f = await matchFixture();
  try {
    const oldId = f.active.state!.id;
    f.active.state!.phase = "playing";
    f.active.state!.players[1].stocks = 1;
    f.active.state!.players[1].hp = 0;
    await Promise.all([
      f.host.wait("state", (m) => m.state.phase === "finished"),
      f.guest.wait("state", (m) => m.state.phase === "finished"),
    ]);
    f.host.send({ type: "rematch" });
    f.guest.send({ type: "rematch" });
    const [start] = await Promise.all([
      f.host.wait("start"),
      f.guest.wait("start"),
    ]);
    assert.notEqual(start.state.id, oldId);
    const stale = emptyInput();
    stale.right = true;
    stale.actions.dash = 1;
    f.host.send({ type: "input", matchId: oldId, input: stale });
    await pause(80);
    assert.equal(f.client.input.right, false);
    assert.equal(f.active.state!.players[0].lastActions.dash, 0);
    assert.ok(
      f.active.state!.tick < 100,
      "stale dash must not skip the new introduction",
    );
    const fresh = emptyInput();
    fresh.left = true;
    f.host.send({ type: "input", matchId: start.state.id, input: fresh });
    await pause(40);
    assert.equal(f.client.input.left, true);
    f.host.send({ type: "input", matchId: oldId, input: emptyInput() });
    await pause(40);
    assert.equal(
      f.client.input.left,
      true,
      "old cleanup must not release new-match controls",
    );
  } finally {
    await f.close();
  }
});

test("a delayed burst does not discard its final control release", async () => {
  const f = await matchFixture();
  try {
    f.client.window = performance.now();
    f.client.messages = 0;
    const held = emptyInput();
    held.right = true;
    for (let i = 0; i < 180; i++)
      f.host.send({ type: "input", matchId: f.active.state!.id, input: held });
    f.host.send({
      type: "input",
      matchId: f.active.state!.id,
      input: emptyInput(),
    });
    await pause(100);
    assert.equal(
      f.client.input.right,
      false,
      "the last release in a backlog burst must win",
    );
    assert.equal(
      f.host.socket.readyState,
      WebSocket.OPEN,
      "a bounded delayed burst should remain playable",
    );
  } finally {
    await f.close();
  }
});

test("application heartbeat echoes a bounded number of probes without consuming room controls", async () => {
  const f = await matchFixture();
  try {
    f.client.window = performance.now();
    f.client.messages = f.client.controls = f.client.pings = 0;
    for (let sentAt = 1; sentAt <= 6; sentAt++)
      f.host.send({ type: "ping", sentAt });
    for (let sentAt = 1; sentAt <= 5; sentAt++) {
      const pong = await f.host.wait("pong");
      assert.equal(pong.sentAt, sentAt);
    }
    await pause(40);
    assert.equal(f.host.messages.filter((m) => m.type === "pong").length, 0);
    assert.equal(f.client.controls, 0);
    assert.equal(f.host.socket.readyState, WebSocket.OPEN);
  } finally {
    await f.close();
  }
});

test("sustained excess closes with a policy code and releases held input", async () => {
  const f = await matchFixture();
  try {
    f.client.window = performance.now();
    f.client.messages = 0;
    const closed = new Promise<number>((resolve) =>
      f.host.socket.once("close", resolve),
    );
    const input = emptyInput();
    input.right = true;
    for (let n = 0; n < 361; n++)
      f.host.send({ type: "input", matchId: f.active.state!.id, input });
    assert.equal(await closed, 1008);
    assert.equal(f.client.input.right, false);
    await f.guest.wait("opponent-left");
    assert.equal(f.active.view.status, "waiting");
  } finally {
    await f.close();
  }
});
