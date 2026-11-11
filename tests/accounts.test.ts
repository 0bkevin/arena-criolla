import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { makeArenaServer } from "../server/index";

async function accountServer(secureCookies = false) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-accounts-"));
  const server = await makeArenaServer({
    workshopEnabled: true,
    serveClient: false,
    creator: { dataDir: folder, provider: null, secureCookies },
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const password = randomBytes(24).toString("hex");
  const request = (
    route: string,
    body?: unknown,
    cookie = "",
    headers: Record<string, string> = {},
  ) =>
    fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const signup = (body: object = {}) =>
    request("/api/auth/signup", {
      name: "Cuenta QA",
      email: "account@example.test",
      password,
      ...body,
    });
  const cookie = (response: Response) =>
    response.headers.get("set-cookie")?.split(";")[0] || "";
  return {
    server,
    folder,
    base,
    request,
    signup,
    cookie,
    password,
    close: async () => {
      await server.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}

test("signup rolls back the account when its initial session cannot be saved", async () => {
  const f = await accountServer();
  try {
    f.server.creator.db.db.exec(
      "CREATE TRIGGER reject_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(FAIL,'synthetic session write failure'); END;",
    );
    const failed = await f.signup();
    assert.equal(failed.status, 500);
    assert.equal(failed.headers.get("set-cookie"), null);
    assert.equal(
      Boolean(f.server.creator.db.userByEmail("account@example.test")),
      false,
      "a failed signup must leave the email available for retry",
    );
    f.server.creator.db.db.exec("DROP TRIGGER reject_session");
    const retried = await f.signup();
    assert.equal(retried.status, 201);
    const session = await f.request(
      "/api/auth/session",
      undefined,
      f.cookie(retried),
    );
    assert.equal((await session.json()).user.email, "account@example.test");
  } finally {
    await f.close();
  }
});

test("signup validates malformed input and name, email, and password boundaries", async () => {
  const f = await accountServer();
  try {
    const invalid = [
      null,
      [],
      {},
      { name: " " },
      { name: "A" },
      { name: "a".repeat(25) },
      { email: "not-an-email" },
      { email: "x@" },
      { email: "x".repeat(250) + "@example.test" },
      { email: 42 },
      { password: "x".repeat(7) },
      { password: "x".repeat(129) },
      { password: null },
    ];
    for (const value of invalid) {
      const body =
        value === null ||
        Array.isArray(value) ||
        Object.keys(value).length === 0
          ? value
          : {
              name: "Cuenta QA",
              email: "account@example.test",
              password: f.password,
              ...value,
            };
      const response = await f.request("/api/auth/signup", body);
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("set-cookie"), null);
    }
    assert.equal(
      Boolean(f.server.creator.db.userByEmail("account@example.test")),
      false,
    );
    for (const length of [8, 128]) {
      const response = await f.signup({
        name: length === 8 ? "QA" : "n".repeat(24),
        email: `valid-${length}@example.test`,
        password: f.password.padEnd(128, "x").slice(0, length),
      });
      assert.equal(response.status, 201);
    }
  } finally {
    await f.close();
  }
});

test("signup normalizes identity and creates a private usable session without generation enabled", async () => {
  const f = await accountServer();
  try {
    const response = await f.signup({
      name: "  María José  ",
      email: "  ACCOUNT@EXAMPLE.TEST  ",
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name"]);
    assert.equal(body.user.name, "María José");
    assert.equal(body.user.email, "account@example.test");
    const header = response.headers.get("set-cookie")!;
    assert.ok(/HttpOnly/i.test(header));
    assert.ok(/SameSite=Lax/i.test(header));
    assert.ok(/Path=\//i.test(header));
    const cookie = f.cookie(response);
    const session = await f.request("/api/auth/session", undefined, cookie);
    assert.equal(session.headers.get("cache-control"), "no-store");
    assert.deepEqual((await session.json()).user, body.user);
    assert.equal(
      (await f.request("/api/creator/characters", undefined, cookie)).status,
      200,
    );
    const duplicate = await f.signup({ email: "Account@Example.Test" });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.headers.get("set-cookie"), null);
  } finally {
    await f.close();
  }
});

test("concurrent duplicate signups create exactly one account and one session", async () => {
  const f = await accountServer();
  try {
    const responses = await Promise.all([f.signup(), f.signup(), f.signup()]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [201, 409, 409],
    );
    const counts = f.server.creator.db.db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM sessions) AS sessions",
      )
      .get();
    assert.equal(counts?.users, 1);
    assert.equal(counts?.sessions, 1);
    const successful = responses.find((response) => response.status === 201)!;
    assert.ok(
      (
        await (
          await f.request("/api/auth/session", undefined, f.cookie(successful))
        ).json()
      ).user,
    );
  } finally {
    await f.close();
  }
});

test("signin, signout, expiry, and malformed cookies preserve account isolation", async () => {
  const f = await accountServer();
  try {
    const created = await f.signup();
    const firstCookie = f.cookie(created);
    const other = await f.signup({ email: "other@example.test" });
    const otherCookie = f.cookie(other);
    const signin = await f.request("/api/auth/signin", {
      email: " ACCOUNT@EXAMPLE.TEST ",
      password: f.password,
    });
    assert.equal(signin.status, 200);
    const signedInCookie = f.cookie(signin);
    assert.ok(
      signedInCookie !== firstCookie,
      "signin creates a fresh session token",
    );
    for (const email of ["account@example.test", "missing@example.test"]) {
      const wrong = await f.request("/api/auth/signin", {
        email,
        password: f.password + "-wrong",
      });
      assert.equal(wrong.status, 401);
      assert.equal(wrong.headers.get("set-cookie"), null);
    }
    const logout = await f.request("/api/auth/signout", {}, signedInCookie);
    assert.equal(logout.status, 200);
    assert.ok(
      /Expires=Thu, 01 Jan 1970/i.test(logout.headers.get("set-cookie")!),
    );
    assert.equal(
      (
        await (
          await f.request("/api/auth/session", undefined, signedInCookie)
        ).json()
      ).user,
      null,
    );
    assert.equal(
      (await f.request("/api/creator/characters", undefined, signedInCookie))
        .status,
      401,
    );
    assert.equal(
      (
        await (
          await f.request("/api/auth/session", undefined, otherCookie)
        ).json()
      ).user.email,
      "other@example.test",
    );
    f.server.creator.db.db
      .prepare("UPDATE sessions SET expires_at=?")
      .run(Date.now() - 1);
    for (const cookie of [
      firstCookie,
      otherCookie,
      "arena_session=invalid",
      "arena_session=",
      "",
    ]) {
      assert.equal(
        (await (await f.request("/api/auth/session", undefined, cookie)).json())
          .user,
        null,
      );
    }
  } finally {
    await f.close();
  }
});

test("cross-site signup is rejected without creating an account", async () => {
  const f = await accountServer();
  try {
    const origins: Record<string, string>[] = [
      { Origin: "https://elsewhere.example" },
      { "Sec-Fetch-Site": "cross-site" },
    ];
    for (const headers of origins) {
      const response = await f.request(
        "/api/auth/signup",
        {
          name: "Cuenta QA",
          email: "account@example.test",
          password: f.password,
        },
        "",
        headers,
      );
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("set-cookie"), null);
    }
    assert.equal(
      Boolean(f.server.creator.db.userByEmail("account@example.test")),
      false,
    );
  } finally {
    await f.close();
  }
});

test("new accounts and their sessions survive restarting the server", async () => {
  const f = await accountServer();
  let second: Awaited<ReturnType<typeof makeArenaServer>> | undefined;
  try {
    const created = await f.signup();
    const { user } = await created.json();
    const cookie = f.cookie(created);
    await f.server.close();
    second = await makeArenaServer({
      workshopEnabled: true,
      serveClient: false,
      creator: { dataDir: f.folder, provider: null, secureCookies: false },
    });
    await new Promise<void>((resolve) =>
      second!.http.listen(0, "127.0.0.1", resolve),
    );
    const address = second.http.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const restored = await fetch(base + "/api/auth/session", {
      headers: { Cookie: cookie },
    });
    assert.deepEqual((await restored.json()).user, user);
    const signin = await fetch(base + "/api/auth/signin", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: f.password }),
    });
    assert.equal(signin.status, 200);
  } finally {
    await second?.close();
    await f.close();
  }
});

test("auth rate limits return a useful error without blocking session reads or the arena", async () => {
  const f = await accountServer();
  try {
    for (let n = 0; n < 30; n++) {
      assert.equal((await f.request("/api/auth/signup", {})).status, 400);
    }
    const limited = await f.signup();
    assert.equal(limited.status, 429);
    assert.equal(typeof (await limited.json()).error, "string");
    assert.equal(limited.headers.get("set-cookie"), null);
    assert.equal((await f.request("/api/auth/session")).status, 200);
    assert.equal((await f.request("/api/health")).status, 200);
    assert.equal(
      Boolean(f.server.creator.db.userByEmail("account@example.test")),
      false,
    );
  } finally {
    await f.close();
  }
});

test("secure deployments set and clear the same Secure HttpOnly session cookie", async () => {
  const f = await accountServer(true);
  try {
    const created = await f.signup();
    assert.equal(created.status, 201);
    assert.ok(/; Secure(?:;|$)/i.test(created.headers.get("set-cookie")!));
    assert.ok(/; HttpOnly(?:;|$)/i.test(created.headers.get("set-cookie")!));
    const logout = await f.request("/api/auth/signout", {}, f.cookie(created));
    assert.equal(logout.status, 200);
    assert.ok(/; Secure(?:;|$)/i.test(logout.headers.get("set-cookie")!));
    assert.ok(/Path=\//i.test(logout.headers.get("set-cookie")!));
  } finally {
    await f.close();
  }
});
