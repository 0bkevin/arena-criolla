// The room rules both hosts share, driven through a fake transport.
import test from "node:test";
import assert from "node:assert/strict";
import { Lobby } from "../../shared/lobby/lobby";
import {
  ARENA_SOCKET_PROTOCOL,
  ROOM_RESUME_PROTOCOL_PREFIX,
  type ServerMessage,
} from "../../shared/lobby/protocol";

class FakeSocket {
  readonly received: ServerMessage[] = [];
  replaced = false;
  last<T extends ServerMessage["type"]>(type: T) {
    return [...this.received]
      .reverse()
      .find(
        (message): message is Extract<ServerMessage, { type: T }> =>
          message.type === type,
      );
  }
}

function lobby() {
  const unreliable: string[] = [];
  const instance = new Lobby<FakeSocket>(
    {
      send: (socket, data, reliable) => {
        const message = JSON.parse(data) as ServerMessage;
        if (!reliable) unreliable.push(message.type);
        socket.received.push(message);
      },
      replace: (socket) => {
        socket.replaced = true;
      },
    },
    { reconnectGraceMs: 60_000 },
  );
  return { instance, unreliable };
}

const send = (
  lobby: Lobby<FakeSocket>,
  client: ReturnType<Lobby<FakeSocket>["connect"]>,
  message: object,
) => lobby.receive(client, JSON.stringify(message));

test("a resumed session takes over its seat and retires the old socket", (t) => {
  const { instance } = lobby();
  t.after(() => instance.close());
  const first = new FakeSocket();
  const host = instance.connect(first, [ARENA_SOCKET_PROTOCOL]);
  const token = first.last("welcome")!.resumeToken!;
  send(instance, host, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: true,
  });
  const code = first.last("room")!.room.code;

  instance.disconnect(host, first);
  assert.equal(instance.clients.size, 0);
  assert.equal(instance.rooms.get(code)?.view.players[0].connected, false);

  const second = new FakeSocket();
  const resumed = instance.connect(second, [
    ARENA_SOCKET_PROTOCOL,
    ROOM_RESUME_PROTOCOL_PREFIX + token,
  ]);
  assert.equal(resumed, host);
  assert.equal(second.last("welcome")?.resumed, true);
  assert.equal(first.replaced, true);
  assert.equal(second.last("room")?.room.players[0].connected, true);

  // The old socket's late close and a duplicate close change nothing.
  instance.disconnect(host, first);
  assert.equal(instance.clients.get(host.id), host);
  instance.disconnect(host, second);
  instance.disconnect(host, second);
  assert.equal(instance.rooms.get(code)?.clients.length, 1);
});

test("a socket without the arena protocol cannot resume and leaves at once", (t) => {
  const { instance } = lobby();
  t.after(() => instance.close());
  const socket = new FakeSocket();
  const client = instance.connect(socket, []);
  assert.equal(socket.last("welcome")?.resumeToken, undefined);
  send(instance, client, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: false,
  });
  assert.equal(instance.rooms.size, 1);
  instance.disconnect(client, socket);
  assert.equal(instance.rooms.size, 0);
});

test("malformed messages are answered or ignored without changing a room", (t) => {
  const { instance } = lobby();
  t.after(() => instance.close());
  const socket = new FakeSocket();
  const client = instance.connect(socket, [ARENA_SOCKET_PROTOCOL]);
  instance.receive(client, "{not json");
  assert.equal(socket.last("error")?.message, "Ese mensaje no se pudo leer.");
  send(instance, client, {
    type: "create",
    fighter: "nadie",
    stage: "caracas",
  });
  assert.equal(
    socket.last("error")?.message,
    "Elige un luchador y un escenario válidos.",
  );
  send(instance, client, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: false,
  });
  // Being in a room takes precedence over an invalid create.
  send(instance, client, { type: "create", fighter: "nadie" });
  assert.equal(socket.last("error")?.message, "Primero sal de tu sala actual.");
  const before = JSON.stringify(socket.last("room"));
  send(instance, client, { type: "ready", ready: "yes" });
  send(instance, client, { type: "bogus" });
  assert.equal(JSON.stringify(socket.last("room")), before);
});

test("two ready players start a match and only state snapshots are unreliable", (t) => {
  const { instance, unreliable } = lobby();
  t.after(() => instance.close());
  const a = new FakeSocket();
  const b = new FakeSocket();
  const host = instance.connect(a, [ARENA_SOCKET_PROTOCOL]);
  const guest = instance.connect(b, [ARENA_SOCKET_PROTOCOL]);
  send(instance, host, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: false,
  });
  const code = a.last("room")!.room.code;
  send(instance, guest, { type: "join", code, fighter: "ali", wins: 0 });
  send(instance, host, { type: "ready", ready: true });
  send(instance, guest, { type: "ready", ready: true });
  assert.equal(a.last("start")?.index, 0);
  assert.equal(b.last("start")?.index, 1);
  assert.equal(instance.rooms.get(code)?.view.status, "playing");
  assert.deepEqual([...new Set(unreliable)].sort(), ["rooms"]);
});

test("a client joining after a list broadcast sees itself in the online count", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { instance } = lobby();
  t.after(() => instance.close());
  const first = new FakeSocket();
  instance.connect(first, [ARENA_SOCKET_PROTOCOL]);
  // The debounced broadcast caches the list while one player is online.
  t.mock.timers.tick(200);
  assert.equal(first.last("rooms")?.online, 1);
  const second = new FakeSocket();
  instance.connect(second, [ARENA_SOCKET_PROTOCOL]);
  assert.equal(second.last("rooms")?.online, 2);
});

test("a closed lobby starts no match that its stopped loop could not run", () => {
  const { instance } = lobby();
  const a = new FakeSocket();
  const b = new FakeSocket();
  const host = instance.connect(a, [ARENA_SOCKET_PROTOCOL]);
  const guest = instance.connect(b, [ARENA_SOCKET_PROTOCOL]);
  send(instance, host, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: false,
  });
  const code = a.last("room")!.room.code;
  send(instance, guest, { type: "join", code, fighter: "ali", wins: 0 });
  instance.close();
  send(instance, host, { type: "ready", ready: true });
  send(instance, guest, { type: "ready", ready: true });
  assert.equal(a.last("start"), undefined);
  assert.equal(instance.rooms.get(code)?.view.status, "waiting");
});

test("a room held for a disconnected player leaves the public list until they return", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { instance } = lobby();
  t.after(() => instance.close());
  const hostSocket = new FakeSocket();
  const host = instance.connect(hostSocket, [ARENA_SOCKET_PROTOCOL]);
  const token = hostSocket.last("welcome")!.resumeToken!;
  send(instance, host, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: false,
  });
  const watcher = new FakeSocket();
  instance.connect(watcher, [ARENA_SOCKET_PROTOCOL]);
  t.mock.timers.tick(200);
  assert.equal(watcher.last("rooms")?.rooms.length, 1);

  instance.disconnect(host, hostSocket);
  t.mock.timers.tick(200);
  assert.equal(watcher.last("rooms")?.rooms.length, 0);

  instance.connect(new FakeSocket(), [
    ARENA_SOCKET_PROTOCOL,
    ROOM_RESUME_PROTOCOL_PREFIX + token,
  ]);
  t.mock.timers.tick(200);
  assert.equal(watcher.last("rooms")?.rooms.length, 1);
});
