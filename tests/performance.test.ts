import test from "node:test";
import assert from "node:assert/strict";
import atlas from "../shared/sprite-geometry.json";
import entrances from "../shared/entrance-assets.json";
import { loadSprite } from "../src/game/assets";
import { makeArenaServer } from "../server/index";
import { WebSocket } from "ws";
import { get } from "node:http";
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

test("production caches fingerprinted assets and negotiates one shared background", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const folder = await mkdtemp(path.join(tmpdir(), "arena-cache-test-"));
  const previous = process.cwd();
  let server: Awaited<ReturnType<typeof makeArenaServer>> | undefined;
  try {
    await mkdir(path.join(folder, "dist/assets"), { recursive: true });
    await writeFile(
      path.join(folder, "dist/index.html"),
      "<!doctype html><html><body>arena</body></html>",
    );
    await writeFile(
      path.join(folder, "dist/assets/index-Abcd1234.js"),
      "console.log('arena')",
    );
    await writeFile(path.join(folder, "dist/assets/caracas.webp"), "fixture");
    await writeFile(
      path.join(folder, "dist/assets/caracas.avif"),
      "avif-fixture",
    );
    const cutouts = [
      "entrance-renny-012345abcdef.avif",
      "entrance-renny-fedcba543210.webp",
    ];
    for (const file of cutouts)
      await writeFile(path.join(folder, "dist/assets", file), "cutout-fixture");
    process.chdir(folder);
    server = await makeArenaServer({
      production: true,
      creator: { dataDir: path.join(folder, "private"), provider: null },
    });
    process.chdir(previous);
    await new Promise<void>((resolve) =>
      server!.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const bundle = await fetch(base + "/assets/index-Abcd1234.js");
    assert.equal(bundle.status, 200);
    assert.equal(
      bundle.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
    for (const file of cutouts) {
      const response = await fetch(`${base}/assets/${file}`);
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("cache-control"),
        "public, max-age=31536000, immutable",
      );
    }
    for (const route of ["/", "/api/health", "/assets/caracas.webp"]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.doesNotMatch(
        response.headers.get("cache-control") ?? "",
        /immutable/,
      );
    }

    for (const [accept, expectedType, expectedBody] of [
      ["image/avif,image/webp;q=0.9", "image/avif", "avif-fixture"],
      ["image/webp,image/*;q=0.8", "image/webp", "fixture"],
      ["image/avif;q=0,image/webp", "image/webp", "fixture"],
      ["*/*", "image/webp", "fixture"],
    ]) {
      const response = await fetch(`${base}/assets/caracas.webp`, {
        headers: { Accept: accept },
      });
      assert.equal(response.status, 200);
      assert.match(
        response.headers.get("content-type") ?? "",
        new RegExp(expectedType),
      );
      assert.match(response.headers.get("vary") ?? "", /\bAccept\b/);
      assert.doesNotMatch(
        response.headers.get("cache-control") ?? "",
        /immutable/,
      );
      assert.equal(await response.text(), expectedBody);

      // Raw HTTP preserves browser validation headers; fetch adds no-cache.
      const cached = await new Promise<{
        status: number | undefined;
        bytes: number;
        vary: string | undefined;
      }>((resolve, reject) => {
        get(
          `${base}/assets/caracas.webp`,
          {
            headers: {
              Accept: accept,
              "If-None-Match": response.headers.get("etag")!,
            },
          },
          (result) => {
            let bytes = 0;
            result.on("data", (chunk: Buffer) => {
              bytes += chunk.length;
            });
            result.on("end", () =>
              resolve({
                status: result.statusCode,
                bytes,
                vary: result.headers.vary,
              }),
            );
            result.on("error", reject);
          },
        ).on("error", reject);
      });
      assert.equal(cached.status, 304);
      assert.equal(cached.bytes, 0);
      assert.match(cached.vary ?? "", /\bAccept\b/);
    }

    await rm(path.join(folder, "dist/assets/caracas.avif"));
    const fallback = await fetch(`${base}/assets/caracas.webp`, {
      headers: { Accept: "image/avif,image/webp" },
    });
    assert.equal(fallback.status, 200);
    assert.match(fallback.headers.get("content-type") ?? "", /image\/webp/);
    assert.equal(await fallback.text(), "fixture");
  } finally {
    process.chdir(previous);
    await server?.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("trusted proxy clients have separate auth limits, and untrusted forwarded headers cannot bypass them", async () => {
  for (const trusted of [true, false]) {
    const server = await makeArenaServer({
      serveClient: false,
      workshopEnabled: true,
      trustProxy: trusted ? ["loopback"] : [],
      creator: { databasePath: ":memory:", provider: null },
    });
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/api/auth/signin`;
    const send = async (ip: string) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: "{}",
      });
      await response.json();
      return response.status;
    };
    try {
      for (let i = 1; i <= 31; i++)
        assert.equal(
          await send(`198.51.100.${i}`),
          trusted || i <= 30 ? 400 : 429,
        );
      if (trusted) {
        for (let i = 0; i < 29; i++)
          assert.equal(await send("203.0.113.20"), 400);
        assert.equal(await send("203.0.113.20"), 400);
        assert.equal(await send("203.0.113.20"), 429);
      }
    } finally {
      await server.close();
    }
  }
});
