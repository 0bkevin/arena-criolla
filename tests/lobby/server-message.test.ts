import test from "node:test";
import assert from "node:assert/strict";
import { Lobby } from "../../shared/lobby/lobby";
import { ARENA_SOCKET_PROTOCOL } from "../../shared/lobby/protocol";
import { parseServerMessage } from "../../shared/lobby/server-message";

test("every frame the lobby sends during a match parses on the client", async (t) => {
  const frames: string[] = [];
  const lobby = new Lobby<string>({
    send: (_socket, data) => frames.push(data),
    replace: () => {},
  });
  t.after(() => lobby.close());
  const send = (client: ReturnType<typeof lobby.connect>, message: object) =>
    lobby.receive(client, JSON.stringify(message));
  const host = lobby.connect("a", [ARENA_SOCKET_PROTOCOL]);
  const guest = lobby.connect("b", [ARENA_SOCKET_PROTOCOL]);
  send(host, {
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: false,
  });
  const room = [...lobby.rooms.keys()][0]!;
  send(guest, { type: "join", code: room, fighter: "ali", wins: 2 });
  send(host, { type: "ready", ready: true });
  send(guest, { type: "ready", ready: true });
  // Let the real 60 Hz loop and the debounced room list run.
  await new Promise((resolve) => setTimeout(resolve, 200));
  send(guest, { type: "create", fighter: "nadie" });
  send(guest, { type: "leave" });
  const types = new Set<string>();
  for (const frame of frames) {
    const message = parseServerMessage(JSON.parse(frame));
    assert.ok(message, `rejected a real frame: ${frame.slice(0, 120)}`);
    types.add(message.type);
  }
  for (const type of ["welcome", "rooms", "room", "start", "state", "error"])
    assert.ok(types.has(type), `no ${type} frame was exercised`);
});

test("malformed frames are rejected", () => {
  for (const frame of [
    null,
    [],
    { type: "bogus" },
    { type: "welcome" },
    { type: "rooms", rooms: [{ code: 1 }], online: 1 },
    { type: "room", room: { code: "x", stage: "luna" } },
    { type: "start", state: {}, index: 0 },
    { type: "state", state: { players: [] } },
    { type: "error", message: 4 },
  ])
    assert.equal(parseServerMessage(frame), null, JSON.stringify(frame));
});
