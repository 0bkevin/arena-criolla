// Turn the Vite build in dist/ into the Cloudflare Workers upload in .cloudflare/.
// Static files are served by Cloudflare without invoking the Worker (free and
// unmetered), so headers and HTML rendering that Express did per request are
// either baked into _headers here or handled by the Worker for the few routes
// that need it.
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const out = path.resolve(".cloudflare");
const publicDir = path.join(out, "public");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(dist, publicDir, {
  recursive: true,
  // Cloudflare compresses text at the edge; the Worker renders the HTML shell.
  filter: (source) =>
    !/\.(?:br|gz)$/.test(source) && source !== path.join(dist, "index.html"),
});

const template = await readFile(path.join(dist, "index.html"), "utf8");
const socialImage = await readFile(
  path.join(dist, "assets/og-arena-criolla.jpg"),
);
// Social apps cache their own image copies. A changed JPEG needs a new URL.
const socialVersion = createHash("sha256")
  .update(socialImage)
  .digest("hex")
  .slice(0, 16);
const socialImagePath = `/assets/og-arena-criolla-${socialVersion}.jpg`;
await writeFile(path.join(publicDir, socialImagePath.slice(1)), socialImage);

const files = (await readdir(publicDir, { recursive: true }))
  .map((file) => file.split(path.sep).join("/"))
  .sort();
// Mirrors the content-addressed names server/index.ts marks immutable.
const immutable = files.filter((file) => {
  const name = path.posix.basename(file);
  return (
    /[-\w]+-[\w-]{8}\.(?:js|css)$/.test(name) ||
    /^lobby-cast-banner(?:-(?:mobile|tablet))?-[\w-]{8}\.webp$/.test(name) ||
    /^entrance-(?:renny|capriles)-[a-f0-9]{12}\.(?:avif|webp)$/.test(name) ||
    file === socialImagePath.slice(1)
  );
});
if (immutable.length > 90)
  throw new Error(`_headers supports 100 rules; ${immutable.length} needed`);
const headers = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: no-referrer",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=(), fullscreen=(self), gamepad=(self)",
  "  Strict-Transport-Security: max-age=31536000",
  ...immutable.flatMap((file) => [
    `/${file}`,
    "  Cache-Control: public, max-age=31536000, immutable",
  ]),
  "",
].join("\n");
await writeFile(path.join(publicDir, "_headers"), headers);
await writeFile(
  path.join(out, "site.json"),
  JSON.stringify({ template, socialImagePath }),
);
console.log(
  `Cloudflare bundle: ${files.length} assets, ${immutable.length} immutable, social image ${socialImagePath}`,
);
