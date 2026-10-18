import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import type { ServerMessage } from "../shared/protocol";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Peer {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("error", () => {});
    this.socket.on("message", (raw) =>
      this.messages.push(JSON.parse(raw.toString())),
    );
  }
  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }
  async wait<T extends ServerMessage["type"]>(type: T) {
    for (let i = 0; i < 200; i++) {
      const index = this.messages.findIndex((message) => message.type === type);
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<
          ServerMessage,
          { type: T }
        >;
      await pause(10);
    }
    throw new Error(`Missing ${type}`);
  }
}

test("private-room updates stay inside the room while public discovery stays current", async (t) => {
  const server = await makeArenaServer({ serveClient: false });
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const host = new Peer(url);
  const observer = new Peer(url);
  await Promise.all([host.wait("welcome"), observer.wait("welcome")]);
  await pause(180);
  observer.messages.length = 0;
  host.send({
    type: "create",
    name: "Private",
    fighter: "zavarce",
    stage: "caracas",
    private: true,
  });
  const privateRoom = (await host.wait("room")).room;
  for (const ready of [true, false, true, false]) {
    host.send({ type: "ready", ready });
    assert.equal((await host.wait("room")).room.players[0].ready, ready);
    await pause(140);
  }
  assert.equal(
    observer.messages.filter((m) => m.type === "rooms").length,
    0,
    "private changes must not amplify into unrelated global broadcasts",
  );
  observer.send({ type: "list" });
  assert.deepEqual((await observer.wait("rooms")).rooms, []);
  host.send({ type: "leave" });
  await host.wait("left");
  host.send({
    type: "create",
    name: "Public",
    fighter: "zavarce",
    stage: "caracas",
    private: false,
  });
  const publicRoom = (await host.wait("room")).room;
  assert.notEqual(publicRoom.code, privateRoom.code);
  assert.equal((await observer.wait("rooms")).rooms[0].code, publicRoom.code);
  host.send({ type: "select", fighter: "capriles", wins: 0 });
  assert.equal(
    (await observer.wait("rooms")).rooms[0].players[0].fighter,
    "capriles",
  );
  observer.send({
    type: "join",
    code: publicRoom.code,
    name: "Guest",
    fighter: "zavarce",
  });
  await observer.wait("room");
  assert.deepEqual((await observer.wait("rooms")).rooms, []);
  observer.send({ type: "leave" });
  await observer.wait("left");
  assert.equal((await observer.wait("rooms")).rooms[0].code, publicRoom.code);
});

