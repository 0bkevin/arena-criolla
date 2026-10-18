import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import type { ServerMessage } from "../shared/protocol";
import {
  ARENA_SOCKET_PROTOCOL,
  ROOM_RESUME_PROTOCOL_PREFIX,
} from "../shared/protocol";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Peer {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  constructor(url: string, token?: string | false) {
    this.socket = new WebSocket(
      url,
      token === false
        ? []
        : [
            ARENA_SOCKET_PROTOCOL,
            ...(token ? [ROOM_RESUME_PROTOCOL_PREFIX + token] : []),
          ],
    );
    this.socket.on("error", () => {});
    this.socket.on("message", (raw) =>
      this.messages.push(JSON.parse(raw.toString())),
    );
  }
  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }
  async wait<T extends ServerMessage["type"]>(type: T) {
    for (let i = 0; i < 150; i++) {
      const index = this.messages.findIndex((message) => message.type === type);
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<
          ServerMessage,
          { type: T }
        >;
      await pause(5);
    }
    throw new Error(`Missing ${type}`);
  }
}

async function fixture(t: TestContext, grace = 1000) {
  const server = await makeArenaServer({
    serveClient: false,
    roomReconnectGraceMs: grace,
  });
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const host = new Peer(url);
  const welcome = await host.wait("welcome");
  assert.ok(welcome.resumeToken);
  host.send({
    type: "create",
    name: "Host",
    fighter: "capriles",
    stage: "guaira",
    wins: 2,
    private: true,
  });
  const { room } = await host.wait("room");
  return { server, url, host, welcome, room, token: welcome.resumeToken };
}

async function disconnected(
  server: Awaited<ReturnType<typeof makeArenaServer>>,
  id: string,
) {
  for (let i = 0; i < 100 && server.clients.has(id); i++) await pause(5);
  assert.equal(server.clients.has(id), false);
}

test("the host resumes the same private room, identity and selected settings", async (t) => {
  const f = await fixture(t);
  f.host.socket.terminate();
  await disconnected(f.server, f.welcome.id);
  const host = new Peer(f.url, f.token);
  const welcome = await host.wait("welcome");
  const { room } = await host.wait("room");
  assert.equal(welcome.resumed, true);
  assert.equal(welcome.id, f.welcome.id);
  assert.equal(room.code, f.room.code);
  assert.equal(room.host, welcome.id);
  assert.equal(room.stage, "guaira");
  assert.equal(room.players[0].fighter, "capriles");
  assert.equal(room.players[0].wins, 2);
  assert.equal(room.players[0].connected, true);
  assert.equal(
    JSON.stringify(room).includes(f.token),
    false,
    "room data must never expose the recovery credential",
  );
  assert.equal(f.server.rooms.get(room.code)?.private, true);
});

test("returning before an old socket closes does not delete or duplicate the player", async (t) => {
  const f = await fixture(t);
  const replacement = new Peer(f.url, f.token);
  const welcome = await replacement.wait("welcome");
  await replacement.wait("room");
  await pause(30);
  assert.equal(welcome.resumed, true);
  assert.equal(f.server.rooms.get(f.room.code)?.clients.length, 1);
  assert.equal(
    f.server.clients.get(welcome.id)?.socket.readyState,
    WebSocket.OPEN,
  );
  assert.equal(f.host.socket.readyState, WebSocket.CLOSED);
});

test("an invited player recovers their own slot and cannot start while the host is away", async (t) => {
  const f = await fixture(t);
  const guest = new Peer(f.url);
  const guestWelcome = await guest.wait("welcome");
  assert.ok(guestWelcome.resumeToken);
  guest.send({
    type: "join",
    code: f.room.code,
    name: "Guest",
    fighter: "zavarce",
    wins: 0,
  });
  await guest.wait("room");
  f.host.socket.terminate();
  await disconnected(f.server, f.welcome.id);
  guest.send({ type: "ready", ready: true });
  await pause(20);
  assert.equal(f.server.rooms.get(f.room.code)?.view.status, "waiting");
  guest.socket.terminate();
  await disconnected(f.server, guestWelcome.id);
  const returningGuest = new Peer(f.url, guestWelcome.resumeToken);
  assert.equal((await returningGuest.wait("welcome")).id, guestWelcome.id);
  const room = (await returningGuest.wait("room")).room;
  assert.equal(room.players[1].id, guestWelcome.id);
  const returningHost = new Peer(f.url, f.token);
  await returningHost.wait("welcome");
  await returningHost.wait("room");
  returningHost.send({ type: "ready", ready: true });
  returningGuest.send({ type: "ready", ready: true });
  assert.equal((await returningHost.wait("start")).index, 0);
  assert.equal((await returningGuest.wait("start")).index, 1);
});

test("knowing the invitation code cannot claim the host identity", async (t) => {
  const f = await fixture(t);
  f.host.socket.terminate();
  await disconnected(f.server, f.welcome.id);
  const stranger = new Peer(f.url, f.room.code);
  const welcome = await stranger.wait("welcome");
  assert.equal(welcome.resumed, false);
  assert.notEqual(welcome.id, f.welcome.id);
  assert.equal(f.server.rooms.get(f.room.code)?.view.host, f.welcome.id);
});

test("an explicit leave revokes recovery and closes an empty room immediately", async (t) => {
  const f = await fixture(t);
  f.host.send({ type: "leave" });
  await f.host.wait("left");
  assert.equal(f.server.rooms.has(f.room.code), false);
  const fresh = new Peer(f.url, f.token);
  assert.equal((await fresh.wait("welcome")).resumed, false);
});

test("an abandoned waiting room and its recovery token expire", async (t) => {
  const f = await fixture(t, 30);
  f.host.socket.terminate();
  await disconnected(f.server, f.welcome.id);
  await pause(70);
  assert.equal(f.server.rooms.has(f.room.code), false);
  const fresh = new Peer(f.url, f.token);
  assert.equal((await fresh.wait("welcome")).resumed, false);
});

test("legacy clients still release their rooms on disconnect", async (t) => {
  const f = await fixture(t);
  const legacy = new Peer(f.url, false);
  const welcome = await legacy.wait("welcome");
  legacy.send({
    type: "create",
    name: "Legacy",
    fighter: "zavarce",
    stage: "caracas",
    private: true,
  });
  const { room } = await legacy.wait("room");
  legacy.socket.terminate();
  await disconnected(f.server, welcome.id);
  assert.equal(f.server.rooms.has(room.code), false);
});

test("a mobile host can share an invitation without losing the waiting room", async (t) => {
  const server = await makeArenaServer({ serveClient: false });
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const host = new Peer(url);
  const welcome = await host.wait("welcome");
  host.send({
    type: "create",
    name: "Mobile host",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: true,
  });
  const { room } = await host.wait("room");
  host.socket.terminate();
  for (let i = 0; i < 100 && server.clients.has(welcome.id); i++)
    await pause(5);
  assert.equal(
    server.rooms.has(room.code),
    true,
    "the invitation must still work after the mobile browser drops its socket",
  );
  const guest = new Peer(url);
  await guest.wait("welcome");
  guest.send({
    type: "join",
    code: room.code,
    name: "Guest",
    fighter: "zavarce",
    wins: 0,
  });
  assert.equal((await guest.wait("room")).room.host, welcome.id);
});
