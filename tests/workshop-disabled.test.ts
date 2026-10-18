import test from "node:test";
import assert from "node:assert/strict";
import { makeArenaServer } from "../server/index";

test("the public game blocks every workshop and account route even with a configured provider", async (t) => {
  let paidCalls = 0;
  const server = await makeArenaServer({
    serveClient: false,
    creator: {
      databasePath: ":memory:",
      provider: {
        design: async () => {
          paidCalls++;
          throw new Error("Must not generate");
        },
        draw: async () => {
          paidCalls++;
          throw new Error("Must not generate");
        },
      },
    },
  });
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const routes = [
    "/api/creator",
    "/api/creator/capabilities",
    "/api/creator/characters",
    "/api/creator/characters/custom_example/photos/0",
    "/api/creator/characters/custom_example/retry",
    "/api/creator/characters/custom_example/publish",
    "/api/creator/requests/example",
    "/api/auth",
    "/api/auth/signup",
    "/api/auth/signin",
    "/api/auth/session",
    "/api/auth/signout",
  ];
  for (const route of routes) {
    for (const method of ["GET", "POST", "PUT", "DELETE"]) {
      const response = await fetch(base + route, {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              body: "{malformed",
            }
          : {}),
      });
      assert.equal(
        response.status,
        404,
        `${method} ${route} must be unavailable`,
      );
      assert.match(
        response.headers.get("content-type") ?? "",
        /application\/json/,
      );
      assert.equal(response.headers.get("cache-control"), "no-store");
      await response.json();
    }
  }
  assert.equal(paidCalls, 0);
  assert.equal(
    server.creator.db.db.prepare("SELECT count(*) AS count FROM users").get()!
      .count,
    0,
  );
  assert.equal(
    server.creator.db.db
      .prepare("SELECT count(*) AS count FROM characters")
      .get()!.count,
    0,
  );
  const catalog = await fetch(base + "/api/community/characters");
  assert.equal(catalog.status, 200);
  assert.deepEqual(await catalog.json(), { characters: [] });
  assert.equal((await fetch(base + "/api/health")).status, 200);
});
