import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { request } from "node:http";
import path from "node:path";
import os from "node:os";
import type { AddressInfo } from "node:net";
import express from "express";
import { precompressedAssets } from "../server/precompressed";

const script = "export const x = 'arena criolla';\n".repeat(80);

async function withServer(
  run: (url: string, root: string) => Promise<void>,
  options: { gzipOnly?: boolean } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "precompressed-"));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "assets/app-12345678.js"), script);
  if (!options.gzipOnly)
    await writeFile(
      path.join(root, "assets/app-12345678.js.br"),
      brotliCompressSync(script),
    );
  await writeFile(
    path.join(root, "assets/app-12345678.js.gz"),
    gzipSync(script),
  );
  await writeFile(path.join(root, "assets/plain.js"), script);
  await writeFile(path.join(root, "assets/photo.webp"), "not text");
  await writeFile(path.join(root, "assets/photo.webp.br"), "never served");
  const app = express();
  app.use(precompressedAssets(root));
  app.use(express.static(root));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      root,
    );
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
}
const get = (url: string, encoding: string, extra: HeadersInit = {}) =>
  fetch(url, { headers: { "accept-encoding": encoding, ...extra } });

test("prefers brotli, then gzip, and decodes to the original bytes", async () => {
  await withServer(async (url) => {
    const br = await get(`${url}/assets/app-12345678.js`, "gzip, br");
    assert.equal(br.headers.get("content-encoding"), "br");
    assert.match(br.headers.get("content-type") ?? "", /javascript/);
    assert.equal(br.headers.get("vary"), "Accept-Encoding");
    assert.equal(await br.text(), script);
    const gz = await get(`${url}/assets/app-12345678.js`, "gzip");
    assert.equal(gz.headers.get("content-encoding"), "gzip");
    assert.equal(await gz.text(), script);
  });
});

test("falls back when the preferred or any variant is missing", async () => {
  await withServer(
    async (url) => {
      const fallback = await get(`${url}/assets/app-12345678.js`, "br, gzip");
      assert.equal(fallback.headers.get("content-encoding"), "gzip");
      const identity = await get(`${url}/assets/app-12345678.js`, "identity");
      assert.equal(identity.headers.get("content-encoding"), null);
      assert.equal(identity.headers.get("vary"), "Accept-Encoding");
      assert.equal(await identity.text(), script);
      const unbuilt = await get(`${url}/assets/plain.js`, "br");
      assert.equal(unbuilt.headers.get("content-encoding"), null);
      assert.equal(await unbuilt.text(), script);
    },
    { gzipOnly: true },
  );
});

test("revalidates compressed files and never compresses images or escapes the root", async () => {
  await withServer(async (url) => {
    const first = await get(`${url}/assets/app-12345678.js`, "br");
    const etag = first.headers.get("etag")!;
    await first.arrayBuffer();
    // fetch() rewrites conditional requests, so use the raw client here.
    const status = await new Promise<number | undefined>((resolve) =>
      request(
        `${url}/assets/app-12345678.js`,
        {
          headers: { "accept-encoding": "br", "if-none-match": etag },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      ).end(),
    );
    assert.equal(status, 304);
    const image = await get(`${url}/assets/photo.webp`, "br");
    assert.equal(image.headers.get("content-encoding"), null);
    assert.equal(await image.text(), "not text");
    const escape = await get(`${url}/assets/..%2f..%2fetc%2fpasswd.js`, "br");
    assert.equal(escape.headers.get("content-encoding"), null);
    assert.equal(escape.status, 404);
  });
});
