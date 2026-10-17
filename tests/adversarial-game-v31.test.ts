import test from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput, type MatchState } from "../shared/engine";
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
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean =
      () => true,
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
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    url: `ws://127.0.0.1:${address.port}/ws`,
  };
}

test("adversarial v31: private invite requires its full 128-bit token", async () => {
  const { server, url } = await listeningServer();
  const host = new Peer(url);
  const guesser = new Peer(url);
  try {
    await Promise.all([host.wait("welcome"), guesser.wait("welcome")]);
    host.send({
      type: "create",
      name: "Host",
      fighter: "zavarce",
      stage: "caracas",
      wins: 0,
      private: true,
    });
    const { room } = await host.wait("room");

    assert.match(room.code, /^[A-F0-9]{32}$/);
    guesser.send({
      type: "join",
      code: room.code.slice(0, 6),
      name: "Short guess",
      fighter: "capriles",
      wins: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(server.rooms.get(room.code)!.clients.length, 1);
    guesser.send({
      type: "join",
      code: room.code,
      name: "Guesser",
      fighter: "capriles",
      wins: 0,
    });
    const joined = await host.wait("room", (message) =>
      message.room.players.some((player) => player.name === "Guesser"),
    );
    assert.equal(joined.room.players.length, 2);
  } finally {
    host.socket.terminate();
    guesser.socket.terminate();
    await server.close();
  }
});

test("adversarial v31: unknown websocket upgrade paths are rejected and closed", async () => {
  const { server } = await listeningServer();
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const socket = connect({
    port: address.port,
    host: "127.0.0.1",
    allowHalfOpen: true,
  });
  try {
    const response = await new Promise<string>((resolve, reject) => {
      let received = "";
      const timeout = setTimeout(() => resolve("still-open"), 500);
      socket.once("connect", () => {
        socket.write(
          "GET /unexpected HTTP/1.1\r\n" +
            "Host: localhost\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
            "Sec-WebSocket-Version: 13\r\n\r\n",
        );
      });
      socket.on("data", (chunk) => {
        received += chunk.toString();
        clearTimeout(timeout);
        resolve(received);
      });
      socket.once("close", () => {
        clearTimeout(timeout);
        resolve(received || "closed");
      });
      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    assert.notEqual(response, "still-open");
    assert.match(response, /^HTTP\/1\.1 404 Not Found/);
    assert.equal(server.clients.size, 0);
    const deadline = Date.now() + 1_000;
    let connections = 1;
    while (connections > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      connections = await new Promise<number>((resolve, reject) =>
        server.http.getConnections((error, count) =>
          error ? reject(error) : resolve(count),
        ),
      );
    }
    assert.equal(socket.writableEnded, false, "probe must remain half-open");
    assert.equal(connections, 0, "rejected upgrade must release server socket");
  } finally {
    socket.destroy();
    await server.close();
  }
});

test("adversarial v31: slow clients are disconnected instead of silently missing match start", async () => {
  const { server, url } = await listeningServer();
  const host = new Peer(url);
  const guest = new Peer(url);
  try {
    const [hostWelcome] = await Promise.all([host.wait("welcome"), guest.wait("welcome")]);
    host.send({
      type: "create",
      name: "Slow Host",
      fighter: "zavarce",
      stage: "caracas",
      wins: 0,
      private: true,
    });
    const { room } = await host.wait("room");
    guest.send({
      type: "join",
      code: room.code,
      name: "Guest",
      fighter: "capriles",
      wins: 0,
    });
    await host.wait("room", (message) => message.room.players.length === 2);
    host.send({ type: "ready", ready: true });
    await guest.wait("room", (message) => message.room.players[0].ready);

    const slowServerClient = server.clients.get(hostWelcome.id)!;
    Object.defineProperty(slowServerClient.socket, "bufferedAmount", {
      configurable: true,
      get: () => 256_000,
    });
    const disconnected = new Promise<void>((resolve) =>
      host.socket.once("close", () => resolve()),
    );
    guest.send({ type: "ready", ready: true });
    await Promise.race([
      disconnected,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("slow peer was not disconnected")), 1_000),
      ),
    ]);
    assert.equal(server.clients.has(hostWelcome.id), false);
    assert.equal(server.rooms.get(room.code)?.view.status, "waiting");
    await guest.wait("opponent-left");
  } finally {
    host.socket.terminate();
    guest.socket.terminate();
    await server.close();
  }
});

test("adversarial v31: list flood is requester-only and rate limited", async () => {
  const { server, url } = await listeningServer();
  const peers = Array.from({ length: 64 }, () => new Peer(url));
  try {
    await Promise.all(peers.map((peer) => peer.wait("welcome")));
    const roomCount = 32;
    for (let i = 0; i < roomCount; i++) {
      peers[i].send({
        type: "create",
        name: `Fixture ${i}`,
        fighter: "zavarce",
        stage: "caracas",
        wins: 0,
        private: false,
      });
      await peers[i].wait("room");
    }
    assert.equal(server.rooms.size, roomCount);
    await new Promise((resolve) => setTimeout(resolve, 150));
    for (const peer of peers) peer.messages.length = 0;

    const requester = peers[roomCount];
    const probes = 180;
    const start = performance.now();
    for (let i = 0; i < probes; i++) requester.send({ type: "list" });
    const replies = 5;
    for (let i = 0; i < replies; i++) await requester.wait("rooms");
    const elapsedMs = performance.now() - start;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const otherPeerReplies = peers
      .filter((peer) => peer !== requester)
      .reduce(
        (sum, peer) =>
          sum + peer.messages.filter((message) => message.type === "rooms").length,
        0,
      );

    // The separate room-control budget accepts 30/s and responses stay local.
    assert.equal(probes, 180);
    assert.equal(replies, 5);
    assert.equal(peers.length, 64);
    assert.equal(server.clients.size, 64);
    assert.equal(otherPeerReplies, 0);
    const payloadBytes = Buffer.byteLength(
      JSON.stringify({
        type: "rooms",
        rooms: [...server.rooms.values()].map((room) => room.view),
        online: peers.length,
      }),
    );
    console.log(
      `bounded list flood: ${probes} requests, ${replies} accepted, ${roomCount} rooms, ${peers.length} connected peers; ${otherPeerReplies} peer broadcasts; ${payloadBytes} bytes/reply; ${(payloadBytes * replies).toLocaleString()} reply bytes; ${elapsedMs.toFixed(1)} ms for requester replies`,
    );
  } finally {
    peers.forEach((peer) => peer.socket.terminate());
    await server.close();
  }
});

test("adversarial v31: malformed frames and concurrent rooms stay isolated and responsive", async () => {
  const { server, url } = await listeningServer();
  const roomCount = 24;
  const peers = Array.from({ length: roomCount * 2 }, () => new Peer(url));
  const oversized = new Peer(url);
  try {
    await Promise.all([...peers, oversized].map((peer) => peer.wait("welcome")));
    const codes: string[] = [];
    const states: MatchState[] = [];
    for (let i = 0; i < roomCount; i++) {
      const host = peers[i * 2];
      const guest = peers[i * 2 + 1];
      host.send({
        type: "create",
        name: `Host ${i}`,
        fighter: "zavarce",
        stage: "caracas",
        wins: 0,
        private: true,
      });
      const { room } = await host.wait("room");
      codes.push(room.code);
      guest.send({
        type: "join",
        code: room.code,
        name: `Guest ${i}`,
        fighter: "capriles",
        wins: 0,
      });
      await host.wait("room", (message) => message.room.players.length === 2);
      host.send({ type: "ready", ready: true });
      guest.send({ type: "ready", ready: true });
      await Promise.all([host.wait("start"), guest.wait("start")]);
      const state = server.rooms.get(room.code)!.state!;
      state.phase = "playing";
      state.players.forEach((player) => (player.invincible = 0));
      states.push(state);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    peers.forEach((peer) => (peer.messages.length = 0));
    const first = states[0];
    peers[0].socket.send("{");
    await peers[0].wait("error", (message) => message.message.includes("leer"));
    peers[0].socket.send(
      JSON.stringify({
        type: "input",
        matchId: first.id,
        input: { right: true, actions: {} },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(first.players[0].x, 330);
    assert.equal(states[1].players[0].x, 330);

    const move = emptyInput();
    move.right = true;
    peers[0].send({ type: "input", matchId: first.id, input: move });
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.ok(first.players[0].x > 330);
    assert.equal(states[1].players[0].x, 330);

    const oversizedClose = new Promise<number>((resolve) =>
      oversized.socket.once("close", (code) => resolve(code)),
    );
    oversized.socket.send("x".repeat(5_000));
    const closeCode = await Promise.race([
      oversizedClose,
      new Promise<number>((resolve) => setTimeout(() => resolve(-1), 1_000)),
    ]);
    assert.equal(closeCode, 1009);
    const clientDeadline = Date.now() + 1_000;
    while (server.clients.size !== peers.length && Date.now() < clientDeadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(server.clients.size, peers.length);

    const healthStart = performance.now();
    const healthUrl = new URL(url);
    healthUrl.protocol = "http:";
    healthUrl.pathname = "/api/health";
    const response = await fetch(healthUrl);
    const healthLatencyMs = performance.now() - healthStart;
    assert.equal(response.status, 200);
    const health = (await response.json()) as {
      status: string;
      rooms: number;
      players: number;
    };
    assert.deepEqual(health, {
      status: "ok",
      rooms: roomCount,
      players: peers.length,
    });

    const before = states.map((state) => state.tick);
    const tickStart = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const tickElapsedMs = performance.now() - tickStart;
    const deltas = states.map((state, index) => state.tick - before[index]);
    const rates = deltas.map((delta) => (delta * 1_000) / tickElapsedMs);
    assert.ok(rates.every((rate) => rate >= 55 && rate <= 65), `tick rates: ${rates}`);
    assert.ok(Math.max(...deltas) - Math.min(...deltas) <= 1, `tick deltas: ${deltas}`);
    console.log(
      `24-room fixture: ${peers.length} connected game peers; ${deltas[0]} ticks over ${tickElapsedMs.toFixed(1)}ms (${rates[0].toFixed(1)}Hz normalized); health ${healthLatencyMs.toFixed(1)}ms; oversized frame closed ${closeCode}`,
    );
  } finally {
    peers.forEach((peer) => peer.socket.terminate());
    oversized.socket.terminate();
    await server.close();
  }
});

