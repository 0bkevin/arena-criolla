import test from "node:test";
import assert from "node:assert/strict";
import { creatorApi, CreatorRequestError } from "../src/creator-api";

test("browser requests bind private operations to the displayed account and preserve typed session failures", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; options?: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json(
      { code: "SESSION_CHANGED", error: "Session changed" },
      { status: 409 },
    );
  };
  try {
    for (const operation of [
      () => creatorApi.mine("account-a"),
      () => creatorApi.create(new FormData(), "request-key", "account-a"),
      () => creatorApi.retry("fighter", "account-a"),
      () => creatorApi.publish("fighter", "account-a"),
      () => creatorApi.remove("fighter", "account-a"),
      () => creatorApi.discardRequest("request-key", "account-a"),
      () => creatorApi.signOut("account-a"),
    ])
      await assert.rejects(
        operation(),
        (error: unknown) =>
          error instanceof CreatorRequestError &&
          error.status === 409 &&
          error.code === "SESSION_CHANGED",
      );
    assert.equal(calls.length, 7);
    for (const call of calls)
      assert.equal(
        new Headers(call.options?.headers).get("X-Creator-Owner"),
        "account-a",
      );
    assert.equal(
      new Headers(calls[1].options?.headers).get("Idempotency-Key"),
      "request-key",
    );
    assert.equal(
      new Headers(calls[1].options?.headers).has("Content-Type"),
      false,
      "fetch must provide the multipart boundary",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a lost creation response is bounded, aborted once and never automatically retried", async () => {
  const originalFetch = globalThis.fetch;
  const timeout = AbortSignal.timeout;
  const controller = new AbortController();
  let requests = 0,
    timeoutMs = 0;
  AbortSignal.timeout = (delay) => {
    timeoutMs = delay;
    return controller.signal;
  };
  globalThis.fetch = async (_url, options) => {
    requests++;
    assert.equal(options?.signal, controller.signal);
    return new Promise<Response>((_resolve, reject) =>
      controller.signal.addEventListener(
        "abort",
        () => reject(controller.signal.reason),
        { once: true },
      ),
    );
  };
  try {
    const pending = creatorApi.create(
      new FormData(),
      crypto.randomUUID(),
      "account-a",
    );
    controller.abort(
      new DOMException("Creation response timed out", "TimeoutError"),
    );
    await assert.rejects(pending, { name: "TimeoutError" });
    assert.equal(timeoutMs, 45_000);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = timeout;
  }
});
