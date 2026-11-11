import "dotenv/config";
import express from "express";
import { assetVersion } from "./asset-versions";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  publicSiteOrigin,
  requestSiteOrigin,
  renderSiteHtml,
  siteSitemap,
} from "../shared/site";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { Lobby } from "../shared/lobby/lobby";
import { allowedWebSocketOrigin, securityHeaders } from "./security";
import assetVariants from "./asset-variants.json";
import { precompressedAssets } from "./precompressed";
import {
  losslessAssetDelivery,
  type LosslessAssetManifest,
} from "./asset-variants";

export async function makeArenaServer(
  options: {
    serveClient?: boolean;
    production?: boolean;
    trustProxy?: string[];
    roomReconnectGraceMs?: number;
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  const trustedProxies =
    options.trustProxy ??
    process.env.ARENA_TRUST_PROXY?.split(",")
      .map((proxy) => proxy.trim())
      .filter(Boolean);
  if (trustedProxies?.length) app.set("trust proxy", trustedProxies);
  const trustProxy = app.get("trust proxy fn") as (
    address: string,
    hop: number,
  ) => boolean;
  app.use(securityHeaders(options.production === true, trustProxy));
  const configuredOrigin =
    options.serveClient === false
      ? undefined
      : publicSiteOrigin(process.env.ARENA_PUBLIC_URL);
  const http = createServer(
    {
      headersTimeout: 10_000,
      requestTimeout: 30_000,
      keepAliveTimeout: 5_000,
      connectionsCheckingInterval: 1_000,
      maxHeaderSize: 16_384,
    },
    app,
  );
  const connections = new Set<import("node:net").Socket>();
  http.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const lobby = new Lobby<WebSocket>(
    {
      send: (socket, data, reliable) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount >= 256_000) {
          // Losing a reliable message such as `start` would leave the client in
          // a stale lobby; a state snapshot is replaced at the next update.
          if (reliable) socket.terminate();
          return;
        }
        socket.send(data);
      },
      replace: (socket) => socket.terminate(),
    },
    { reconnectGraceMs: options.roomReconnectGraceMs },
  );
  const { clients, rooms } = lobby;
  const unanswered = new WeakSet<WebSocket>();
  let closing: Promise<void> | null = null;

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", rooms: rooms.size, players: clients.size }),
  );
  app.get("/api/rooms", (_req, res) => res.json(lobby.publicRooms()));
  app.use("/api", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .status(404)
      .json({ error: "No encontramos esa ruta." });
  });
  http.on("upgrade", (request, socket, head) => {
    if (closing) {
      socket.end(
        "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        () => socket.destroy(),
      );
      return;
    }
    if (request.url?.split("?")[0] !== "/ws") {
      const protocols = (request.headers["sec-websocket-protocol"] ?? "")
        .split(",")
        .map((protocol) => protocol.trim());
      let pathname = "";
      try {
        pathname = new URL(request.url ?? "", "http://arena.local").pathname;
      } catch {}
      const viteHmr =
        options.serveClient !== false &&
        !options.production &&
        pathname === "/" &&
        (protocols.includes("vite-hmr") || protocols.includes("vite-ping"));
      if (viteHmr) return;
      socket.end(
        "HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        () => socket.destroy(),
      );
      return;
    }
    if (!allowedWebSocketOrigin(request, trustProxy)) {
      socket.end(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        () => socket.destroy(),
      );
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, request),
    );
  });
  wss.on("connection", (socket, request) => {
    const protocols = (request.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((protocol) => protocol.trim());
    const client = lobby.connect(socket, protocols);
    socket.on("pong", () => unanswered.delete(socket));
    socket.on("error", () => {});
    socket.on("close", () => lobby.disconnect(client, socket));
    socket.on("message", (raw: RawData) => {
      if (client.socket === socket) lobby.receive(client, raw.toString());
    });
  });

  // Drop sockets that miss a ping; the lobby frees or holds their seat.
  const heartbeat = setInterval(() => {
    clients.forEach(({ socket }) => {
      if (unanswered.has(socket)) socket.terminate();
      else {
        unanswered.add(socket);
        socket.ping();
      }
    });
  }, 15_000);
  http.on("close", () => {
    clearInterval(heartbeat);
    lobby.close();
    wss.close();
  });

  let vite:
    Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
  if (options.serveClient !== false) {
    const publicRoot = path.resolve(options.production ? "dist" : "public");
    const socialImage = await readFile(
      path.join(publicRoot, "assets/og-arena-criolla.jpg"),
    );
    // Social apps cache their own image copies. A changed JPEG needs a new URL.
    const socialImageVersion = createHash("sha256")
      .update(socialImage)
      .digest("hex")
      .slice(0, 16);
    const socialImagePath = `/assets/og-arena-criolla-${socialImageVersion}.jpg`;
    app.get(socialImagePath, (_req, res) => {
      res
        .set("Cache-Control", "public, max-age=31536000, immutable")
        .type("image/jpeg")
        .send(socialImage);
    });
    // Previously crawled pages may still reference a retired image version.
    app.get(/^\/assets\/og-arena-criolla-[a-f0-9]{16}\.jpg$/i, (_req, res) => {
      res.set("Cache-Control", "no-store").redirect(302, socialImagePath);
    });
    app.use(async (req, res, next) => {
      if (
        (req.method !== "GET" && req.method !== "HEAD") ||
        !/^\/(assets|fonts|audio)\//.test(req.path)
      )
        return next();
      try {
        if (req.query.v === undefined) return next();
        const version = await assetVersion(publicRoot, req.path);
        if (version)
          res.set(
            "Cache-Control",
            req.query.v === version
              ? "public, max-age=31536000, immutable"
              : "public, max-age=0, must-revalidate",
          );
        next();
      } catch (error) {
        next(error);
      }
    });
    app.get(
      "/assets/:file",
      losslessAssetDelivery(publicRoot, assetVariants as LosslessAssetManifest),
    );
    const optimizedBackground = path.resolve(
      options.production ? "dist" : "public",
      "assets/caracas.avif",
    );
    app.get("/assets/caracas.webp", (req, res, next) => {
      // One shared URL avoids fetching separate splash and gameplay backgrounds.
      // Explicit AVIF support is required; image/* alone is not sufficient.
      res.vary("Accept");
      if (!req.accepts().includes("image/avif")) return next();
      res.sendFile(optimizedBackground, (error) => {
        if (!error) return;
        if (
          (error as NodeJS.ErrnoException).code === "ENOENT" &&
          !res.headersSent
        )
          next();
        else next(error);
      });
    });
    app.get("/robots.txt", (req, res) => {
      const origin = requestSiteOrigin(req, configuredOrigin);
      res
        .type("text/plain")
        .send(
          `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
        );
    });
    app.get("/sitemap.xml", (req, res) => {
      res
        .type("application/xml")
        .send(siteSitemap(requestSiteOrigin(req, configuredOrigin)));
    });
    app.get("/index.html", (req, res) => {
      const query = req.originalUrl.indexOf("?");
      res.redirect(
        308,
        "/" + (query === -1 ? "" : req.originalUrl.slice(query)),
      );
    });
    if (options.production) {
      const dist = path.resolve("dist");
      const template = await readFile(path.join(dist, "index.html"), "utf8");
      app.use(precompressedAssets(dist));
      app.use(
        express.static(dist, {
          index: false,
          setHeaders: (res, file) => {
            // Bundles, lobby banners and generated cutouts change URL with content.
            const name = path.basename(file).replace(/\.(?:br|gz)$/, "");
            if (
              !res.hasHeader("Cache-Control") &&
              (/[-\w]+-[\w-]{8}\.(?:js|css)$/.test(name) ||
                /^lobby-cast-banner(?:-(?:mobile|tablet))?-[\w-]{8}\.webp$/.test(
                  name,
                ) ||
                /^entrance-(?:renny|capriles)-[a-f0-9]{12}\.(?:avif|webp)$/.test(
                  name,
                ))
            )
              res.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable",
              );
          },
        }),
      );
      app.get("/{*path}", (req, res) => {
        res
          .set("Cache-Control", "no-store")
          .type("html")
          .send(
            renderSiteHtml(
              template,
              requestSiteOrigin(req, configuredOrigin),
              socialImagePath,
              res.locals.cspNonce,
              req.path,
            ),
          );
      });
    } else {
      const { createServer: createViteServer } = await import("vite");
      vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: { server: http },
          fs: {
            deny: [
              ".env",
              ".env.*",
              "*.{crt,pem}",
              "**/.git/**",
              "**/data/**",
              "**/*.sqlite*",
            ],
          },
        },
        appType: "custom",
      });
      app.use(vite.middlewares);
      app.get("/{*path}", async (req, res) => {
        const template = await readFile(path.resolve("index.html"), "utf8");
        const html = renderSiteHtml(
          template,
          requestSiteOrigin(req, configuredOrigin),
          socialImagePath,
          undefined,
          req.path,
        );
        res
          .type("html")
          .send(await vite!.transformIndexHtml(req.originalUrl, html));
      });
    }
  }
  return {
    http,
    clients,
    rooms,
    close: () =>
      (closing ??= (async () => {
        lobby.close();
        clients.forEach((c) => c.socket.terminate());
        // Stop accepting connections first. Bound keep-alive/slow-client shutdown.
        const closed = new Promise<void>((resolve) =>
          http.close(() => resolve()),
        );
        const deadline = setTimeout(
          () => connections.forEach((socket) => socket.destroy()),
          5_000,
        );
        try {
          await vite?.close();
          await closed;
        } finally {
          clearTimeout(deadline);
        }
      })()),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT) || 5173;
  const server = await makeArenaServer({
    production: process.env.NODE_ENV === "production",
  });
  server.http.listen(port, "0.0.0.0", () =>
    console.log(`Arena Criolla lista en http://localhost:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      void server.close().then(() => process.exit(0));
    });
}
