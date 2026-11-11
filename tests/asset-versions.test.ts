import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assetVersion, assetVersions } from "../shared/asset-versions";
import manifest from "../shared/asset-versions.json";
import { assetUrl } from "../src/asset-url";
import { makeArenaServer } from "../server/index";

test("public asset manifest matches the contents on disk", async () => {
  assert.deepEqual(
    await assetVersions("public"),
    manifest,
    "Run npx tsx scripts/generate-asset-versions.ts",
  );
});

test("assetUrl versions known public files and leaves unknown URLs alone", () => {
  assert.equal(
    assetUrl("/fonts/dm-sans-400.woff2"),
    `/fonts/dm-sans-400.woff2?v=${manifest["/fonts/dm-sans-400.woff2"]}`,
  );
  assert.equal(
    assetUrl("/api/community/assets/custom_1/sprite.webp"),
    "/api/community/assets/custom_1/sprite.webp",
  );
  assert.equal(assetUrl("/assets/missing.webp"), "/assets/missing.webp");
});

test("only current versions are immutable, including negotiated backgrounds", async (t) => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-version-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = path.join(folder, "dist");
  await mkdir(path.join(root, "assets"), { recursive: true });
  await mkdir(path.join(root, "fonts"), { recursive: true });
  await mkdir(path.join(root, "audio/arcade"), { recursive: true });
  await writeFile(path.join(root, "index.html"), await readFile("index.html"));
  for (const file of [
    "assets/og-arena-criolla.jpg",
    "assets/caracas.webp",
    "assets/caracas.avif",
    "fonts/dm-sans-400.woff2",
    "audio/arcade/male-hurt-1.mp3",
  ]) {
    await writeFile(
      path.join(root, file),
      await readFile(path.join("public", file)),
    );
  }
  const cwd = process.cwd();
  let server: Awaited<ReturnType<typeof makeArenaServer>>;
  try {
    process.chdir(folder);
    server = await makeArenaServer({
      production: true,
      creator: {
        dataDir: path.join(folder, "data"),
        databasePath: ":memory:",
        provider: null,
      },
    });
  } finally {
    process.chdir(cwd);
  }
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  for (const file of [
    "/assets/caracas.webp",
    "/fonts/dm-sans-400.woff2",
    "/audio/arcade/male-hurt-1.mp3",
  ]) {
    const version = await assetVersion(root, file);
    for (const [query, immutable] of [
      ["", false],
      [`?v=${version}`, true],
      ["?v=wrong", false],
    ] as const) {
      const response = await fetch(base + file + query, {
        method: "HEAD",
        headers: { Accept: "image/avif,image/webp,*/*" },
      });
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("cache-control")?.includes("immutable"),
        immutable,
      );
      if (file.includes("caracas"))
        assert.match(response.headers.get("vary")!, /Accept/);
    }
  }
  const old = await assetVersion(root, "/assets/caracas.webp");
  await writeFile(
    path.join(root, "assets/caracas.avif"),
    "changed representation",
  );
  const changed = await fetch(`${base}/assets/caracas.webp?v=${old}`, {
    method: "HEAD",
    headers: { Accept: "image/avif" },
  });
  assert.doesNotMatch(changed.headers.get("cache-control")!, /immutable/);
});
