import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
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
  const imageUrl = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1];
  assert.ok(imageUrl);
  assert.match(
    imageUrl,
    /^https:\/\/arena\.example\/assets\/og-arena-criolla-[a-f0-9]{16}\.jpg$/,
  );
  assert.match(html, /property="og:image:type"\s+content="image\/jpeg"/);
  assert.equal(
    html.match(/name="twitter:image"\s+content="([^"]+)"/)?.[1],
    imageUrl,
  );
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(!html.includes("__ARENA_") && !html.includes("PRIVATE"));
  const structured = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(structured);
  assert.equal(JSON.parse(structured[1]).url, "https://arena.example/");
  assert.equal(JSON.parse(structured[1]).image, imageUrl);

  for (const route of ["/agradecimientos", "/agradecimientos/?room=PRIVATE"]) {
    const thanks = await fetch(base + route);
    assert.equal(thanks.status, 200);
    const page = await thanks.text();
    assert.ok(page.includes("<title>Agradecimientos — Arena Criolla</title>"));
    assert.ok(
      page.includes(
        '<link rel="canonical" href="https://arena.example/agradecimientos"',
      ),
    );
    assert.match(
      page,
      /property="og:title"\s+content="Agradecimientos — Arena Criolla"/,
    );
    assert.match(
      page,
      /name="twitter:title"\s+content="Agradecimientos — Arena Criolla"/,
    );
    assert.ok(page.includes("Giuseppe Gangi"));
    assert.ok(!page.includes("PRIVATE"));
    const data = page.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(data);
    assert.equal(JSON.parse(data[1])["@type"], "WebPage");
    assert.equal(
      JSON.parse(data[1]).url,
      "https://arena.example/agradecimientos",
    );
  }

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
  const sitemapXml = await sitemap.text();
  assert.ok(sitemapXml.includes("<loc>https://arena.example/</loc>"));
  assert.ok(
    sitemapXml.includes("<loc>https://arena.example/agradecimientos</loc>"),
  );
  const image = await fetch(base + new URL(imageUrl).pathname);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") ?? "", /image\/jpeg/);
  const imageBytes = Buffer.from(await image.arrayBuffer());
  const legacyImage = await fetch(`${base}/assets/og-arena-criolla.jpg`);
  assert.deepEqual(Buffer.from(await legacyImage.arrayBuffer()), imageBytes);
  const alias = await fetch(`${base}/index.html`, { redirect: "manual" });
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.get("location"), "/");
  for (const route of ["/index.html", "/INDEX.HTML/"]) {
    const query = "?sala=ABC123&note=a%2Bb%2Fc&repeat=1&repeat=2";
    const invitation = await fetch(base + route + query, {
      redirect: "manual",
    });
    assert.equal(invitation.status, 308);
    assert.equal(invitation.headers.get("location"), "/" + query);
    const home = await (await fetch(base + route + query)).text();
    assert.ok(
      home.includes('<link rel="canonical" href="https://arena.example/"'),
    );
    assert.ok(!home.includes("ABC123"));
  }
});

test("social previews get a new image URL when the deployed JPEG changes", async (t) => {
  const previous = process.cwd();
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-social-cache-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(path.join(folder, "dist/assets"), { recursive: true });
  await writeFile(
    path.join(folder, "dist/index.html"),
    await readFile("index.html"),
  );
  const current = await readFile("public/assets/og-arena-criolla.jpg");
  const updated = await sharp(current).jpeg({ quality: 60 }).toBuffer();
  const urls: string[] = [];

  for (const bytes of [current, current, updated]) {
    await writeFile(
      path.join(folder, "dist/assets/og-arena-criolla.jpg"),
      bytes,
    );
    let server: Awaited<ReturnType<typeof makeArenaServer>>;
    try {
      process.chdir(folder);
      server = await makeArenaServer({
        production: true,
        creator: {
          dataDir: path.join(folder, "private"),
          databasePath: ":memory:",
          provider: null,
        },
      });
    } finally {
      process.chdir(previous);
    }
    try {
      await new Promise<void>((resolve) =>
        server.http.listen(0, "127.0.0.1", resolve),
      );
      const address = server.http.address();
      assert.ok(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}`;
      for (const agent of [
        "Twitterbot/1.0",
        "facebookexternalhit/1.1",
        "LinkedInBot/1.0",
      ]) {
        const page = await fetch(base, { headers: { "User-Agent": agent } });
        assert.equal(page.headers.get("cache-control"), "no-store");
        const html = await page.text();
        const imageUrl = html.match(
          /property="og:image"\s+content="([^"]+)"/,
        )?.[1];
        assert.ok(imageUrl);
        const imagePath = new URL(imageUrl).pathname;
        assert.match(
          imagePath,
          /^\/assets\/og-arena-criolla-[a-f0-9]{16}\.jpg$/,
        );
        assert.equal(
          html.match(/name="twitter:image"\s+content="([^"]+)"/)?.[1],
          imageUrl,
        );
        assert.ok(!html.includes("__ARENA_"));
        const image = await fetch(base + imagePath, {
          headers: { "User-Agent": agent, Accept: "image/avif,image/webp,*/*" },
          redirect: "manual",
        });
        assert.equal(image.status, 200);
        assert.equal(image.headers.get("content-type"), "image/jpeg");
        assert.equal(
          image.headers.get("cache-control"),
          "public, max-age=31536000, immutable",
        );
        assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
        if (agent === "Twitterbot/1.0") urls.push(imagePath);
        else assert.equal(imagePath, urls.at(-1));
      }
      if (urls.length === 3) {
        const retired = await fetch(base + urls[1], { redirect: "manual" });
        assert.equal(retired.status, 302);
        assert.equal(retired.headers.get("location"), urls[2]);
        assert.equal(retired.headers.get("cache-control"), "no-store");
        const refreshed = await fetch(base + urls[1]);
        assert.deepEqual(Buffer.from(await refreshed.arrayBuffer()), updated);
      }
    } finally {
      await server.close();
    }
  }
  assert.equal(
    urls[0],
    urls[1],
    "unchanged images keep a stable URL across deploys",
  );
  assert.notEqual(
    urls[1],
    urls[2],
    "changed images must never reuse a cached URL",
  );
});
