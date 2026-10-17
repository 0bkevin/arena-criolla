import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput } from "../shared/engine";
import type { ServerMessage } from "../shared/protocol";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
class Peer {
  socket: WebSocket;
  messages: ServerMessage[] = [];
  constructor(base: string, cookie = "") {
    this.socket = new WebSocket(base.replace("http", "ws") + "/ws", {
      headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    });
    this.socket.on("message", (data) =>
      this.messages.push(JSON.parse(data.toString())),
    );
  }
  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }
  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () =>
      true,
  ) {
    const end = performance.now() + 5000;
    while (performance.now() < end) {
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
      await pause(5);
    }
    throw new Error(`Timed out waiting for ${type}`);
  }
}
async function fixture(reconnectMs = 600) {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranked-online-"));
  const databasePath = join(dir, "arena.sqlite");
  const server = await makeArenaServer({
    serveClient: false,
    rankedReconnectMs: reconnectMs,
    creator: {
      dataDir: dir,
      databasePath,
      provider: null,
      secureCookies: false,
    },
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, cookie = "", options: RequestInit = {}) =>
    fetch(base + path, {
      ...options,
      headers: {
        Origin: base,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  const accounts = [];
  for (let index = 0; index < 2; index++) {
    const response = await request("/api/auth/signup", "", {
      method: "POST",
      body: JSON.stringify({
        name: `QA ranked ${index}`,
        email: `qa-ranked-${index}@example.test`,
        password: "test-only-password",
      }),
    });
    assert.equal(response.status, 201);
    accounts.push({
      user: (await response.json()).user,
      cookie: response.headers.get("set-cookie")!.split(";")[0],
    });
  }
  const peers: Peer[] = [];
  const peer = (cookie = "") => {
    const client = new Peer(base, cookie);
    peers.push(client);
    return client;
  };
  const host = peer(accounts[0].cookie),
    guest = peer(accounts[1].cookie);
  const [hostWelcome] = await Promise.all([
    host.wait("welcome"),
    guest.wait("welcome"),
  ]);
  async function begin() {
    host.send({
      type: "create",
      name: "client spoof",
      fighter: "zavarce",
      stage: "caracas",
      wins: 9999,
      private: true,
      ranked: true,
    });
    const { room } = await host.wait("room");
    guest.send({
      type: "join",
      code: room.code,
      name: "spoof guest",
      fighter: "capriles",
      wins: 9999,
    });
    await host.wait("room", (m) => m.room.players.length === 2);
    host.send({ type: "ready", ready: true });
    guest.send({ type: "ready", ready: true });
    const [a, b] = await Promise.all([host.wait("start"), guest.wait("start")]);
    return { room: server.rooms.get(room.code)!, a, b };
  }
  return {
    server,
    base,
    dir,
    databasePath,
    host,
    guest,
    accounts,
    request,
    peer,
    begin,
    hostWelcome,
    close: async () => {
      peers.forEach((p) => p.socket.terminate());
      await server.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("ranked rooms require distinct authenticated accounts and ignore browser names/wins", async () => {
  const f = await fixture();
  try {
    const anonymous = f.peer();
    await anonymous.wait("welcome");
    anonymous.send({
      type: "create",
      name: "QA guest",
      fighter: "zavarce",
      stage: "caracas",
      wins: 9999,
      ranked: true,
    });
    await anonymous.wait("error", (m) => m.message.includes("sesión"));
    f.host.send({
      type: "create",
      name: "spoof",
      fighter: "zavarce",
      stage: "caracas",
      wins: 9999,
      ranked: true,
    });
    const { room } = await f.host.wait("room");
    assert.equal(room.players[0].name, f.accounts[0].user.name);
    assert.equal(room.players[0].wins, 0);
    anonymous.send({
      type: "join",
      code: room.code,
      name: "guest",
      fighter: "zavarce",
      wins: 0,
    });
    await anonymous.wait("error", (m) => m.message.includes("sesión"));
    const sameAccount = f.peer(f.accounts[0].cookie);
    await sameAccount.wait("welcome");
    sameAccount.send({
      type: "join",
      code: room.code,
      fighter: "zavarce",
      wins: 0,
    });
    await sameAccount.wait("error", (m) => m.message.includes("cuenta"));
    f.guest.send({
      type: "join",
      code: room.code,
      name: "spoof",
      fighter: "capriles",
      wins: 9999,
    });
    await f.host.wait("room", (m) => m.room.players.length === 2);
    f.host.send({ type: "ready", ready: true });
    f.guest.send({ type: "ready", ready: true });
    const [a, b] = await Promise.all([
      f.host.wait("start"),
      f.guest.wait("start"),
    ]);
    assert.equal(a.state.id, b.state.id);
    assert.equal(a.ranked, true);
    assert.deepEqual(
      a.state.players.map((p) => p.config.wins),
      [3, 3],
    );
    const active = f.server.rooms.get(room.code)!;
    active.state!.phase = "playing";
    active.state!.players[1].stocks = 1;
    active.state!.players[1].hp = 0;
    await f.host.wait("state", (m) => m.state.phase === "finished");
    const [savedA, savedB] = await Promise.all([
      f.host.wait("ranked-result", (m) => m.result.status === "saved"),
      f.guest.wait("ranked-result", (m) => m.result.status === "saved"),
    ]);
    assert.equal(savedA.result.outcome, "win");
    assert.equal(savedB.result.outcome, "loss");
    assert.equal(savedA.result.pointsEarned, 3);
    assert.equal(savedB.result.pointsEarned, 0);
    const board = await (await f.request("/api/ranking")).json();
    assert.equal(board.entries[0].userId, f.accounts[0].user.id);
    assert.equal(board.entries[0].wins, 1);
    assert.equal(board.entries[0].points, 3);
    assert.equal(board.entries[1].points, 0);
    assert.equal(board.entries[1].losses, 1);
    assert.equal(JSON.stringify(board).includes("email"), false);
    const profile = await (
      await f.request("/api/ranking/me", f.accounts[0].cookie)
    ).json();
    assert.equal(profile.history[0].matchId, a.state.id);
    assert.equal(profile.entry.points, 3);
    assert.equal(profile.history[0].pointsEarned, 3);
    assert.equal((await f.request("/api/ranking/me")).status, 401);
    assert.equal(
      (
        await f.request("/api/ranking", f.accounts[0].cookie, {
          method: "POST",
          body: JSON.stringify({ wins: 9999 }),
        })
      ).status,
      404,
    );
    f.host.send({ type: "rematch" });
    f.guest.send({ type: "rematch" });
    const next = await f.host.wait("start");
    assert.notEqual(next.state.id, a.state.id);
    assert.equal(
      (await (await f.request("/api/ranking/me", f.accounts[0].cookie)).json())
        .entry.played,
      1,
    );
  } finally {
    await f.close();
  }
});

test("ranked disconnect freezes the match, authenticates resume and keeps new action counters usable", async () => {
  const f = await fixture(1500);
  try {
    const { room, a } = await f.begin();
    room.state!.phase = "playing";
    const held = emptyInput();
    held.actions.light = 17;
    held.right = true;
    f.host.send({ type: "input", matchId: a.state.id, input: held });
    await pause(30);
    f.host.socket.terminate();
    await f.guest.wait("room", (m) => Boolean(m.room.reconnectUntil));
    const tick = room.state!.tick;
    await pause(80);
    assert.equal(room.state!.tick, tick);
    const stranger = f.peer();
    await stranger.wait("welcome");
    stranger.send({ type: "resume", matchId: a.state.id });
    await stranger.wait("resume-unavailable");
    const resumed = f.peer(f.accounts[0].cookie);
    const welcome = await resumed.wait("welcome");
    resumed.send({ type: "resume", matchId: a.state.id });
    const restored = await resumed.wait("start");
    assert.equal(restored.state.id, a.state.id);
    assert.equal(restored.index, 0);
    assert.equal(restored.state.players[0].lastActions.light, 0);
    const fresh = emptyInput();
    fresh.actions.jump = 1;
    resumed.send({ type: "input", matchId: restored.state.id, input: fresh });
    await pause(40);
    assert.equal(f.server.clients.get(welcome.id)!.input.actions.jump, 1);
    assert.ok(room.state!.tick > tick);
    assert.equal(room.view.reconnectUntil, undefined);
    assert.equal(
      (await (await f.request("/api/ranking")).json()).entries.length,
      0,
    );
    resumed.send({ type: "leave" });
    await resumed.wait("left");
    const forfeit = await f.guest.wait(
      "ranked-result",
      (m) => m.result.status === "saved",
    );
    assert.equal(forfeit.result.reason, "forfeit");
    assert.equal(forfeit.result.outcome, "win");
    f.guest.send({ type: "leave" });
    await f.guest.wait("left");
    assert.equal(f.server.rooms.size, 0);
  } finally {
    await f.close();
  }
});

test("ranked grace expiry records a loss once while both absent players void the match", async () => {
  const f = await fixture(250);
  try {
    const { a } = await f.begin();
    f.host.socket.terminate();
    const saved = await f.guest.wait(
      "ranked-result",
      (m) => m.result.matchId === a.state.id && m.result.status === "saved",
    );
    assert.equal(saved.result.reason, "forfeit");
    assert.equal(saved.result.outcome, "win");
    const loser = await (
      await f.request("/api/ranking/me", f.accounts[0].cookie)
    ).json();
    assert.equal(loser.entry.losses, 1);
    f.guest.send({ type: "leave" });
    await f.guest.wait("left");
    const host = f.peer(f.accounts[0].cookie);
    await host.wait("welcome");
    host.send({
      type: "create",
      fighter: "zavarce",
      stage: "caracas",
      ranked: true,
    });
    const { room } = await host.wait("room");
    f.guest.send({ type: "join", code: room.code, fighter: "capriles" });
    await host.wait("room", (m) => m.room.players.length === 2);
    host.send({ type: "ready", ready: true });
    f.guest.send({ type: "ready", ready: true });
    const next = await host.wait("start");
    await f.guest.wait("start");
    host.socket.terminate();
    f.guest.socket.terminate();
    await pause(400);
    const profile = await (
      await f.request("/api/ranking/me", f.accounts[0].cookie)
    ).json();
    assert.equal(profile.entry.played, 1);
    assert.equal(
      profile.history.find(
        (m: { matchId: string }) => m.matchId === next.state.id,
      )?.outcome,
      "void",
    );
    assert.equal(f.server.rooms.size, 0);
  } finally {
    await f.close();
  }
});

test("ranking writes retry through a database lock without delaying health or losing the final result", async () => {
  const f = await fixture();
  let lock: DatabaseSync | undefined;
  try {
    const { room } = await f.begin();
    const casualA = f.peer(),
      casualB = f.peer();
    await Promise.all([casualA.wait("welcome"), casualB.wait("welcome")]);
    casualA.send({
      type: "create",
      name: "QA latency",
      fighter: "zavarce",
      stage: "caracas",
      private: true,
    });
    const casual = await casualA.wait("room");
    casualB.send({
      type: "join",
      code: casual.room.code,
      name: "QA latency B",
      fighter: "capriles",
    });
    await casualA.wait("room", (m) => m.room.players.length === 2);
    casualA.send({ type: "ready", ready: true });
    casualB.send({ type: "ready", ready: true });
    await casualA.wait("start");
    const ongoing = f.server.rooms.get(casual.room.code)!;
    lock = new DatabaseSync(f.databasePath);
    lock.exec("BEGIN IMMEDIATE");
    room.state!.phase = "playing";
    room.state!.players[1].stocks = 1;
    room.state!.players[1].hp = 0;
    await f.host.wait("state", (m) => m.state.phase === "finished");
    const before = performance.now();
    const health = await f.request("/api/health");
    assert.equal(health.status, 200);
    const healthMs = performance.now() - before;
    assert.ok(healthMs < 300);
    const tick = ongoing.state!.tick,
      measuredAt = performance.now();
    await pause(600);
    const advanced = ongoing.state!.tick - tick;
    assert.ok(
      advanced >= 12,
      "another room must continue simulating while SQLite waits",
    );
    console.info(
      `ranking SQLite lock: health=${healthMs.toFixed(2)}ms, other room=${((advanced * 1000) / (performance.now() - measuredAt)).toFixed(2)}Hz`,
    );
    lock.exec("ROLLBACK");
    await f.host.wait("ranked-result", (m) => m.result.status === "saved");
    assert.equal(
      (await (await f.request("/api/ranking/me", f.accounts[0].cookie)).json())
        .entry.wins,
      1,
    );
  } finally {
    lock?.close();
    await f.close();
  }
});

test("authenticated websocket handshakes reject foreign origins and logout invalidates the game connection", async () => {
  const f = await fixture();
  try {
    const rejected = new WebSocket(f.base.replace("http", "ws") + "/ws", {
      headers: {
        Cookie: f.accounts[0].cookie,
        Origin: "https://foreign.example",
      },
    });
    const error = await new Promise<Error>((resolve) =>
      rejected.once("error", resolve),
    );
    assert.match(error.message, /403/);
    const closed = new Promise((resolve) =>
      f.host.socket.once("close", resolve),
    );
    assert.equal(
      (
        await f.request("/api/auth/signout", f.accounts[0].cookie, {
          method: "POST",
        })
      ).status,
      200,
    );
    await closed;
    assert.equal(
      (await f.request("/api/ranking/me", f.accounts[0].cookie)).status,
      401,
    );
  } finally {
    await f.close();
  }
});

test("resume replaces an old live transport without a false forfeit, and authenticated recovery can explicitly abandon", async () => {
  const f = await fixture(1000);
  try {
    const { a, room } = await f.begin();
    const fresh = f.peer(f.accounts[0].cookie);
    await fresh.wait("welcome");
    fresh.send({ type: "resume", matchId: a.state.id });
    await f.host.wait("session-replaced");
    assert.equal((await fresh.wait("start")).state.id, a.state.id);
    await pause(80);
    assert.equal(room.view.status, "playing");
    assert.equal(room.view.reconnectUntil, undefined);
    fresh.socket.terminate();
    await f.guest.wait("room", (m) => Boolean(m.room.reconnectUntil));
    const recovery = f.peer(f.accounts[0].cookie);
    await recovery.wait("welcome");
    recovery.send({ type: "abandon", matchId: a.state.id });
    await recovery.wait("abandon-accepted");
    const result = await f.guest.wait(
      "ranked-result",
      (m) => m.result.status === "saved",
    );
    assert.equal(result.result.outcome, "win");
    assert.equal(
      (await (await f.request("/api/ranking/me", f.accounts[0].cookie)).json())
        .entry.losses,
      1,
    );
  } finally {
    await f.close();
  }
});

test("repeated disconnects share a finite recovery budget instead of freezing an opponent indefinitely", async () => {
  const f = await fixture(2000);
  const wallClock = Date.now;
  try {
    const { a } = await f.begin();
    f.host.socket.terminate();
    await f.guest.wait("room", (m) => Boolean(m.room.reconnectUntil));
    await pause(1000);
    Date.now = () => wallClock() - 60_000;
    const resumed = f.peer(f.accounts[0].cookie);
    const welcome = await resumed.wait("welcome");
    resumed.send({ type: "resume", matchId: a.state.id });
    await resumed.wait("start");
    Date.now = wallClock;
    resumed.socket.terminate();
    const second = await f.guest.wait(
      "room",
      (m) =>
        m.room.players[0].id === welcome.id && Boolean(m.room.reconnectUntil),
    );
    assert.ok(
      second.room.reconnectUntil! - Date.now() < 1500,
      "the first interruption must consume part of the same per-match budget",
    );
    const result = await f.guest.wait(
      "ranked-result",
      (m) => m.result.status === "saved",
    );
    assert.equal(result.result.reason, "forfeit");
  } finally {
    Date.now = wallClock;
    await f.close();
  }
});
