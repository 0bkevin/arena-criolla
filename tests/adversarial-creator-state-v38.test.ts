import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { request as httpRequest } from "node:http";
import sharp from "sharp";
import { makeArenaServer } from "../server/index";
import { tokenHash } from "../server/creator/auth";

async function fixture() {
  const folder = await mkdtemp(path.join(os.tmpdir(), "creator-state-v38-"));
  let draws = 0;
  const provider = {
    design: async () => ({
      title: "Pana azul",
      specialName: "Paso azul",
      outfit: "Chaqueta azul y botas.",
      likeness: "Cabello corto y lentes.",
      welcome: "Saludo",
      combos: ["Uno", "Dos", "Tres"] as [string, string, string],
    }),
    draw: async () => {
      draws++;
      throw new Error("Synthetic failed drawing, no paid calls");
    },
  };
  let server = await makeArenaServer({
    workshopEnabled: true,
    serveClient: false,
    creator: { dataDir: folder, provider, secureCookies: false },
  });
  let base = "";
  const listen = async () => {
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  };
  await listen();
  const users = ["first", "second"].map((name) => {
    const user = { id: randomUUID(), name, email: `${name}@example.test` };
    server.creator.db.createUser(user, "unused");
    const token = randomBytes(32).toString("hex");
    server.creator.db.saveSession(
      tokenHash(token),
      user.id,
      Date.now() + 60_000,
    );
    return { ...user, cookie: `arena_session=${token}` };
  });
  const photo = await sharp({
    create: { width: 20, height: 30, channels: 3, background: "#669bff" },
  })
    .jpeg()
    .toBuffer();
  const request = (
    url: string,
    options: RequestInit = {},
    account = users[0],
  ) =>
    fetch(base + url, {
      ...options,
      headers: { Origin: base, Cookie: account.cookie, ...options.headers },
    });
  const upload = (
    key: string,
    name = "Pana Azul",
    account = users[0],
    otherPhoto = photo,
  ) => {
    const body = new FormData();
    for (const [field, value] of Object.entries({
      name,
      description: "Soy fan de las arepas y la salsa.",
      style: "agile",
      color: "#669bff",
    }))
      body.set(field, value);
    body.append(
      "photos",
      new Blob([new Uint8Array(otherPhoto)], { type: "image/jpeg" }),
      "photo.jpg",
    );
    return request(
      "/api/creator/characters",
      { method: "POST", headers: { "Idempotency-Key": key }, body },
      account,
    );
  };
  const waitFailed = async (id: string) => {
    const until = Date.now() + 3_000;
    while (server.creator.db.character(id)?.status !== "failed") {
      assert.ok(
        Date.now() < until,
        "synthetic generation should fail promptly",
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  return {
    get server() {
      return server;
    },
    get base() {
      return base;
    },
    folder,
    users,
    request,
    upload,
    waitFailed,
    get draws() {
      return draws;
    },
    async restart() {
      await server.close();
      server = await makeArenaServer({
        workshopEnabled: true,
        serveClient: false,
        creator: { dataDir: folder, provider: null, secureCookies: false },
      });
      await listen();
    },
    async close() {
      await server.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}

test("deleted creation keys remain tombstoned across restart and cannot reserve another paid attempt", async () => {
  const f = await fixture();
  try {
    const key = randomUUID();
    const first = await f.upload(key);
    assert.equal(first.status, 202);
    const id = (await first.json()).character.id;
    await f.waitFailed(id);
    assert.equal(
      (await f.request(`/api/creator/characters/${id}`, { method: "DELETE" }))
        .status,
      200,
    );
    const replay = await f.upload(key);
    assert.equal(
      replay.status,
      410,
      "an accepted then deleted key must never create again",
    );
    assert.equal(f.draws, 1);
    assert.equal(
      f.server.creator.db.db
        .prepare("SELECT COUNT(*) AS n FROM generation_attempts")
        .get()?.n,
      1,
    );
    await f.restart();
    assert.equal(
      (
        await f.request("/api/creator/characters", {
          method: "POST",
          headers: { "Idempotency-Key": key },
        })
      ).status,
      410,
    );
    assert.equal(f.server.creator.db.owned(f.users[0].id).length, 0);
  } finally {
    await f.close();
  }
});

test("discarding a pre-network or still-uploading request fences its late POST without spending a generation attempt", async () => {
  const f = await fixture();
  try {
    const beforeNetwork = randomUUID();
    assert.equal(
      (
        await f.request(`/api/creator/requests/${beforeNetwork}`, {
          method: "DELETE",
        })
      ).status,
      200,
    );
    assert.equal((await f.upload(beforeNetwork)).status, 410);
    const key = randomUUID();
    let admitted!: () => void;
    const preflight = new Promise<void>((resolve) => {
      admitted = resolve;
    });
    const budget = f.server.creator.db.generationBudget.bind(
      f.server.creator.db,
    );
    f.server.creator.db.generationBudget = (...args) => {
      const result = budget(...args);
      if (!args[3]) admitted();
      return result;
    };
    const form = new FormData();
    for (const [field, value] of Object.entries({
      name: "Pana Azul",
      description: "Soy fan de las arepas y la salsa.",
      style: "agile",
      color: "#669bff",
    }))
      form.set(field, value);
    const image = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "blue" },
    })
      .jpeg()
      .toBuffer();
    form.append(
      "photos",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      "photo.jpg",
    );
    const encoded = new Request(f.base, { method: "POST", body: form });
    const bytes = Buffer.from(await encoded.arrayBuffer());
    let upload!: ReturnType<typeof httpRequest>;
    const response = new Promise<number>((resolve, reject) => {
      upload = httpRequest(
        f.base + "/api/creator/characters",
        {
          method: "POST",
          headers: {
            Origin: f.base,
            Cookie: f.users[0].cookie,
            "Idempotency-Key": key,
            "Content-Type": encoded.headers.get("content-type")!,
            "Content-Length": bytes.length,
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode!));
        },
      );
      upload.on("error", reject);
    });
    upload.write(bytes.subarray(0, bytes.length - 8));
    await preflight;
    assert.equal(
      (await f.request(`/api/creator/requests/${key}`, { method: "DELETE" }))
        .status,
      200,
    );
    upload.end(bytes.subarray(bytes.length - 8));
    assert.equal(await response, 410);
    assert.equal(f.draws, 0);
    assert.equal(
      f.server.creator.db.db
        .prepare("SELECT COUNT(*) AS n FROM generation_attempts")
        .get()?.n,
      0,
    );
    assert.deepEqual(
      await readdir(path.join(f.folder, "uploads")).catch(() => []),
      [],
    );
  } finally {
    await f.close();
  }
});

test("legacy accepted keys migrate without another paid call and bind matching normalized photo content", async () => {
  const f = await fixture();
  try {
    const key = randomUUID();
    const first = await f.upload(key);
    const id = (await first.json()).character.id;
    await f.waitFailed(id);
    f.server.creator.db.db.exec("DROP TABLE creation_requests");
    await f.restart();
    assert.equal(
      f.server.creator.db.creationReceipt(f.users[0].id, key)?.payload_hash,
      null,
    );
    assert.equal((await f.upload(key, "Different draft")).status, 409);
    const recovered = await f.upload(key);
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).character.id, id);
    assert.match(
      f.server.creator.db.creationReceipt(f.users[0].id, key)?.payload_hash ||
        "",
      /^[a-f0-9]{64}$/,
    );
    assert.equal(f.draws, 1);
  } finally {
    await f.close();
  }
});

test("zero-cost cancellation receipts have bounded daily admission and existing receipts remain usable", async () => {
  const f = await fixture();
  try {
    const keys = Array.from({ length: 25 }, () => randomUUID());
    for (const key of keys.slice(0, 24))
      assert.equal(
        (await f.request(`/api/creator/requests/${key}`, { method: "DELETE" }))
          .status,
        200,
      );
    assert.equal(
      (
        await f.request(`/api/creator/requests/${keys[24]}`, {
          method: "DELETE",
        })
      ).status,
      429,
    );
    assert.equal(
      (
        await f.request(`/api/creator/requests/${keys[0]}`, {
          method: "DELETE",
        })
      ).status,
      200,
    );
    assert.equal(f.draws, 0);
  } finally {
    await f.close();
  }
});

test("a request key binds to the input and photo bytes, while bodyless recovery works with generation disabled", async () => {
  const f = await fixture();
  try {
    const key = randomUUID();
    const first = await f.upload(key);
    assert.equal(first.status, 202);
    const id = (await first.json()).character.id;
    await f.waitFailed(id);
    assert.equal(
      (await f.upload(key, "Pana Rojo")).status,
      409,
      "changed input must not silently return an unrelated creation",
    );
    const changedPhoto = await sharp({
      create: { width: 20, height: 30, channels: 3, background: "#ff0000" },
    })
      .jpeg()
      .toBuffer();
    assert.equal(
      (await f.upload(key, "Pana Azul", f.users[0], changedPhoto)).status,
      409,
      "changed photo must not be accepted under an old key",
    );
    assert.equal((await f.upload(key)).status, 200);
    await f.restart();
    const recovery = await f.request("/api/creator/characters", {
      method: "POST",
      headers: { "Idempotency-Key": key },
    });
    assert.equal(recovery.status, 200);
    assert.equal((await recovery.json()).character.id, id);
    assert.equal((await f.upload(key)).status, 200);
    assert.equal(f.draws, 1);
    assert.equal(
      f.server.creator.db.db
        .prepare("SELECT COUNT(*) AS n FROM generation_attempts")
        .get()?.n,
      1,
    );
  } finally {
    await f.close();
  }
});

test("UUID letter case cannot bypass accepted-request identity", async () => {
  const f = await fixture();
  try {
    const key = "abcdefff-1234-4abc-8def-0123456789ab";
    const first = await f.upload(key);
    const id = (await first.json()).character.id;
    await f.waitFailed(id);
    const replay = await f.upload(key.toUpperCase());
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).character.id, id);
    assert.equal(f.server.creator.db.owned(f.users[0].id).length, 1);
    assert.equal(f.draws, 1);
  } finally {
    await f.close();
  }
});

test("a tab bound to one account cannot read, upload, or sign out the account selected by another tab", async () => {
  const f = await fixture();
  try {
    const stale = { "X-Creator-Owner": f.users[0].id };
    const mine = await f.request(
      "/api/creator/characters",
      { headers: stale },
      f.users[1],
    );
    assert.equal(mine.status, 409);
    assert.equal((await mine.json()).code, "SESSION_CHANGED");
    const body = new FormData();
    body.set("name", "Private original-account draft");
    const denied = await f.request(
      "/api/creator/characters",
      { method: "POST", headers: stale, body },
      f.users[1],
    );
    assert.equal(denied.status, 409);
    assert.equal(
      (
        await f.request(
          "/api/auth/signout",
          { method: "POST", headers: stale },
          f.users[1],
        )
      ).status,
      409,
    );
    assert.equal(
      (await (await f.request("/api/auth/session", {}, f.users[1])).json()).user
        .id,
      f.users[1].id,
    );
    assert.equal(f.server.creator.db.owned(f.users[1].id).length, 0);
    assert.deepEqual(
      await readdir(path.join(f.folder, "uploads")).catch(() => []),
      [],
    );
  } finally {
    await f.close();
  }
});
