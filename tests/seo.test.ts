import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { makeArenaServer } from "../server/index";
import { publicSiteOrigin } from "../server/seo";

test("public site configuration accepts only HTTP(S) origins", () => {
  assert.equal(publicSiteOrigin(undefined), undefined);
  assert.equal(publicSiteOrigin(""), undefined);
  assert.equal(
    publicSiteOrigin("https://arena.example/"),
    "https://arena.example",
  );
  for (const invalid of [
    "invalid",
    "javascript:alert(1)",
    "https://user:pass@arena.example",
    "https://arena.example/game",
    "https://arena.example/?room=123",
    "https://arena.example/#game",
  ]) {
    assert.throws(() => publicSiteOrigin(invalid));
  }
});

test("crawlers receive complete metadata and public URLs without executing JavaScript", async (t) => {
  const original = process.env.ARENA_PUBLIC_URL;
  process.env.ARENA_PUBLIC_URL = "https://arena.example";
  t.after(() => {
    if (original === undefined) delete process.env.ARENA_PUBLIC_URL;
    else process.env.ARENA_PUBLIC_URL = original;
  });
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-seo-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const server = await makeArenaServer({
    creator: { dataDir: folder, databasePath: ":memory:", provider: null },
  });
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${base}/?room=PRIVATE`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(
    html.includes('<link rel="canonical" href="https://arena.example/"'),
  );
  assert.match(
    html,
    /property="og:image"\s+content="https:\/\/arena\.example\/assets\/og-arena-criolla\.png"/,
  );
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(!html.includes("__ARENA_") && !html.includes("PRIVATE"));
  const structured = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(structured);
  assert.equal(JSON.parse(structured[1]).url, "https://arena.example/");

  for (const route of [
    "/create",
    "/create/",
    "/create/saved?room=PRIVATE",
    "/CREATE?room=PRIVATE",
  ]) {
    const legacy = await fetch(base + route, { redirect: "manual" });
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.get("location"), "/");
    assert.equal(legacy.headers.get("cache-control"), "no-store");
    const home = await (await fetch(base + route)).text();
    assert.ok(
      home.includes('<link rel="canonical" href="https://arena.example/"'),
    );
    assert.ok(!home.includes("arena.example/create"));
  }
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.ok(robots.includes("Sitemap: https://arena.example/sitemap.xml"));
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.match(sitemap.headers.get("content-type") ?? "", /application\/xml/);
  assert.ok(
    (await sitemap.text()).includes("<loc>https://arena.example/</loc>"),
  );
  const image = await fetch(`${base}/assets/og-arena-criolla.png`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") ?? "", /image\/png/);
  const alias = await fetch(`${base}/index.html`, { redirect: "manual" });
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.get("location"), "/");
});
