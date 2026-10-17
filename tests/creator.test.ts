import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { makeArenaServer } from "../server/index";
import type { CharacterProvider } from "../server/creator/provider";
import type { CommunityCharacter, CreatorCharacter } from "../shared/creator";
import { fighterById, isFighter } from "../shared/content";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import { unregisterCommunityCharacter } from "../shared/community";
import { WebSocket } from "ws";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";

async function eventually(predicate: () => boolean) {
  const until = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() > until)
      throw new Error("Expected multiplayer event did not arrive");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function fixtureAtlas() {
  let shapes = "";
  for (let n = 0; n < 8; n++) {
    const x = (n % 4) * 384 + 192,
      y = Math.floor(n / 4) * 512;
    shapes += `<g fill="#6084b8"><circle cx="${x}" cy="${y + 92}" r="35"/><rect x="${x - 36}" y="${y + 115}" width="72" height="220"/><rect x="${x - 55}" y="${y + 145}" width="${110 + n * 2}" height="30"/><rect x="${x - 36}" y="${y + 325}" width="26" height="100"/><rect x="${x + 10}" y="${y + 325}" width="26" height="100"/></g>`;
  }
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024">${shapes}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
const design = {
  title: "El pana de prueba",
  specialName: "Entrada de prueba",
  outfit: "Chaqueta azul y zapatos blancos.",
  likeness: "Cabello corto y lentes oscuros de montura.",
  welcome: "Saludo con la mano",
  combos: ["Primer paso", "Dos tiempos", "Gran remate"] as [
    string,
    string,
    string,
  ],
};
async function setup(
  provider: CharacterProvider | null = {
    design: async () => design,
    draw: fixtureAtlas,
  },
  dataDir?: string,
  serveClient = false,
) {
  const folder =
    dataDir || (await mkdtemp(path.join(os.tmpdir(), "arena-creator-test-")));
  const server = await makeArenaServer({
    serveClient,
    creator: {
      dataDir: folder,
      databasePath: path.join(folder, "test.sqlite"),
      provider,
      secureCookies: false,
    },
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (url: string, options: RequestInit = {}, cookie = "") =>
    fetch(base + url, {
      ...options,
      headers: {
        Origin: base,
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
    });
  const signup = async (name = "Pana", email = "pana@example.test") => {
    const response = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password: "password-123" }),
    });
    assert.equal(response.status, 201);
    return {
      cookie: response.headers.get("set-cookie")!.split(";")[0],
      user: (await response.json()).user,
    };
  };
  const upload = async (cookie: string, style = "agile") => {
    const body = new FormData();
    body.set("name", "Pana Azul");
    body.set("description", "Soy diseñador y fan de las arepas.");
    body.set("style", style);
    body.set("color", "#669bff");
    const photo = await sharp({
      create: { width: 80, height: 100, channels: 3, background: "#6887a0" },
    })
      .jpeg()
      .toBuffer();
    body.append(
      "photos",
      new Blob([new Uint8Array(photo)], { type: "image/jpeg" }),
      "photo.jpg",
    );
    return request("/api/creator/characters", { method: "POST", body }, cookie);
  };
  const ready = async (cookie: string, id: string) => {
    const until = Date.now() + 6000;
    while (Date.now() < until) {
      const response = await request(
        `/api/creator/characters/${id}`,
        {},
        cookie,
      );
      const row = (await response.json()).character as CreatorCharacter;
      if (["ready", "failed"].includes(row.status)) return row;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("Generation did not finish");
  };
  return { server, folder, base, request, signup, upload, ready };
}

test("accounts use hashed passwords, HttpOnly sessions and ownership checks", async () => {
  const s = await setup();
  try {
    const guest = await s.request("/api/creator/characters");
    assert.equal(guest.status, 401);
    const invalid = await s.request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name: "X", email: "bad", password: "short" }),
    });
    assert.equal(invalid.status, 400);
    const { cookie, user } = await s.signup();
    const row = s.server.creator.db.userByEmail("pana@example.test")!;
    assert.ok(row.password_hash.startsWith("scrypt:"));
    assert.ok(!row.password_hash.includes("password-123"));
    assert.equal(
      (await (await s.request("/api/auth/session", {}, cookie)).json()).user.id,
      user.id,
    );
    const duplicate = await s.request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "Pana",
        email: "PANA@example.test",
        password: "password-123",
      }),
    });
    assert.equal(duplicate.status, 409);
    const wrong = await s.request("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        email: "pana@example.test",
        password: "wrong-password",
      }),
    });
    assert.equal(wrong.status, 401);
    const signIn = await s.request("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        email: "pana@example.test",
        password: "password-123",
      }),
    });
    assert.equal(signIn.status, 200);
    assert.match(signIn.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(signIn.headers.get("set-cookie")!, /SameSite=Lax/);
    const cross = await s.request(
      "/api/auth/signout",
      { method: "POST", headers: { Origin: "https://elsewhere.example" } },
      cookie,
    );
    assert.equal(cross.status, 403);
    await s.request("/api/auth/signout", { method: "POST" }, cookie);
    assert.equal(
      (await (await s.request("/api/auth/session", {}, cookie)).json()).user,
      null,
    );
  } finally {
    await s.server.close();
  }
});

test("a real LangGraph run packs eight sprites, keeps photos private, and publishes a playable fighter", async () => {
  const calls: string[] = [];
  const s = await setup({
    design: async () => {
      calls.push("design");
      return design;
    },
    draw: async () => {
      calls.push("draw");
      return fixtureAtlas();
    },
  });
  let id = "";
  try {
    const a = await s.signup("Creador", "creator@example.test");
    const b = await s.signup("Otro", "other@example.test");
    const response = await s.upload(a.cookie);
    assert.equal(response.status, 202);
    id = (await response.json()).character.id;
    const record = await s.ready(a.cookie, id);
    assert.equal(record.status, "ready", record.message);
    assert.equal(record.progress, 100);
    assert.deepEqual(calls, ["design", "draw"]);
    assert.equal(record.character?.geometry.frames.length, 8);
    assert.equal(
      isFighter(id),
      false,
      "A draft must not appear in public selection",
    );
    assert.equal(
      (await s.request(`/api/creator/characters/${id}`, {}, b.cookie)).status,
      404,
    );
    assert.equal(
      (await s.request(`/api/creator/characters/${id}/photos/0`)).status,
      401,
    );
    assert.equal(
      (await s.request(`/api/creator/characters/${id}/photos/0`, {}, b.cookie))
        .status,
      404,
    );
    assert.equal(
      (await s.request(`/api/creator/characters/${id}/photos/0`, {}, a.cookie))
        .status,
      200,
    );
    assert.equal(
      (await s.request(`/api/community/assets/${id}/sprite.webp`)).status,
      404,
    );
    assert.equal(
      (await s.request(`/api/community/assets/${id}/sprite.webp`, {}, a.cookie))
        .status,
      200,
    );
    assert.equal(
      (await (await s.request("/api/community/characters")).json()).characters
        .length,
      0,
    );
    const attacker = await s.request(
      `/api/creator/characters/${id}/publish`,
      { method: "POST" },
      b.cookie,
    );
    assert.equal(attacker.status, 404);
    const published = await s.request(
      `/api/creator/characters/${id}/publish`,
      { method: "POST" },
      a.cookie,
    );
    assert.equal(published.status, 200);
    const catalog = await (await s.request("/api/community/characters")).json();
    assert.equal(catalog.characters[0].id, id);
    assert.equal(isFighter(id), true);
    assert.equal(
      (await s.request(`/api/community/assets/${id}/sprite.webp`)).status,
      200,
    );
    const metadata = await sharp(
      path.join(s.folder, "characters", id, "sprite.webp"),
    ).metadata();
    assert.equal(metadata.width, 2048);
    assert.equal(metadata.height, 1024);
    assert.equal(metadata.hasAlpha, true);
    const stored = JSON.parse(
      await readFile(path.join(s.folder, "community.json"), "utf8"),
    );
    assert.equal(stored[0].id, id);
    assert.ok(
      (await stat(path.join(s.folder, "characters", id, "character.json")))
        .size > 100,
    );
    const fighter = record.character!.fighter;
    assert.equal(fighterById(fighter.id).name, "Pana Azul");
    const match = createMatch("caracas", [
      { name: "Pana", fighter: fighter.id, wins: 3 },
      { name: "CPU", fighter: "javier", wins: 0 },
    ]);
    match.phase = "playing";
    const inputs: [
      ReturnType<typeof emptyInput>,
      ReturnType<typeof emptyInput>,
    ] = [emptyInput(), emptyInput()];
    inputs[0].actions.special++;
    for (let n = 0; n < 80; n++) stepMatch(match, inputs);
    assert.ok(Number.isFinite(match.players[0].x));
    const deniedDelete = await s.request(
      `/api/creator/characters/${id}`,
      { method: "DELETE" },
      b.cookie,
    );
    assert.equal(deniedDelete.status, 404);
    const deleted = await s.request(
      `/api/creator/characters/${id}`,
      { method: "DELETE" },
      a.cookie,
    );
    assert.equal(deleted.status, 200);
    assert.equal(
      (await (await s.request("/api/community/characters")).json()).characters
        .length,
      0,
    );
    assert.equal(isFighter(id), false);
    assert.equal(
      (await s.request(`/api/community/assets/${id}/sprite.webp`)).status,
      200,
      "Published art remains available to already-started matches",
    );
    assert.doesNotThrow(
      () => stepMatch(match, inputs),
      "Removing discovery must not break an active match",
    );
  } finally {
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
  }
});

test("sessions and published characters survive a server restart", async () => {
  const first = await setup();
  const account = await first.signup();
  const response = await first.upload(account.cookie);
  const id = (await response.json()).character.id;
  await first.ready(account.cookie, id);
  await first.request(
    `/api/creator/characters/${id}/publish`,
    { method: "POST" },
    account.cookie,
  );
  await first.server.close();
  unregisterCommunityCharacter(id);
  const second = await setup(null, first.folder);
  try {
    assert.equal(
      (
        await (
          await second.request("/api/auth/session", {}, account.cookie)
        ).json()
      ).user.id,
      account.user.id,
    );
    assert.equal(
      (await (await second.request("/api/community/characters")).json())
        .characters[0].id,
      id,
    );
    assert.equal(isFighter(id), true);
    assert.equal(
      (await second.request(`/api/community/assets/${id}/sprite.webp`)).status,
      200,
    );
  } finally {
    unregisterCommunityCharacter(id);
    await second.server.close();
  }
});

test("an unconfigured provider returns an honest unavailable state instead of a fake generation", async () => {
  const s = await setup(null);
  try {
    const account = await s.signup();
    assert.equal(
      (await (await s.request("/api/creator/capabilities")).json())
        .generationAvailable,
      false,
    );
    const upload = await s.upload(account.cookie);
    assert.equal(upload.status, 503);
    assert.equal(s.server.creator.db.owned(account.user.id).length, 0);
  } finally {
    await s.server.close();
  }
});

test("failed jobs can resume without redesigning and invalid photos do not enter the pipeline", async () => {
  let attempts = 0,
    designs = 0;
  const s = await setup({
    design: async () => {
      designs++;
      return design;
    },
    draw: async () => {
      if (++attempts === 1) throw new Error("Simulated upstream failure");
      return fixtureAtlas();
    },
  });
  let id = "";
  try {
    const account = await s.signup();
    const bad = new FormData();
    bad.set("name", "Pana");
    bad.set("description", "Una descripción válida.");
    bad.set("style", "agile");
    bad.set("color", "#ffd45a");
    bad.append(
      "photos",
      new Blob(["not an image"], { type: "image/jpeg" }),
      "bad.jpg",
    );
    assert.equal(
      (
        await s.request(
          "/api/creator/characters",
          { method: "POST", body: bad },
          account.cookie,
        )
      ).status,
      400,
    );
    assert.equal(s.server.creator.db.owned(account.user.id).length, 0);
    const created = await s.upload(account.cookie);
    id = (await created.json()).character.id;
    const failed = await s.ready(account.cookie, id);
    assert.equal(failed.status, "failed");
    const retried = await s.request(
      `/api/creator/characters/${id}/retry`,
      { method: "POST" },
      account.cookie,
    );
    assert.equal(retried.status, 202);
    assert.equal((await s.ready(account.cookie, id)).status, "ready");
    assert.equal(designs, 1);
    assert.equal(attempts, 2);
  } finally {
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
  }
});

test("published community definitions reach live anonymous clients and can be selected in rooms", async () => {
  const s = await setup();
  let id = "";
  const ws = new WebSocket(s.base.replace("http", "ws") + "/ws");
  const messages: any[] = [];
  ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
  try {
    await new Promise<void>((resolve) => ws.once("open", resolve));
    const account = await s.signup();
    id = (await (await s.upload(account.cookie)).json()).character.id;
    await s.ready(account.cookie, id);
    await s.request(
      `/api/creator/characters/${id}/publish`,
      { method: "POST" },
      account.cookie,
    );
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(
      messages.some(
        (m) =>
          m.type === "community" &&
          m.characters.some((c: CommunityCharacter) => c.id === id),
      ),
    );
    ws.send(
      JSON.stringify({
        type: "create",
        name: "Invitado",
        fighter: id,
        stage: "caracas",
        wins: 0,
        private: false,
      }),
    );
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(
      messages.some(
        (m) => m.type === "room" && m.room.players[0].fighter === id,
      ),
    );
  } finally {
    ws.close();
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
  }
});

test("concurrent submissions reserve one creation slot before photo processing", async () => {
  const s = await setup();
  let id = "";
  try {
    const account = await s.signup();
    const responses = await Promise.all([
      s.upload(account.cookie),
      s.upload(account.cookie),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [202, 409],
    );
    id = (await responses.find((response) => response.status === 202)!.json())
      .character.id;
    assert.equal(s.server.creator.db.owned(account.user.id).length, 1);
    assert.equal((await s.ready(account.cookie, id)).status, "ready");
  } finally {
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
  }
});

test("anonymous peers fight with a published character, then retirement prevents its rematch", async () => {
  const s = await setup();
  let id = "";
  const peers = [0, 1].map(
    () => new WebSocket(s.base.replace("http", "ws") + "/ws"),
  );
  const messages: any[][] = [[], []];
  peers.forEach((peer, index) =>
    peer.on("message", (raw) =>
      messages[index].push(JSON.parse(raw.toString())),
    ),
  );
  const send = (index: number, message: unknown) =>
    peers[index].send(JSON.stringify(message));
  try {
    await Promise.all(
      peers.map(
        (peer) => new Promise<void>((resolve) => peer.once("open", resolve)),
      ),
    );
    const account = await s.signup();
    id = (await (await s.upload(account.cookie)).json()).character.id;
    assert.equal((await s.ready(account.cookie, id)).status, "ready");
    await s.request(
      `/api/creator/characters/${id}/publish`,
      { method: "POST" },
      account.cookie,
    );
    send(0, {
      type: "create",
      name: "Invitado",
      fighter: id,
      stage: "poliedro",
      wins: 3,
      private: false,
    });
    await eventually(() =>
      messages[0].some((message) => message.type === "room"),
    );
    const code = messages[0].find((message) => message.type === "room").room
      .code;
    send(1, {
      type: "join",
      code,
      name: "Otro invitado",
      fighter: "javier",
      wins: 0,
    });
    await eventually(() =>
      messages[0].some(
        (message) =>
          message.type === "room" && message.room.players.length === 2,
      ),
    );
    peers.forEach((_peer, index) =>
      send(index, { type: "ready", ready: true }),
    );
    await eventually(() =>
      messages.every((events) =>
        events.some((message) => message.type === "start"),
      ),
    );
    assert.equal(
      messages[0].find((message) => message.type === "start").state.players[0]
        .config.fighter,
      id,
    );
    const room = s.server.rooms.get(code)!;
    const active = room.state!;
    assert.equal(
      (
        await s.request(
          `/api/creator/characters/${id}`,
          { method: "DELETE" },
          account.cookie,
        )
      ).status,
      200,
    );
    assert.equal(room.view.status, "playing");
    for (let tick = 0; tick < INTRO_TOTAL_TICKS; tick++)
      stepMatch(active, [emptyInput(), emptyInput()]);
    active.remaining = 1;
    await eventually(() => room.view.status === "finished");
    peers.forEach((_peer, index) => send(index, { type: "rematch" }));
    await eventually(() => room.view.status === "waiting");
    assert.equal(room.view.players[0].fighter, "zavarce");
    assert.ok(room.view.players.every((player) => !player.ready));
    assert.equal(room.state, null);
    peers.forEach((_peer, index) =>
      send(index, { type: "ready", ready: true }),
    );
    await eventually(() => room.view.status === "playing");
    assert.equal(room.state!.players[0].config.fighter, "zavarce");
  } finally {
    peers.forEach((peer) => peer.close());
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
  }
});

test("continuing an invalid atlas redraws it while preserving the completed design", async () => {
  let designs = 0,
    drawings = 0;
  const s = await setup({
    design: async () => {
      designs++;
      return design;
    },
    draw: async () => {
      drawings++;
      return drawings === 1
        ? sharp({
            create: {
              width: 1536,
              height: 1024,
              channels: 3,
              background: "white",
            },
          })
            .png()
            .toBuffer()
        : fixtureAtlas();
    },
  });
  let id = "";
  try {
    const account = await s.signup();
    id = (await (await s.upload(account.cookie)).json()).character.id;
    assert.equal((await s.ready(account.cookie, id)).status, "failed");
    assert.equal(s.server.creator.db.character(id)!.source_path, null);
    assert.equal(
      (
        await s.request(
          `/api/creator/characters/${id}/retry`,
          { method: "POST" },
          account.cookie,
        )
      ).status,
      202,
    );
    assert.equal((await s.ready(account.cookie, id)).status, "ready");
    assert.equal(designs, 1);
    assert.equal(drawings, 2);
  } finally {
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
  }
});

test("shutdown aborts generation and a restart waits for the owner to continue", async () => {
  let started!: () => void;
  const drawing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const first = await setup({
    design: async () => design,
    draw: async (_input, _design, _photos, signal) => {
      assert.ok(signal);
      return new Promise<Buffer>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("Aborted fixture generation")),
          { once: true },
        );
        started();
      });
    },
  });
  const account = await first.signup();
  const id = (await (await first.upload(account.cookie)).json()).character.id;
  await drawing;
  await first.server.close();
  let newDesigns = 0,
    newDrawings = 0;
  const second = await setup(
    {
      design: async () => {
        newDesigns++;
        return design;
      },
      draw: async () => {
        newDrawings++;
        return fixtureAtlas();
      },
    },
    first.folder,
  );
  try {
    assert.equal((await second.ready(account.cookie, id)).status, "failed");
    assert.equal(
      newDrawings,
      0,
      "A restart must not repeat a billed drawing request",
    );
    assert.equal(
      (
        await second.request(
          `/api/creator/characters/${id}/retry`,
          { method: "POST" },
          account.cookie,
        )
      ).status,
      202,
    );
    assert.equal((await second.ready(account.cookie, id)).status, "ready");
    assert.equal(newDesigns, 0);
    assert.equal(newDrawings, 1);
  } finally {
    unregisterCommunityCharacter(id);
    await second.server.close();
  }
});

test("Vite cannot serve private photos or SQLite through raw development file URLs", async () => {
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  const folder = await mkdtemp(
    path.join(process.cwd(), "data", "dev-privacy-test-"),
  );
  const s = await setup(undefined, folder, true);
  let id = "";
  try {
    const account = await s.signup();
    id = (await (await s.upload(account.cookie)).json()).character.id;
    assert.equal((await s.ready(account.cookie, id)).status, "ready");
    const photo = JSON.parse(
      s.server.creator.db.character(id)!.photos,
    )[0] as string;
    for (const file of [photo, path.join(folder, "test.sqlite")]) {
      const relative = "/" + path.relative(process.cwd(), file);
      for (const url of [relative, "/@fs/" + file, relative + "?raw"]) {
        const response = await s.request(url);
        assert.equal(response.status, 403, url);
        assert.ok(!(await response.text()).includes("SQLite format 3"));
      }
    }
    assert.equal(
      (await s.request(`/api/creator/characters/${id}/photos/0`)).status,
      401,
    );
    assert.equal(
      (
        await s.request(
          `/api/creator/characters/${id}/photos/0`,
          {},
          account.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await s.request(
          `/api/community/assets/${id}/sprite.webp`,
          {},
          account.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await s.request(`/api/community/assets/${id}/sprite.webp`)).status,
      404,
    );
  } finally {
    if (id) unregisterCommunityCharacter(id as CommunityCharacter["id"]);
    await s.server.close();
    await rm(folder, { recursive: true, force: true });
  }
});
