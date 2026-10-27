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
  socialImagePath: string,
  nonce?: string,
  pathname = "/",
): string {
  // Room invitations and other query parameters must not become canonical URLs.
  const acknowledgements = /^\/agradecimientos\/?$/.test(pathname);
  const pagePath = acknowledgements ? "/agradecimientos" : "/";
  let html = template
    .replaceAll("__ARENA_SOCIAL_IMAGE_PATH__", socialImagePath)
    .replaceAll("__ARENA_ORIGIN__", origin)
    .replaceAll("__ARENA_PAGE_URL__", origin + pagePath);
  if (acknowledgements) {
    const title = "Agradecimientos — Arena Criolla";
    const description =
      "Gracias a la comunidad de Asilo Digital por la difusión y las primeras pruebas, y a Giuseppe Gangi por donar el dominio arenacriolla.com.";
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(
        /(<meta\s+(?:name|property)="(?:og:title|twitter:title)"\s+content=")[^"]*"/g,
        `$1${title}"`,
      )
      .replace(
        /(<meta\s+(?:name|property)="(?:description|og:description|twitter:description)"\s+content=")[^"]*"/g,
        `$1${description}"`,
      )
      .replace(
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description,
          url: origin + pagePath,
          inLanguage: "es",
          isPartOf: {
            "@type": "WebSite",
            name: "Arena Criolla",
            url: origin + "/",
          },
        })}</script>`,
      );
  }
  return nonce ? html.replace(/<script\b/g, `<script nonce="${nonce}"`) : html;
}

export function siteSitemap(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/agradecimientos</loc></url></urlset>\n`;
}
