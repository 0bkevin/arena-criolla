// Bounded deployment checks: two temporary guests, one private match, no accounts
// or paid providers. Pass the intended HTTP(S) origin explicitly.
import assert from "node:assert/strict";
import { WebSocket } from "ws";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5392");
assert.ok(["http:", "https:"].includes(origin.protocol));
assert.equal(origin.href, origin.origin + "/");
const base = origin.origin;
const socketUrl = base.replace(/^http/, "ws") + "/ws";
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
interface Report {
  origin: string;
  recordedAt: string;
  httpHeadersAndNonce?: boolean;
  workshopRemoved?: boolean;
  foreignBrowserOriginRejected?: boolean;
  unchangedLobbyIsNotRebroadcast?: boolean;
  sameOriginGuestsPlayAndReceiveIdenticalState?: boolean;
  healthy?: boolean;
}
const report: Report = { origin: base, recordedAt: new Date().toISOString() };

// Server messages are untrusted input: each wait narrows them by shape.
type ClientMessage = { type: string; [field: string]: unknown };
interface RoomMessage {
  type: "room";
  room: { code: string; players: { ready: boolean }[] };
}
interface RoomsMessage {
  type: "rooms";
  rooms: { code: string }[];
}
interface StartMessage {
  type: "start";
  state: { id: string };
}
interface StateMessage {
  type: "state";
  state: { phase: string; tick: number; players: { x: number }[] };
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isType = <T extends string>(
  value: unknown,
  type: T,
): value is { type: T } & Record<string, unknown> =>
  isRecord(value) && value.type === type;
const isRoom = (m: unknown): m is RoomMessage =>
  isType(m, "room") &&
  isRecord(m.room) &&
  typeof m.room.code === "string" &&
  isArray(m.room.players) &&
  m.room.players.every(
    (player) => isRecord(player) && typeof player.ready === "boolean",
  );
const isRooms = (m: unknown): m is RoomsMessage =>
  isType(m, "rooms") &&
  isArray(m.rooms) &&
  m.rooms.every((room) => isRecord(room) && typeof room.code === "string");
const isStart = (m: unknown): m is StartMessage =>
  isType(m, "start") && isRecord(m.state) && typeof m.state.id === "string";
const isState = (m: unknown): m is StateMessage =>
  isType(m, "state") &&
  isRecord(m.state) &&
  typeof m.state.phase === "string" &&
  typeof m.state.tick === "number" &&
  isArray(m.state.players) &&
  m.state.players.every(
    (player) => isRecord(player) && typeof player.x === "number",
  );

const first = await fetch(base);
assert.equal(first.status, 200);
assert.equal(first.headers.get("x-content-type-options"), "nosniff");
assert.equal(first.headers.get("x-frame-options"), "DENY");
assert.equal(first.headers.get("referrer-policy"), "no-referrer");
assert.equal(first.headers.get("cache-control"), "no-store");
if (origin.protocol === "https:")
  assert.match(
    first.headers.get("strict-transport-security") ?? "",
    /max-age=\d+/,
  );
const csp = first.headers.get("content-security-policy") ?? "";
const nonce = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
assert.ok(nonce);
assert.match(csp, /frame-ancestors 'none'/);
assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
const html = await first.text();
assert.ok(html.includes(`nonce="${nonce}"`));
const again = await fetch(base, {
  headers: { "If-None-Match": first.headers.get("etag") ?? "" },
});
assert.equal(again.status, 200);
assert.notEqual(again.headers.get("content-security-policy"), csp);
const script = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
assert.ok(script);
const asset = await fetch(base + script);
assert.equal(asset.status, 200);
assert.match(
  asset.headers.get("cache-control") ?? "",
  /max-age=31536000, immutable/,
);
const js = await asset.text();
for (const removed of [
  "CreatorStudio",
  "/api/creator",
  "/api/auth",
  "creator-mobile-entry",
])
  assert.ok(!js.includes(removed), removed);
for (const route of ["/api/creator/capabilities", "/api/auth/session"]) {
  const response = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
}
report.httpHeadersAndNonce = true;
report.workshopRemoved = true;

const rejected = await new Promise<number | undefined>((resolve, reject) => {
  const socket = new WebSocket(socketUrl, {
    origin: "https://arena-attacker.invalid",
    handshakeTimeout: 5000,
  });
  socket.on("error", reject);
  socket.once("open", () => {
    socket.terminate();
    reject(new Error("Cross-origin socket accepted"));
  });
  socket.once("unexpected-response", (_req, response) => {
    response.resume();
    socket.removeListener("error", reject);
    socket.on("error", () => {});
    socket.terminate();
    resolve(response.statusCode);
  });
});
assert.equal(rejected, 403);
report.foreignBrowserOriginRejected = true;

class Peer {
  messages: unknown[] = [];
  socket: WebSocket;
  error: Error | undefined;
  constructor() {
    this.socket = new WebSocket(socketUrl, {
      origin: base,
      handshakeTimeout: 5000,
    });
    this.socket.on("message", (raw) => {
      const message: unknown = JSON.parse(raw.toString());
      this.messages.push(message);
    });
    this.socket.on("error", (error) => {
      this.error = error;
    });
  }
  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }
  async wait<T>(predicate: (message: unknown) => message is T): Promise<T> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex(predicate);
      if (index >= 0) {
        const [message] = this.messages.splice(index, 1);
        if (predicate(message)) return message;
      }
      if (this.error) throw this.error;
      await sleep(10);
    }
    throw new Error("Guest multiplayer response timed out");
  }
}
const host = new Peer();
const guest = new Peer();
try {
  await Promise.all([
    host.wait((m) => isType(m, "welcome")),
    guest.wait((m) => isType(m, "welcome")),
  ]);
  await sleep(200);
  let previousLobby = JSON.stringify(
    guest.messages.filter((message) => isType(message, "rooms")).at(-1),
  );
  guest.messages.length = 0;
  host.send({
    type: "create",
    name: "Security QA A",
    fighter: "zavarce",
    stage: "caracas",
    private: true,
  });
  const { room } = await host.wait(isRoom);
  for (const ready of [true, false, true, false]) {
    host.send({ type: "ready", ready });
    await host.wait(
      (m): m is RoomMessage => isRoom(m) && m.room.players[0].ready === ready,
    );
    await sleep(140);
  }
  // Other visitors may connect during a production check. Their real lobby
  // changes are allowed; consecutive identical global snapshots are not.
  for (const message of guest.messages.filter((m) => isType(m, "rooms"))) {
    const encoded = JSON.stringify(message);
    assert.notEqual(encoded, previousLobby);
    previousLobby = encoded;
  }
  report.unchangedLobbyIsNotRebroadcast = true;
  guest.messages = guest.messages.filter(
    (message) => !isType(message, "rooms"),
  );
  guest.send({ type: "list" });
  const listing = await guest.wait(isRooms);
  assert.ok(!listing.rooms.some((r) => r.code === room.code));
  guest.send({
    type: "join",
    code: room.code,
    name: "Security QA B",
    fighter: "javier",
  });
  await guest.wait(
    (m): m is RoomMessage => isRoom(m) && m.room.players.length === 2,
  );
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const [a, b] = await Promise.all([host.wait(isStart), guest.wait(isStart)]);
  assert.equal(a.state.id, b.state.id);
  const playing = await host.wait(
    (m): m is StateMessage => isState(m) && m.state.phase === "playing",
  );
  const before = playing.state.players[0].x;
  const input = {
    left: false,
    right: true,
    block: false,
    down: false,
    actions: { jump: 0, light: 0, heavy: 0, special: 0, dash: 0, super: 0 },
  };
  host.send({ type: "input", matchId: a.state.id, input });
  await sleep(250);
  host.messages = host.messages.filter((m) => !isType(m, "state"));
  input.right = false;
  host.send({ type: "input", matchId: a.state.id, input });
  const moved = await host.wait(
    (m): m is StateMessage => isState(m) && m.state.players[0].x > before + 5,
  );
  const twin = await guest.wait(
    (m): m is StateMessage => isState(m) && m.state.tick === moved.state.tick,
  );
  assert.deepEqual(moved, twin);
  host.send({ type: "leave" });
  await guest.wait((m) => isType(m, "opponent-left"));
  report.sameOriginGuestsPlayAndReceiveIdenticalState = true;
} finally {
  host.socket.terminate();
  guest.socket.terminate();
}
const health: unknown = await fetch(base + "/api/health").then((response) =>
  response.json(),
);
assert.ok(isRecord(health));
assert.equal(health.status, "ok");
report.healthy = true;
console.log(JSON.stringify(report, null, 2));
