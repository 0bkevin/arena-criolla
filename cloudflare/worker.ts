// Cloudflare Workers entry for Arena Criolla. Files in .cloudflare/public are
// served directly by Cloudflare; this Worker only sees requests that match no
// file (the HTML shell, /ws, /api/*, robots, sitemap) plus the AVIF swap.
import { renderSiteHtml, siteSitemap } from "../shared/site";
import site from "../.cloudflare/site.json";

export { ArenaLobby } from "./lobby";

interface Env {
  ASSETS: Fetcher;
  LOBBY: DurableObjectNamespace;
}

const BASE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), fullscreen=(self), gamepad=(self)",
  "Strict-Transport-Security": "max-age=31536000",
};

function withHeaders(response: Response, extra: Record<string, string> = {}) {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries({ ...BASE_HEADERS, ...extra }))
    result.headers.set(name, value);
  return result;
}
const json = (body: unknown, status = 200) =>
  withHeaders(Response.json(body, { status }), { "Cache-Control": "no-store" });
const redirect = (location: string, status: number, cache?: string) =>
  withHeaders(
    new Response(null, { status, headers: { Location: location } }),
    cache ? { "Cache-Control": cache } : {},
  );

function lobby(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName("global"));
}

function nonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
}

function html(request: Request, url: URL) {
  const value = nonce();
  const websocket = url.origin.replace(/^http/, "ws");
  const body = renderSiteHtml(
    site.template,
    url.origin,
    site.socialImagePath,
    value,
    url.pathname,
  );
  return withHeaders(
    new Response(request.method === "HEAD" ? null : body, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    {
      "Cache-Control": "no-store",
      "Content-Security-Policy": [
        "default-src 'self'",
        `script-src 'self' 'nonce-${value}'`,
        // React's dynamic positioning and animation use inline style values.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src 'self' ${websocket}`,
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join("; "),
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const read = request.method === "GET" || request.method === "HEAD";

    // One canonical host: www.arenacriolla.com redirects to the apex domain.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return redirect(url.toString(), 301, "public, max-age=86400");
    }

    if (pathname === "/ws") {
      const origin = request.headers.get("Origin");
      // Native clients send no Origin; browsers must be same-origin.
      if (origin !== null && origin !== url.origin)
        return new Response(null, { status: 403 });
      return lobby(env).fetch(request);
    }
    if (pathname === "/api/health" || pathname === "/api/rooms")
      return withHeaders(await lobby(env).fetch(request), {
        "Cache-Control": "no-store",
      });
    if (pathname.startsWith("/api/"))
      return json({ error: "No encontramos esa ruta." }, 404);
    if (!read) return withHeaders(new Response("Not Found", { status: 404 }));

    if (pathname === "/assets/caracas.webp") {
      // One shared URL for splash and gameplay; AVIF only when explicitly accepted.
      const accept = request.headers.get("Accept") ?? "";
      const target = accept.includes("image/avif")
        ? new URL("/assets/caracas.avif", url)
        : url;
      const asset = await env.ASSETS.fetch(new Request(target, request));
      return withHeaders(asset, { Vary: "Accept" });
    }
    if (/^\/assets\/og-arena-criolla-[a-f0-9]{16}\.jpg$/i.test(pathname))
      // Previously crawled pages may still reference a retired image version.
      return redirect(site.socialImagePath, 302, "no-store");
    if (pathname === "/robots.txt")
      return withHeaders(
        new Response(
          `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`,
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        ),
      );
    if (pathname === "/sitemap.xml")
      return withHeaders(
        new Response(siteSitemap(url.origin), {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        }),
      );
    if (pathname === "/index.html") return redirect("/" + url.search, 308);
    return html(request, url);
  },
} satisfies ExportedHandler<Env>;
