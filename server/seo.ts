import type { Request } from "express";

/** Pin the public origin behind a reverse proxy; otherwise use the request origin. */
export function publicSiteOrigin(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "ARENA_PUBLIC_URL must be an HTTP(S) origin, e.g. https://arena.example",
    );
  }
  return url.origin;
}

export function requestSiteOrigin(
  request: Request,
  configured?: string,
): string {
  return (
    configured ?? new URL(`${request.protocol}://${request.get("host")}`).origin
  );
}

export function renderSiteHtml(
  template: string,
  origin: string,
  pathname: string,
): string {
  // Room invitations and other query parameters must not become canonical URLs.
  const page = pathname === "/create" ? "/create" : "/";
  return template
    .replaceAll("__ARENA_ORIGIN__", origin)
    .replaceAll("__ARENA_PAGE_URL__", origin + page);
}

export function siteSitemap(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`;
}
