import test from "node:test";
import assert from "node:assert/strict";
import { creatorRequest } from "../src/creator-api";

test("account requests explain a lost connection and allow callers to retry", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    creatorRequest("/api/auth/signup"),
    /No pudimos conectar con el taller/,
  );
});

test("account requests reject unreadable successful responses instead of claiming success", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Proxy unavailable</html>", { status: 200 }),
  );
  await assert.rejects(
    creatorRequest("/api/auth/signup"),
    /No pudimos conectar con el taller/,
  );
});

test("account requests preserve server validation errors and same-origin credentials", async (t) => {
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, _options?: RequestInit) =>
      new Response(
        JSON.stringify({ error: "Ese correo ya tiene una cuenta." }),
        { status: 409 },
      ),
  );
  await assert.rejects(
    creatorRequest("/api/auth/signup", { method: "POST", body: "{}" }),
    /Ese correo ya tiene una cuenta/,
  );
  const options = mock.mock.calls[0].arguments[1];
  assert.ok(options);
  assert.equal(options.credentials, "same-origin");
  assert.equal(
    new Headers(options.headers).get("Content-Type"),
    "application/json",
  );
});
