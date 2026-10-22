import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { VictoryScreen } from "../src/components/VictoryScreen";
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
  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () =>
      true,
  ) {
    for (let i = 0; i < 150; i++) {
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
    throw new Error(`Missing ${type}`);
  }
}

async function fixture(
  t: TestContext,
  grace = 1000,
  hostIdentity: { name?: string } = { name: "Host" },
) {
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
    ...hostIdentity,
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

for (const departure of ["leave", "expiry", "playing-disconnect"] as const) {
  test(`automatic player labels follow room slots after host ${departure}`, async (t) => {
    const f = await fixture(t, 150, {});
    const guest = new Peer(f.url);
    const guestWelcome = await guest.wait("welcome");
    guest.send({
      type: "join",
      code: f.room.code,
      fighter: "capriles",
      wins: 2,
    });
    await guest.wait("room", (message) => message.room.players.length === 2);
    if (departure === "playing-disconnect") {
      f.host.send({ type: "ready", ready: true });
      guest.send({ type: "ready", ready: true });
      await Promise.all([f.host.wait("start"), guest.wait("start")]);
    }
    if (departure === "leave") {
      f.host.send({ type: "leave" });
      await f.host.wait("left");
    } else {
      f.host.socket.terminate();
      if (departure === "expiry") {
        const reserved = await guest.wait("room", (message) =>
          message.room.players.some((player) => player.connected === false),
        );
        assert.deepEqual(
          reserved.room.players.map((player) => player.name),
          ["Jugador 1", "Jugador 2"],
        );
      }
    }
    const { room: promoted } = await guest.wait(
      "room",
      (message) => message.room.host === guestWelcome.id,
    );
    assert.equal(promoted.name, f.room.name);
    assert.equal(promoted.players[0].id, guestWelcome.id);
    assert.equal(promoted.players[0].name, "Jugador 1");
    assert.equal(promoted.players[0].wins, 2);

    const newcomer = new Peer(f.url);
    await newcomer.wait("welcome");
    newcomer.send({
      type: "join",
      code: f.room.code,
      fighter: "capriles",
      wins: 0,
    });
    const { room: joined } = await newcomer.wait("room");
    assert.deepEqual(
      joined.players.map((player) => player.name),
      ["Jugador 1", "Jugador 2"],
    );
    guest.send({ type: "ready", ready: true });
    newcomer.send({ type: "ready", ready: true });
    const [first, second] = await Promise.all([
      guest.wait("start"),
      newcomer.wait("start"),
    ]);
    assert.equal(first.index, 0);
    assert.equal(second.index, 1);
    assert.deepEqual(first.state, second.state);
    assert.deepEqual(
      first.state.players.map((player) => player.config.name),
      ["Jugador 1", "Jugador 2"],
    );

    // Replacing the promoted player's socket must preserve their new slot.
    const returning = new Peer(f.url, guestWelcome.resumeToken);
    assert.equal((await returning.wait("welcome")).resumed, true);
    const resumed = await returning.wait("start");
    assert.equal(resumed.index, 0);
    assert.deepEqual(
      resumed.state.players.map((player) => player.config.name),
      ["Jugador 1", "Jugador 2"],
    );
  });
}

test("host promotion preserves an explicit legacy nickname that resembles an automatic label", async (t) => {
  const f = await fixture(t);
  const guest = new Peer(f.url);
  const welcome = await guest.wait("welcome");
  guest.send({
    type: "join",
    code: f.room.code,
    name: "Jugador 2",
    fighter: "zavarce",
    wins: 0,
  });
  await guest.wait("room");
  f.host.send({ type: "leave" });
  const { room } = await guest.wait(
    "room",
    (message) => message.room.host === welcome.id,
  );
  assert.equal(room.players[0].name, "Jugador 2");
});

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

for (const winner of [0, 1] as const) {
  for (const wins of [0, 1, 2]) {
    test(`P${winner + 1} preserves finished-match progression after win ${wins + 1} on reconnect and rematch`, async (t) => {
      const f = await fixture(t);
      if (f.room.players[0].wins !== wins) {
        f.host.send({ type: "select", fighter: "capriles", wins });
        await f.host.wait(
          "room",
          (message) => message.room.players[0].wins === wins,
        );
      }
      const guest = new Peer(f.url);
      const guestWelcome = await guest.wait("welcome");
      assert.ok(guestWelcome.resumeToken);
      guest.send({
        type: "join",
        code: f.room.code,
        name: "Guest",
        fighter: "zavarce",
        wins,
      });
      await f.host.wait("room", (message) => message.room.players.length === 2);
      f.host.send({ type: "ready", ready: true });
      guest.send({ type: "ready", ready: true });
      await Promise.all([f.host.wait("start"), guest.wait("start")]);
      const active = f.server.rooms.get(f.room.code)!;
      active.state!.phase = "playing";
      active.state!.remaining = 1;
      active.state!.players[1 - winner].hp = 1;
      const finished = await f.host.wait(
        "state",
        (message) => message.state.phase === "finished",
      );
      const resultRoom = await f.host.wait(
        "room",
        (message) => message.room.status === "finished",
      );
      assert.equal(finished.state.winner, winner);
      assert.equal(resultRoom.room.players[winner].wins, wins + 1);

      // Mobile wake replaces a socket before the previous connection closes.
      const replacement = new Peer(
        f.url,
        winner === 0 ? f.token : guestWelcome.resumeToken,
      );
      assert.equal((await replacement.wait("welcome")).resumed, true);
      const resumed = await replacement.wait("start");
      assert.equal(resumed.index, winner);
      assert.deepEqual(resumed.state, finished.state);
      for (const state of [finished.state, resumed.state]) {
        assert.equal(state.players[winner].config.wins, wins);
        const html = renderToStaticMarkup(
          createElement(VictoryScreen, {
            state,
            mode: "online",
            localIndex: winner,
            active: true,
            overlayRef: createRef<HTMLDivElement>(),
            onReady() {},
            onRematch() {},
            onExit() {},
          }),
        );
        assert.equal(html.includes("Nuevo combo desbloqueado"), wins === 0);
        assert.equal(html.includes("Definitiva desbloqueada"), false);
        assert.equal(html.includes('class="victory-screen-unlock"'), wins === 0);
      }

      const opponent = winner === 0 ? guest : f.host;
      replacement.send({ type: "rematch" });
      opponent.send({ type: "rematch" });
      const [rematch, remote] = await Promise.all([
        replacement.wait("start"),
        opponent.wait("start"),
      ]);
      assert.notEqual(rematch.state.id, finished.state.id);
      assert.deepEqual(rematch.state, remote.state);
      assert.equal(rematch.state.players[winner].config.wins, wins + 1);
      assert.equal(rematch.state.players[1 - winner].config.wins, wins);
    });
  }
}

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
