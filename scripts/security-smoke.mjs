// Bounded deployment checks: two temporary guests, one private match, no accounts
// or paid providers. Pass the intended HTTP(S) origin explicitly.
import assert from "node:assert/strict";
import { WebSocket } from "ws";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5392");
assert.ok(["http:", "https:"].includes(origin.protocol));
assert.equal(origin.href, origin.origin + "/");
const base = origin.origin;
const socketUrl = base.replace(/^http/, "ws") + "/ws";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { origin: base, recordedAt: new Date().toISOString() };

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
const old = await fetch(base + "/create/saved", { redirect: "manual" });
assert.equal(old.status, 302);
assert.equal(old.headers.get("location"), "/");
report.httpHeadersAndNonce = true;
report.workshopRemainsDisabled = true;

const rejected = await new Promise((resolve, reject) => {
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
  messages = [];
  constructor() {
    this.socket = new WebSocket(socketUrl, {
      origin: base,
      handshakeTimeout: 5000,
    });
    this.socket.on("message", (raw) =>
      this.messages.push(JSON.parse(raw.toString())),
    );
    this.socket.on("error", (error) => {
      this.error = error;
    });
  }
  send(message) {
    this.socket.send(JSON.stringify(message));
  }
  async wait(predicate) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex(predicate);
      if (index >= 0) return this.messages.splice(index, 1)[0];
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
    host.wait((m) => m.type === "welcome"),
    guest.wait((m) => m.type === "welcome"),
  ]);
  await sleep(200);
  let previousLobby = JSON.stringify(
    guest.messages.filter((message) => message.type === "rooms").at(-1),
  );
  guest.messages.length = 0;
  host.send({
    type: "create",
    name: "Security QA A",
    fighter: "zavarce",
    stage: "caracas",
    private: true,
  });
  const { room } = await host.wait((m) => m.type === "room");
  for (const ready of [true, false, true, false]) {
    host.send({ type: "ready", ready });
    await host.wait(
      (m) => m.type === "room" && m.room.players[0].ready === ready,
    );
    await sleep(140);
  }
  // Other visitors may connect during a production check. Their real lobby
  // changes are allowed; consecutive identical global snapshots are not.
  for (const message of guest.messages.filter((m) => m.type === "rooms")) {
    const encoded = JSON.stringify(message);
    assert.notEqual(encoded, previousLobby);
    previousLobby = encoded;
  }
  report.unchangedLobbyIsNotRebroadcast = true;
  guest.messages = guest.messages.filter((message) => message.type !== "rooms");
  guest.send({ type: "list" });
  const listing = await guest.wait((m) => m.type === "rooms");
  assert.ok(!listing.rooms.some((r) => r.code === room.code));
  guest.send({
    type: "join",
    code: room.code,
    name: "Security QA B",
    fighter: "javier",
  });
  await guest.wait((m) => m.type === "room" && m.room.players.length === 2);
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const [a, b] = await Promise.all([
    host.wait((m) => m.type === "start"),
    guest.wait((m) => m.type === "start"),
  ]);
  assert.equal(a.state.id, b.state.id);
  const playing = await host.wait(
    (m) => m.type === "state" && m.state.phase === "playing",
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
  host.messages = host.messages.filter((m) => m.type !== "state");
  input.right = false;
  host.send({ type: "input", matchId: a.state.id, input });
  const moved = await host.wait(
    (m) => m.type === "state" && m.state.players[0].x > before + 5,
  );
  const twin = await guest.wait(
    (m) => m.type === "state" && m.state.tick === moved.state.tick,
  );
  assert.deepEqual(moved, twin);
  host.send({ type: "leave" });
  await guest.wait((m) => m.type === "opponent-left");
  report.sameOriginGuestsPlayAndReceiveIdenticalState = true;
} finally {
  host.socket.terminate();
  guest.socket.terminate();
}
const health = await fetch(base + "/api/health").then((response) =>
  response.json(),
);
assert.equal(health.status, "ok");
report.healthy = true;
console.log(JSON.stringify(report, null, 2));
