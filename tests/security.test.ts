import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

async function upgrade(url: string, headers: Record<string, string> = {}) {
  return new Promise<number>((resolve) => {
    const socket = new WebSocket(url, { headers, handshakeTimeout: 2000 });
    socket.on("error", () => {});
    socket.once("open", () => {
      socket.close();
      resolve(101);
    });
    socket.once("unexpected-response", (_req, response) => {
      response.resume();
      socket.terminate();
      resolve(response.statusCode ?? 0);
    });
    socket.once("timeout", () => {
      socket.terminate();
      resolve(0);
    });
  });
}

test("browser WebSockets require the complete same origin, respecting only trusted proxies", async (t) => {
  for (const trustProxy of [[], ["loopback"]]) {
    const server = await makeArenaServer({ serveClient: false, trustProxy });
    t.after(() => server.close());
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address === "object");
    const authority = `127.0.0.1:${address.port}`;
    const url = `ws://${authority}/ws`;
    assert.equal(
      await upgrade(url),
      101,
      "non-browser guest tools remain supported",
    );
    assert.equal(await upgrade(url, { Origin: `http://${authority}` }), 101);
    for (const Origin of [
      "https://attacker.invalid",
      "null",
      `http://${authority}.attacker.invalid`,
      `http://${authority}/`,
      `https://${authority}`,
      "http://127.0.0.1",
      "file://",
      "invalid",
    ])
      assert.equal(await upgrade(url, { Origin }), 403, Origin);
    const alias = {
      Host: "temporary.example",
      Origin: "https://temporary.example",
      "X-Forwarded-Proto": "https",
    };
    assert.equal(await upgrade(url, alias), trustProxy.length ? 101 : 403);
    assert.equal(
      await upgrade(url, { ...alias, Origin: "http://temporary.example" }),
      trustProxy.length ? 403 : 101,
    );
    assert.equal(
      await upgrade(url, { ...alias, Origin: "https://temporary.example:444" }),
      403,
    );
  }
});

test("production HTML has fresh CSP nonces and browser protections without caching invitations", async (t) => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-security-"));
  const previous = process.cwd();
  let server: Awaited<ReturnType<typeof makeArenaServer>> | undefined;
  t.after(async () => {
    process.chdir(previous);
    await server?.close();
    await rm(folder, { recursive: true, force: true });
  });
  await mkdir(path.join(folder, "dist/assets"), { recursive: true });
  await copyFile(
    "public/assets/og-arena-criolla.jpg",
    path.join(folder, "dist/assets/og-arena-criolla.jpg"),
  );
  await writeFile(
    path.join(folder, "dist/index.html"),
    '<!doctype html><html><head><script type="application/ld+json">{"url":"__ARENA_ORIGIN__/"}</script></head><body><script type="module" src="/assets/index-Abcd1234.js"></script></body></html>',
  );
  await writeFile(
    path.join(folder, "dist/assets/index-Abcd1234.js"),
    "export {};",
  );
  const bannerNames = [
    "lobby-cast-banner-Abcd1234.webp",
    "lobby-cast-banner-mobile-Efgh5678.webp",
    "lobby-cast-banner-tablet-Ijkl9012.webp",
    "lobby-cast-banner.webp",
  ];
  for (const name of bannerNames)
    await writeFile(path.join(folder, "dist/assets", name), "banner fixture");
  try {
    process.chdir(folder);
    server = await makeArenaServer({
      production: true,
      trustProxy: ["loopback"],
      creator: {
        dataDir: path.join(folder, "private"),
        databasePath: ":memory:",
        provider: null,
      },
    });
  } finally {
    process.chdir(previous);
  }
  await new Promise<void>((resolve) =>
    server!.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const first = await fetch(`${base}/?room=PRIVATE`);
  assert.equal(first.headers.get("x-content-type-options"), "nosniff");
  assert.equal(first.headers.get("x-frame-options"), "DENY");
  assert.equal(first.headers.get("referrer-policy"), "no-referrer");
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("strict-transport-security"), null);
  const policy = first.headers.get("content-security-policy") ?? "";
  const nonce = policy.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
  assert.ok(nonce);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.ok(!policy.includes("unsafe-eval"));
  assert.ok(!policy.match(/script-src[^;]*'unsafe-inline'/));
  const directives = new Map(
    policy.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  assert.deepEqual(directives.get("script-src"), [
    "'self'",
    `'nonce-${nonce}'`,
  ]);
  assert.deepEqual(directives.get("frame-src"), ["'none'"]);
  assert.deepEqual(directives.get("default-src"), ["'self'"]);
  assert.deepEqual(directives.get("media-src"), ["'self'", "data:", "blob:"]);
  assert.deepEqual(directives.get("connect-src"), [
    "'self'",
    base.replace(/^http/, "ws"),
  ]);
  const html = await first.text();
  assert.ok(html.includes(`nonce="${nonce}"`));
  assert.ok(!html.includes("PRIVATE"));
  const second = await fetch(base, {
    headers: { "X-Forwarded-Proto": "https" },
  });
  assert.match(
    second.headers.get("strict-transport-security") ?? "",
    /max-age=\d+/,
  );
  assert.notEqual(second.headers.get("content-security-policy"), policy);
  const script = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
  assert.ok(script);
  const asset = await fetch(base + script);
  assert.equal(asset.status, 200);
  assert.match(
    asset.headers.get("cache-control") ?? "",
    /max-age=31536000, immutable/,
  );
  for (const name of bannerNames) {
    const banner = await fetch(`${base}/assets/${name}`);
    assert.equal(banner.status, 200);
    assert.match(banner.headers.get("content-type") ?? "", /image\/webp/);
    const cache = banner.headers.get("cache-control") ?? "";
    if (name === "lobby-cast-banner.webp")
      assert.doesNotMatch(cache, /immutable/);
    else assert.match(cache, /max-age=31536000, immutable/);
    await banner.arrayBuffer();
  }
});
