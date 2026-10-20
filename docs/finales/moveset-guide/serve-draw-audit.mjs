// Static only: Vite HMR can reset a long audit when another character is edited.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { guideInputs } from "./build-tools.mjs";
const root = process.cwd(), port = Number(process.env.GUIDE_AUDIT_PORT ?? 5193);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".ttf": "font/ttf" };
http.createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/guide-audit-current-inputs.json") {
      const { fingerprint } = await guideInputs();
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ fingerprint }));
      return;
    }
    const relative = pathname.startsWith("/assets/") || pathname.startsWith("/fonts/") ? `public${pathname}` : pathname.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const bytes = await fs.readFile(file);
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Draw audit without HMR: http://localhost:${port}/docs/finales/moveset-guide/draw-audit.html`));
