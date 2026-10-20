import test from "node:test";
import { get } from "node:http";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import express from "express";
import {
  losslessAssetDelivery,
  type LosslessAssetManifest,
} from "../server/asset-variants";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function fixture(
  run: (f: {
    url: string;
    root: string;
    source: Buffer;
    webp: Buffer;
    avif: Buffer;
    manifest: LosslessAssetManifest;
  }) => Promise<void>,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lossless-delivery-"));
  const source = Buffer.from("original-image-payload".repeat(10)),
    webp = Buffer.from("smaller-webp-payload"),
    avif = Buffer.from("avif");
  await mkdir(path.join(root, "assets/optimized"), { recursive: true });
  await writeFile(path.join(root, "assets/fighter.webp"), source);
  await writeFile(path.join(root, "assets/optimized/fighter.webp"), webp);
  await writeFile(path.join(root, "assets/optimized/fighter.avif"), avif);
  const manifest: LosslessAssetManifest = {
    schema: 1,
    assets: {
      "fighter.webp": {
        source: "assets/fighter.webp",
        sourceSha256: sha(source),
        variants: [
          {
            file: "assets/optimized/fighter.webp",
            sha256: sha(webp),
            bytes: webp.length,
            contentType: "image/webp",
          },
          {
            file: "assets/optimized/fighter.avif",
            sha256: sha(avif),
            bytes: avif.length,
            contentType: "image/avif",
          },
        ],
      },
    },
  };
  // These byte fixtures test delivery. Raster quality is verified by the encoder audit.
  const app = express();
  app.get("/assets/:file", losslessAssetDelivery(root, manifest));
  app.use(express.static(root));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run({
      url: `http://127.0.0.1:${address.port}`,
      root,
      source,
      webp,
      avif,
      manifest,
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
}

test("explicit AVIF clients receive the smallest verified variant with cache separation", async () =>
  fixture(async (f) => {
    const response = await fetch(`${f.url}/assets/fighter.webp`, {
      headers: { Accept: "image/avif,image/webp,*/*" },
    });
    assert.equal(response.headers.get("content-type"), "image/avif");
    assert.match(response.headers.get("vary")!, /Accept/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.avif);
    assert.match(response.headers.get("cache-control")!, /max-age=0/);
    assert.doesNotMatch(response.headers.get("cache-control")!, /immutable/);
  }));
test("wildcards and explicit AVIF q=0 retain WebP compatibility", async () =>
  fixture(async (f) => {
    for (const Accept of [
      "*/*",
      "image/*",
      "image/avif;q=0,image/webp;q=1,*/*;q=0.5",
    ]) {
      const response = await fetch(`${f.url}/assets/fighter.webp`, {
        headers: { Accept },
      });
      assert.equal(response.headers.get("content-type"), "image/webp");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.webp);
      assert.match(response.headers.get("vary")!, /Accept/);
    }
  }));
test("valid variant ETags support conditional 304 and HEAD", async () =>
  fixture(async (f) => {
    const url = `${f.url}/assets/fighter.webp`,
      headers = { Accept: "image/avif" };
    const first = await fetch(url, { headers });
    const etag = first.headers.get("etag");
    assert.ok(etag);
    await first.arrayBuffer();
    const cached = await new Promise<number | undefined>((resolve, reject) =>
      get(url, { headers: { ...headers, "If-None-Match": etag } }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }).on("error", reject),
    );
    assert.equal(cached, 304);
    const head = await fetch(url, { method: "HEAD", headers });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), String(f.avif.length));
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  }));
test("a missing or corrupt AVIF falls back to the verified WebP", async () =>
  fixture(async (f) => {
    const file = path.join(f.root, "assets/optimized/fighter.avif");
    for (const action of [
      () => rm(file),
      () => writeFile(file, Buffer.alloc(f.avif.length, 42)),
    ]) {
      await action();
      const response = await fetch(`${f.url}/assets/fighter.webp`, {
        headers: { Accept: "image/avif" },
      });
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.webp);
    }
  }));
test("source edits invalidate previously verified derivatives and preserve the new original", async () =>
  fixture(async (f) => {
    const url = `${f.url}/assets/fighter.webp`;
    const first = await fetch(url);
    await first.arrayBuffer();
    const changed = Buffer.from("new-artwork".repeat(20));
    await writeFile(path.join(f.root, "assets/fighter.webp"), changed);
    const response = await fetch(url);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), changed);
  }));
test("invalid checksums, oversized files and escaping paths fall back to the source", async () =>
  fixture(async (f) => {
    const entry = f.manifest.assets["fighter.webp"];
    entry.variants = entry.variants.filter(
      (v) => v.contentType === "image/webp",
    );
    entry.variants[0].sha256 = "0".repeat(64);
    let response = await fetch(`${f.url}/assets/fighter.webp`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.source);
    entry.variants[0].file = "../outside.webp";
    response = await fetch(`${f.url}/assets/fighter.webp`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.source);
    entry.variants[0] = {
      file: "assets/fighter.webp",
      sha256: sha(f.source),
      bytes: f.source.length,
      contentType: "image/webp",
    };
    response = await fetch(`${f.url}/assets/fighter.webp`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.source);
  }));
