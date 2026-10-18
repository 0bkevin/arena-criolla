import test from "node:test";
import assert from "node:assert/strict";
import atlas from "../docs/character-sprite-qa.json";
import entrances from "../shared/entrance-assets.json";
import { loadSprite } from "../src/game/assets";
import { makeArenaServer } from "../server/index";
import { WebSocket } from "ws";
import type { ServerMessage } from "../shared/protocol";

// Exercise the real atlas loader without downloading or decoding images in Node.
test("static portraits load only their atlas; cinematic requests still load the complete entrance", async () => {
  const checked = atlas.sprites
    .find((entry) => entry.id === "renny")!
    .files.find((entry) => entry.file.endsWith(".webp"))!;
  const requests: string[] = [];
  const descriptors = new Map(
    ["Image", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  class FixtureImage {
    width = checked.width;
    height = checked.height;
    onload: (() => void) | null = null;
    set src(value: string) {
      requests.push(value);
      queueMicrotask(() => this.onload?.());
    }
  }
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: FixtureImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          putImageData() {},
          getImageData: (
            _x: number,
            _y: number,
            width: number,
            height: number,
          ) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        }),
      }),
    },
  });
  try {
    const portrait = await loadSprite("renny", { entrance: false });
    assert.equal(portrait.frames.length, 8);
    assert.equal(portrait.entrance, undefined);
    assert.equal(
      requests.length,
      1,
      "a static portrait must not fetch an unused entrance",
    );
    const cinematic = await loadSprite("renny");
    assert.ok(cinematic.entrance);
    assert.equal(
      cinematic.image,
      portrait.image,
      "both paths reuse the exact same full-quality atlas",
    );
    assert.deepEqual(cinematic.frames, portrait.frames);
    assert.equal(requests.length, 2);
    assert.equal(requests[1], `/assets/${entrances.renny.file}.webp`);
    assert.equal(await loadSprite("renny"), cinematic);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

class Peer {
  socket: WebSocket;
  messages: ServerMessage[] = [];
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) =>
      this.messages.push(JSON.parse(raw.toString())),
    );
  }
  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }
  async wait<T extends ServerMessage["type"]>(type: T) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex((message) => message.type === type);
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

test("each match update is serialized once and delivered identically to both players", async () => {
  const server = await makeArenaServer({
    serveClient: false,
    creator: { databasePath: ":memory:", provider: null },
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const a = new Peer(`ws://127.0.0.1:${address.port}/ws`);
  const b = new Peer(`ws://127.0.0.1:${address.port}/ws`);
  const original = JSON.stringify;
  try {
    await Promise.all([a.wait("welcome"), b.wait("welcome")]);
    a.send({
      type: "create",
      name: "Perf A",
      fighter: "zavarce",
      stage: "caracas",
      wins: 0,
      private: true,
    });
    const { room } = await a.wait("room");
    b.send({
      type: "join",
      code: room.code,
      name: "Perf B",
      fighter: "dudamel",
      wins: 0,
    });
    await b.wait("room");
    const serializations = new Map<number, number>();
    JSON.stringify = (value, ...rest) => {
      if (value?.type === "state")
        serializations.set(
          value.state.tick,
          (serializations.get(value.state.tick) ?? 0) + 1,
        );
      return Reflect.apply(original, JSON, [value, ...rest]);
    };
    a.send({ type: "ready", ready: true });
    b.send({ type: "ready", ready: true });
    await Promise.all([a.wait("start"), b.wait("start")]);
    const [first, second] = await Promise.all([
      a.wait("state"),
      b.wait("state"),
    ]);
    assert.deepEqual(
      first,
      second,
      "the wire state and tick stay identical for both players",
    );
    assert.equal(
      serializations.get(first.state.tick),
      1,
      "each shared state must be encoded once",
    );
  } finally {
    JSON.stringify = original;
    a.socket.terminate();
    b.socket.terminate();
    await server.close();
  }
});

