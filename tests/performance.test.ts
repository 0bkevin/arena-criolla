import test from "node:test";
import assert from "node:assert/strict";
import { makeArenaServer } from "../server/index";
import { get } from "node:http";


test("production caches fingerprinted assets and negotiates one shared background", async () => {
  const { copyFile, mkdtemp, mkdir, writeFile, rm } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const folder = await mkdtemp(path.join(tmpdir(), "arena-cache-test-"));
  const previous = process.cwd();
  let server: Awaited<ReturnType<typeof makeArenaServer>> | undefined;
  try {
    await mkdir(path.join(folder, "dist/assets"), { recursive: true });
    await copyFile(
      "public/assets/og-arena-criolla.jpg",
      path.join(folder, "dist/assets/og-arena-criolla.jpg"),
    );
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
