import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { WebSocket } from "ws";
import os from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { makeArenaServer } from "../server/index";
import { tokenHash } from "../server/creator/auth";
import { CreatorDatabase } from "../server/creator/database";
import { creatorLimits } from "../server/creator/worker";
import type { CharacterProvider } from "../server/creator/provider";
import { isFighter } from "../shared/content";

const design = {
  title: "El pana azul",
  specialName: "Paso azul",
  outfit: "Chaqueta azul y pantalones claros.",
  likeness: "Cabello oscuro y lentes de montura.",
  welcome: "Saludo de entrada",
  combos: ["Primer paso", "Dos tiempos", "Gran remate"] as [
    string,
    string,
    string,
  ],
};
async function atlas() {
  const shapes = Array.from(
    { length: 8 },
    (_, i) =>
      `<rect x="${(i % 4) * 384 + 140}" y="${Math.floor(i / 4) * 512 + 50}" width="100" height="400" rx="20" fill="#669bff"/>`,
  ).join("");
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024">${shapes}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
async function setup(provider: CharacterProvider | null = null) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-resilience-v31-"));
  const server = await makeArenaServer({
    serveClient: false,
    creator: { dataDir: folder, provider, secureCookies: false },
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const user = { id: randomUUID(), name: "Pana", email: "pana@example.test" };
  server.creator.db.createUser(user, "fixture-not-used-for-signin");
  const token = randomBytes(32).toString("hex");
  server.creator.db.saveSession(tokenHash(token), user.id, Date.now() + 60_000);
  const request = (url: string, options: RequestInit = {}) =>
    fetch(base + url, {
      ...options,
      headers: {
        Origin: base,
        Cookie: `arena_session=${token}`,
        ...options.headers,
      },
    });
  return {
    server,
    folder,
    base,
    request,
    async close() {
      await server.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}
async function create(fixture: Awaited<ReturnType<typeof setup>>) {
  const photo = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#669bff" },
  })
    .jpeg()
    .toBuffer();
  const body = new FormData();
  for (const [key, value] of Object.entries({
    name: "Pana Azul",
    description: "Me gusta tocar el cuatro.",
    style: "agile",
    color: "#669bff",
  }))
    body.set(key, value);
  body.append(
    "photos",
    new Blob([new Uint8Array(photo)], { type: "image/jpeg" }),
    "photo.jpg",
  );
  const response = await fixture.request("/api/creator/characters", {
    method: "POST",
    body,
  });
  assert.equal(response.status, 202);
  const { character } = await response.json();
  const until = Date.now() + 5_000;
  while (
    fixture.server.creator.db.character(character.id)?.status !== "ready"
  ) {
    assert.ok(Date.now() < until, "fixture should become ready");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return character.id as string;
}

test("generation budget is atomic and survives deletion and database reopen", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-budget-v31-"));
  const file = path.join(folder, "arena.sqlite");
  let db = new CreatorDatabase(file);
  try {
    for (const id of ["a", "b"])
      db.createUser({ id, name: id, email: `${id}@example.test` }, "unused");
    assert.equal(db.generationBudget("a", 3, 2, true), true);
    assert.equal(db.generationBudget("a", 3, 2, true), true);
    assert.equal(db.generationBudget("a", 3, 2, true), false);
    db.close();
    db = new CreatorDatabase(file);
    assert.equal(db.generationBudget("a", 3, 2, true), false);
    assert.equal(db.generationBudget("b", 3, 2, true), true);
    assert.equal(db.generationBudget("b", 3, 2, true), false);
    assert.equal(
      (
        db.db
          .prepare("SELECT COUNT(*) AS n FROM generation_attempts")
          .get() as { n: number }
      ).n,
      3,
    );
  } finally {
    db.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("generation limits reject invalid units and magnitudes at boot", () => {
  for (const value of [NaN, Infinity, 0, -1, 1.5, 1_000_000])
    assert.throws(() => creatorLimits({ concurrency: value }));
  assert.throws(() => creatorLimits({ concurrency: 2, capacity: 1 }));
  assert.equal(creatorLimits().jobTimeoutMs, 300_000);
});

test("a failed account write reports a server error and does not claim that the email is taken", async () => {
  const f = await setup();
  const signup = () =>
    f.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pana nuevo",
        email: "retry@example.test",
        password: "a-good-password",
      }),
    });
  try {
    f.server.creator.db.db.exec(
      "CREATE TRIGGER reject_user BEFORE INSERT ON users BEGIN SELECT RAISE(FAIL,'synthetic account write failure'); END;",
    );
    assert.equal((await signup()).status, 500);
    assert.equal(
      f.server.creator.db.userByEmail("retry@example.test"),
      undefined,
    );
    f.server.creator.db.db.exec("DROP TRIGGER reject_user");
    assert.equal((await signup()).status, 201);
  } finally {
    await f.close();
  }
});

test(
  "two independent graph runs complete while concurrent HTTP requests remain responsive",
  { timeout: 10_000 },
  async () => {
    const image = await atlas();
    let release!: () => void,
      started!: () => void,
      drawing = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const bothDrawing = new Promise<void>((resolve) => {
      started = resolve;
    });
    const f = await setup({
      design: async () => design,
      draw: async () => {
        if (++drawing === 2) started();
        await gate;
        return image;
      },
    });
    const user = {
      id: randomUUID(),
      name: "Otra pana",
      email: "other@example.test",
    };
    const token = randomBytes(32).toString("hex");
    f.server.creator.db.createUser(user, "unused");
    f.server.creator.db.saveSession(
      tokenHash(token),
      user.id,
      Date.now() + 60_000,
    );
    const other = {
      ...f,
      request: (url: string, options: RequestInit = {}) =>
        f.request(url, {
          ...options,
          headers: { ...options.headers, Cookie: `arena_session=${token}` },
        }),
    };
    let completed = false;
    const durations: number[] = [];
    try {
      const jobs = Promise.all([create(f), create(other)]).then((ids) => {
        completed = true;
        return ids;
      });
      await bothDrawing;
      const start = performance.now();
      const health = (async () => {
        do {
          await Promise.all(
            Array.from({ length: 4 }, async () => {
              const before = performance.now();
              const response = await f.request("/api/health");
              assert.equal(response.status, 200);
              await response.json();
              durations.push(performance.now() - before);
            }),
          );
          await new Promise((resolve) => setTimeout(resolve, 10));
        } while (
          (!completed || performance.now() - start < 400) &&
          performance.now() - start < 5_000
        );
      })();
      release();
      const [ids] = await Promise.all([jobs, health]);
      assert.notEqual(ids[0], ids[1]);
      assert.equal(f.server.creator.db.character(ids[1])?.owner_id, user.id);
      assert.equal(
        JSON.parse(f.server.creator.db.character(ids[1])!.character!)
          .creatorName,
        "Otra pana",
      );
      const sorted = durations.sort((a, b) => a - b);
      console.log(
        `creator-v31 two real graph/packing jobs + concurrent health: n=${sorted.length} p50=${sorted[Math.ceil(sorted.length * 0.5) - 1].toFixed(1)}ms p95=${sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(1)}ms max=${sorted.at(-1)!.toFixed(1)}ms; synthetic image provider`,
      );
    } finally {
      release();
      await f.close();
    }
  },
);

test("malformed and oversized JSON receive bounded client errors and health recovers", async () => {
  const f = await setup();
  try {
    const malformed = await f.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    const oversized = await f.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "x".repeat(40_000) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await f.request("/api/health")).status, 200);
  } finally {
    await f.close();
  }
});

test(
  "filesystem failure before drawing marks the job failed and a deliberate retry recovers",
  { timeout: 10_000 },
  async () => {
    const image = await atlas();
    let designs = 0,
      drawings = 0;
    const f = await setup({
      design: async () => {
        designs++;
        return design;
      },
      draw: async () => {
        drawings++;
        return image;
      },
    });
    try {
      const obstruction = path.join(f.folder, "characters");
      await writeFile(
        obstruction,
        "fixture path is a file instead of a directory",
      );
      const photo = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#669bff" },
      })
        .jpeg()
        .toBuffer();
      const body = new FormData();
      for (const [key, value] of Object.entries({
        name: "Pana Azul",
        description: "Me gusta tocar el cuatro.",
        style: "agile",
        color: "#669bff",
      }))
        body.set(key, value);
      body.append(
        "photos",
        new Blob([new Uint8Array(photo)], { type: "image/jpeg" }),
        "photo.jpg",
      );
      const response = await f.request("/api/creator/characters", {
        method: "POST",
        body,
      });
      assert.equal(response.status, 202);
      const id = (await response.json()).character.id;
      const waitFor = async (status: string) => {
        const until = Date.now() + 5_000;
        while (f.server.creator.db.character(id)?.status !== status) {
          assert.ok(Date.now() < until, `expected ${status}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      };
      await waitFor("failed");
      assert.equal(
        drawings,
        0,
        "do not request a paid image when its destination cannot be created",
      );
      assert.equal((await f.request("/api/health")).status, 200);
      await rm(obstruction);
      assert.equal(
        (
          await f.request(`/api/creator/characters/${id}/retry`, {
            method: "POST",
          })
        ).status,
        202,
      );
      await waitFor("ready");
      assert.equal(designs, 1);
      assert.equal(drawings, 1);
    } finally {
      await f.close();
    }
  },
);

test("concurrent publication and retirement cannot resurrect a deleted fighter or truncate the catalog", async () => {
  const image = await atlas();
  const f = await setup({
    design: async () => design,
    draw: async () => image,
  });
  try {
    const id = await create(f);
    const [publish, remove] = await Promise.all([
      f.request(`/api/creator/characters/${id}/publish`, { method: "POST" }),
      f.request(`/api/creator/characters/${id}`, { method: "DELETE" }),
    ]);
    assert.ok([200, 404, 409].includes(publish.status));
    assert.ok([200, 409].includes(remove.status));
    if (remove.status === 409)
      assert.equal(
        (await f.request(`/api/creator/characters/${id}`, { method: "DELETE" }))
          .status,
        200,
      );
    assert.equal(isFighter(id as Parameters<typeof isFighter>[0]), false);
    assert.ok(!f.server.creator.db.published().some((row) => row.id === id));
    assert.deepEqual(
      JSON.parse(await readFile(path.join(f.folder, "community.json"), "utf8")),
      [],
    );
  } finally {
    await f.close();
  }
});

test("parallel publishes of different characters commit a complete catalog", async () => {
  const image = await atlas();
  const f = await setup({
    design: async () => design,
    draw: async () => image,
  });
  try {
    const ids = [await create(f), await create(f)];
    const responses = await Promise.all(
      ids.map((id) =>
        f.request(`/api/creator/characters/${id}/publish`, { method: "POST" }),
      ),
    );
    assert.ok(responses.every((response) => response.status === 200));
    const catalog = JSON.parse(
      await readFile(path.join(f.folder, "community.json"), "utf8"),
    );
    assert.deepEqual(
      catalog.map((character: { id: string }) => character.id).sort(),
      ids.sort(),
    );
    for (const id of ids)
      assert.equal(
        (await f.request(`/api/creator/characters/${id}`, { method: "DELETE" }))
          .status,
        200,
      );
  } finally {
    await f.close();
  }
});

test(
  "failure of the derived JSON snapshot does not undo a committed publication or hide it from peers",
  { timeout: 10_000 },
  async () => {
    const image = await atlas();
    const f = await setup({
      design: async () => design,
      draw: async () => image,
    });
    const socket = new WebSocket(f.base.replace("http", "ws") + "/ws");
    const catalogs: { id: string }[][] = [];
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === "community") catalogs.push(message.characters);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      });
      const id = await create(f);
      await mkdir(path.join(f.folder, "community.json"));
      assert.equal(
        (
          await f.request(`/api/creator/characters/${id}/publish`, {
            method: "POST",
          })
        ).status,
        200,
      );
      const until = Date.now() + 2_000;
      while (
        !catalogs.some((catalog) =>
          catalog.some((character) => character.id === id),
        )
      ) {
        assert.ok(
          Date.now() < until,
          "peer must receive the committed catalog even if its disk snapshot fails",
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(f.server.creator.db.character(id)?.status, "published");
      await rm(path.join(f.folder, "community.json"), { recursive: true });
      assert.equal(
        (await f.request(`/api/creator/characters/${id}`, { method: "DELETE" }))
          .status,
        200,
      );
    } finally {
      socket.terminate();
      await f.close();
    }
  },
);

test(
  "shutdown drains an in-flight password hash before closing SQLite and is idempotent",
  { timeout: 10_000 },
  async () => {
    const f = await setup();
    let received!: () => void;
    const started = new Promise<void>((resolve) => {
      received = resolve;
    });
    const lookup = f.server.creator.db.userByEmail.bind(f.server.creator.db);
    f.server.creator.db.userByEmail = (email) => {
      const result = lookup(email);
      if (email === "new@example.test") received();
      return result;
    };
    try {
      const pending = f.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Pana nuevo",
          email: "new@example.test",
          password: "a-good-password",
        }),
      });
      await started;
      const closing = f.server.close();
      const response = await pending;
      assert.equal(response.status, 201);
      await closing;
      await f.server.close();
    } finally {
      await f.close();
    }
  },
);
