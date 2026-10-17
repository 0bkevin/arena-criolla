/** Run: npx tsx scripts/qa-network-benchmark.ts [output.json]
 * Uses only loopback connections and in-memory databases; no public service.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, connect, type Socket } from "node:net";
import { dirname, resolve } from "node:path";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput } from "../shared/engine";
import type { ClientMessage, ServerMessage } from "../shared/protocol";

type Arena = Awaited<ReturnType<typeof makeArenaServer>>;
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

class Peer {
  readonly socket: WebSocket;
  private messages: ServerMessage[] = [];
  private failure: Error | null = null;
  onStateBytes?: (bytes: number) => void;

  constructor(
    url: string,
    private retainStates = true,
  ) {
    this.socket = new WebSocket(url);
    this.socket.on("error", (error) => (this.failure = error));
    this.socket.on("message", (raw) => {
      const encoded = raw.toString();
      const message = JSON.parse(encoded) as ServerMessage;
      if (message.type === "state") {
        this.onStateBytes?.(Buffer.byteLength(encoded));
        if (!this.retainStates) return;
      }
      this.messages.push(message);
    });
  }

  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }

  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () =>
      true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = performance.now() + 5_000;
    while (performance.now() < deadline) {
      if (this.failure) throw this.failure;
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
      await pause(2);
    }
    throw new Error(`Timed out waiting for ${type}`);
  }
}

async function listen(arena: Arena) {
  await new Promise<void>((done, reject) => {
    arena.http.once("error", reject);
    arena.http.listen(0, "127.0.0.1", () => {
      arena.http.off("error", reject);
      done();
    });
  });
  const address = arena.http.address();
  assert.ok(address && typeof address === "object");
  return address.port;
}

async function delayedProxy(targetPort: number, delayMs: number) {
  const sockets = new Set<Socket>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const proxy = createServer((downstream) => {
    const upstream = connect({ host: "127.0.0.1", port: targetPort });
    for (const socket of [upstream, downstream]) {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.once("close", () => sockets.delete(socket));
    }
    const forward = (target: Socket, chunk: Buffer) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!target.destroyed) target.write(chunk);
      }, delayMs);
      timers.add(timer);
    };
    downstream.on("data", (chunk) => forward(upstream, chunk));
    upstream.on("data", (chunk) => forward(downstream, chunk));
    downstream.once("close", () => upstream.destroy());
    upstream.once("close", () => downstream.destroy());
  });
  await new Promise<void>((done, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", () => {
      proxy.off("error", reject);
      done();
    });
  });
  const address = proxy.address();
  assert.ok(address && typeof address === "object");
  return {
    port: address.port,
    close: async () => {
      timers.forEach(clearTimeout);
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((done) => proxy.close(() => done()));
    },
  };
}

async function duel(arena: Arena, host: Peer, guest: Peer) {
  await Promise.all([host.wait("welcome"), guest.wait("welcome")]);
  host.send({
    type: "create",
    name: "QA local benchmark",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: true,
  });
  const { room } = await host.wait("room");
  guest.send({
    type: "join",
    code: room.code,
    name: "QA local guest",
    fighter: "capriles",
    wins: 0,
  });
  await host.wait("room", (message) => message.room.players.length === 2);
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const [start, other] = await Promise.all([
    host.wait("start"),
    guest.wait("start"),
  ]);
  assert.equal(start.state.id, other.state.id);
  const state = arena.rooms.get(room.code)!.state!;
  // Start at combat for a short, deterministic synthetic measurement.
  state.phase = "playing";
  state.remaining = 60 * 60;
  state.players.forEach((player) => (player.invincible = 0));
  return state;
}

async function latencyBenchmark() {
  const arena = await makeArenaServer({ serveClient: false });
  const peers: Peer[] = [];
  let proxy: Awaited<ReturnType<typeof delayedProxy>> | undefined;
  try {
    const port = await listen(arena);
    const oneWayDelayMs = 100;
    proxy = await delayedProxy(port, oneWayDelayMs);
    const host = new Peer(`ws://127.0.0.1:${proxy.port}/ws`);
    const guest = new Peer(`ws://127.0.0.1:${port}/ws`);
    peers.push(host, guest);
    const state = await duel(arena, host, guest);
    const input = emptyInput();
    const actionEchoSamplesMs: number[] = [];
    for (let sequence = 1; sequence <= 12; sequence++) {
      input.actions.light = sequence;
      const began = performance.now();
      host.send({ type: "input", matchId: state.id, input });
      await host.wait(
        "state",
        (message) => message.state.players[0].lastActions.light === sequence,
      );
      actionEchoSamplesMs.push(performance.now() - began);
    }
    return {
      oneWayDelayMs,
      nominalNetworkRttMs: oneWayDelayMs * 2,
      actionEchoSamplesMs,
      minMs: Math.min(...actionEchoSamplesMs),
      maxMs: Math.max(...actionEchoSamplesMs),
      meanMs:
        actionEchoSamplesMs.reduce((sum, sample) => sum + sample, 0) /
        actionEchoSamplesMs.length,
      measures:
        "Input send to authoritative state receipt; excludes canvas rendering and perception.",
    };
  } finally {
    peers.forEach((peer) => peer.socket.terminate());
    await proxy?.close();
    await arena.close();
  }
}

async function loadBenchmark() {
  const arena = await makeArenaServer({ serveClient: false });
  const peers: Peer[] = [];
  try {
    const port = await listen(arena);
    const roomCount = 100;
    for (let index = 0; index < roomCount; index++) {
      const host = new Peer(`ws://127.0.0.1:${port}/ws`, false);
      const guest = new Peer(`ws://127.0.0.1:${port}/ws`, false);
      peers.push(host, guest);
      await duel(arena, host, guest);
    }
    const states = [...arena.rooms.values()].map((room) => room.state!);
    const baseline = states.map((state) => state.tick);
    let stateFrames = 0,
      stateBytes = 0;
    peers.forEach((peer) => {
      peer.onStateBytes = (bytes) => {
        stateFrames++;
        stateBytes += bytes;
      };
    });
    const began = performance.now();
    const healthSamplesMs: number[] = [];
    for (let sample = 0; sample < 6; sample++) {
      const requestAt = performance.now();
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(response.status, 200);
      await response.json();
      healthSamplesMs.push(performance.now() - requestAt);
      await pause(500);
    }
    const sampleMs = performance.now() - began;
    const tickRates = states.map(
      (state, index) => ((state.tick - baseline[index]) * 1000) / sampleMs,
    );
    assert.equal(arena.rooms.size, roomCount);
    assert.equal(arena.clients.size, peers.length);
    return {
      rooms: arena.rooms.size,
      players: arena.clients.size,
      sampleMs,
      minTickHz: Math.min(...tickRates),
      maxTickHz: Math.max(...tickRates),
      healthSamplesMs,
      stateFrames,
      stateBytes,
      stateBytesPerSecond: (stateBytes * 1000) / sampleMs,
      fixture:
        "Stationary fighters, direct loopback sockets; not a WAN or worst-case effects benchmark.",
    };
  } finally {
    peers.forEach((peer) => peer.socket.terminate());
    await arena.close();
  }
}

const result = {
  createdAt: new Date().toISOString(),
  nodeVersion: process.version,
  environment: "Local synthetic tests; no external traffic or deployment.",
  latency: await latencyBenchmark(),
  load: await loadBenchmark(),
};
const output = resolve(process.argv[2] ?? "/tmp/arena-network-benchmark.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ output, ...result }, null, 2));
