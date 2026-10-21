import "dotenv/config";
import express from "express";
import { makeCreatorService, type CreatorOptions } from "./creator/router";
import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  publicSiteOrigin,
  requestSiteOrigin,
  renderSiteHtml,
  siteSitemap,
} from "./seo";
import { WebSocket, WebSocketServer } from "ws";
import { isFighter, isStage } from "../shared/content";
import { isRoomCode, normalizeRoomCode } from "../shared/room-code";
import {
  ACTIONS,
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";
import type {
  ClientMessage,
  RoomPlayer,
  RoomView,
  ServerMessage,
} from "../shared/protocol";
import {
  ARENA_SOCKET_PROTOCOL,
  ROOM_RESUME_PROTOCOL_PREFIX,
} from "../shared/protocol";
import { FixedStepTicker } from "./ticker";
import { allowedWebSocketOrigin, securityHeaders } from "./security";
import assetVariants from "../shared/asset-variants.json";
import {
  losslessAssetDelivery,
  type LosslessAssetManifest,
} from "./asset-variants";

interface Client {
  id: string;
  socket: WebSocket;
  room: string | null;
  nickname: string;
  input: Input;
  inputAt: number;
  alive: boolean;
  messages: number;
  controls: number;
  lists: number;
  window: number;
  resumeToken: string | null;
}
interface Room {
  view: RoomView;
  clients: Client[];
  private: boolean;
  state: MatchState | null;
  touched: number;
}
const INPUT_TIMEOUT_MS = 500;
const cleanName = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f<>]/g, "")
        .trim()
        .slice(0, 20)
    : "";
const cleanWins = (value: unknown) =>
  Number.isFinite(value)
    ? Math.min(9999, Math.max(0, Math.floor(Number(value))))
    : 0;

export async function makeArenaServer(
  options: {
    serveClient?: boolean;
    production?: boolean;
    creator?: CreatorOptions;
    // Explicit opt-in for the retained workshop's isolated tests and tooling.
    workshopEnabled?: boolean;
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
  let notifyCommunity = () => {};
  const workshopEnabled = options.workshopEnabled === true;
  const creator = makeCreatorService({
    ...(options.creator ??
      (options.serveClient === false ? { databasePath: ":memory:" } : {})),
    ...(!workshopEnabled ? { provider: null } : {}),
    onCatalogChange: () => notifyCommunity(),
  });
  if (!workshopEnabled) {
    app.use(["/api/creator", "/api/auth"], (_req, res) => {
      res
        .set("Cache-Control", "no-store")
        .status(404)
        .json({ error: "No encontramos esa ruta." });
    });
    app.get(/^\/create(?:\/.*)?$/i, (_req, res) => {
      res.set("Cache-Control", "no-store").redirect(302, "/");
    });
  }
  app.use("/api", creator.router);
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
  const clients = new Map<string, Client>();
  const rooms = new Map<string, Room>();
  const sessions = new Map<string, Client>();
  const resumeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const reconnectGraceMs = options.roomReconnectGraceMs ?? 5 * 60_000;
  let shuttingDown = false;

  const forgetSession = (client: Client) => {
    if (!client.resumeToken) return;
    clearTimeout(resumeTimers.get(client.resumeToken));
    resumeTimers.delete(client.resumeToken);
    sessions.delete(client.resumeToken);
  };

  const send = (client: Client, message: ServerMessage) => {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    if (client.socket.bufferedAmount >= 256_000) {
      // State is replaceable at the next simulation update. Losing a control
      // message such as `start` would leave the client in a stale lobby.
      if (message.type !== "state") client.socket.terminate();
      return;
    }
    client.socket.send(JSON.stringify(message));
  };
  const sendEncoded = (client: Client, message: string, reliable = false) => {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    if (client.socket.bufferedAmount >= 256_000) {
      if (reliable) client.socket.terminate();
      return;
    }
    client.socket.send(message);
  };
  const communityMessage = () => ({
    type: "community" as const,
    characters: creator.db.published().map((row) => JSON.parse(row.character!)),
  });
  let communityCache = "";
  const communityPayload = () => {
    if (!communityCache) communityCache = JSON.stringify(communityMessage());
    return communityCache;
  };
  notifyCommunity = () => {
    communityCache = JSON.stringify(communityMessage());
    clients.forEach((client) => sendEncoded(client, communityCache, true));
  };
  const allowedFighter = (
    id: unknown,
  ): id is import("../shared/content").FighterId =>
    isFighter(id) &&
    (!id.startsWith("custom_") ||
      creator.db.character(id)?.status === "published");
  const publishRoom = (room: Room) => {
    const message = JSON.stringify({ type: "room", room: room.view });
    room.clients.forEach((client) => sendEncoded(client, message, true));
  };
  const roomListMessage = () => {
    const list = [...rooms.values()]
      .filter(
        (r) =>
          !r.private && r.view.status === "waiting" && r.clients.length < 2,
      )
      .map((r) => r.view);
    return JSON.stringify({ type: "rooms", rooms: list, online: clients.size });
  };
  let roomListCache = "";
  let lastPublishedList = "";
  const publishList = (recipient?: Client) => {
    if (!roomListCache) roomListCache = roomListMessage();
    const encoded = roomListCache;
    if (recipient) sendEncoded(recipient, encoded);
    else if (encoded !== lastPublishedList) {
      lastPublishedList = encoded;
      clients.forEach((client) => sendEncoded(client, encoded));
    }
  };
  let roomListTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRoomList = (room?: Room) => {
    if (room?.private) return;
    roomListCache = "";
    if (roomListTimer) return;
    roomListTimer = setTimeout(() => {
      roomListTimer = null;
      publishList();
    }, 100);
  };
  const error = (client: Client, message: string) =>
    send(client, { type: "error", message });
  const leave = (client: Client, notify = true) => {
    forgetSession(client);
    const room = client.room && rooms.get(client.room);
    client.room = null;
    client.nickname = "";
    client.input = emptyInput();
    if (room) {
      const wasPlaying =
        room.view.status === "playing" || room.view.status === "finished";
      room.clients = room.clients.filter((c) => c.id !== client.id);
      room.view.players = room.view.players.filter((p) => p.id !== client.id);
      room.state = null;
      room.view.status = "waiting";
      room.view.players.forEach((p, index) => {
        p.ready = false;
        // Automatic labels follow the new slots; explicit legacy nicknames stay.
        p.name = room.clients[index].nickname || `Jugador ${index + 1}`;
      });
      if (room.clients.length === 0) rooms.delete(room.view.code);
      else {
        room.view.host = room.clients[0].id;
        if (wasPlaying)
          room.clients.forEach((c) => send(c, { type: "opponent-left" }));
        publishRoom(room);
      }
      scheduleRoomList(room);
    }
    if (notify) send(client, { type: "left" });
  };
  const start = (room: Room) => {
    if (
      room.clients.length !== 2 ||
      !room.view.players.every((p) => p.ready) ||
      room.view.players.some((player) => player.connected === false)
    )
      return;
    if (room.view.players.some((player) => !allowedFighter(player.fighter))) {
      room.view.status = "waiting";
      room.state = null;
      room.view.players.forEach((player) => {
        player.ready = false;
        if (!allowedFighter(player.fighter)) {
          player.fighter = "zavarce";
          player.wins = 0;
        }
      });
      room.clients.forEach((client) =>
        error(
          client,
          "Un personaje fue retirado. Elijan sus luchadores y marquen listo de nuevo.",
        ),
      );
      publishRoom(room);
      scheduleRoomList(room);
      return;
    }
    room.clients.forEach((c) => {
      c.input = emptyInput();
      c.inputAt = performance.now();
    });
    const [first, second] = room.view.players;
    room.state = createMatch(room.view.stage, [first, second], randomUUID());
    room.view.status = "playing";
    room.touched = Date.now();
    room.clients.forEach((c, index) =>
      send(c, { type: "start", state: room.state!, index }),
    );
    publishRoom(room);
    scheduleRoomList(room);
  };

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", rooms: rooms.size, players: clients.size }),
  );
  app.get("/api/rooms", (_req, res) =>
    res.json([...rooms.values()].filter((r) => !r.private).map((r) => r.view)),
  );
  http.on("upgrade", (request, socket, head) => {
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
    const resumable = protocols.includes(ARENA_SOCKET_PROTOCOL);
    const resumeToken = protocols
      .find((protocol) => protocol.startsWith(ROOM_RESUME_PROTOCOL_PREFIX))
      ?.slice(ROOM_RESUME_PROTOCOL_PREFIX.length);
    const previous =
      resumable && resumeToken ? sessions.get(resumeToken) : null;
    const resumed = Boolean(previous?.room && rooms.has(previous.room));
    const client: Client = resumed
      ? previous!
      : {
          id: randomUUID(),
          socket,
          room: null,
          nickname: "",
          input: emptyInput(),
          inputAt: performance.now(),
          alive: true,
          messages: 0,
          controls: 0,
          lists: 0,
          window: Date.now(),
          resumeToken: resumable ? randomBytes(32).toString("hex") : null,
        };
    if (resumed) {
      const oldSocket = client.socket;
      client.socket = socket;
      client.alive = true;
      if (client.resumeToken) {
        clearTimeout(resumeTimers.get(client.resumeToken));
        resumeTimers.delete(client.resumeToken);
      }
      oldSocket.terminate();
      const player = rooms
        .get(client.room!)
        ?.view.players.find((p) => p.id === client.id);
      if (player) player.connected = true;
    }
    clients.set(client.id, client);
    if (client.resumeToken) sessions.set(client.resumeToken, client);
    send(client, {
      type: "welcome",
      id: client.id,
      resumeToken: client.resumeToken ?? undefined,
      resumed,
    });
    sendEncoded(client, communityPayload(), true);
    publishList(client);
    if (resumed) {
      const room = rooms.get(client.room!)!;
      publishRoom(room);
      if (room.state)
        send(client, {
          type: "start",
          state: room.state,
          index: room.clients.indexOf(client),
        });
    }
    scheduleRoomList();
    socket.on("pong", () => {
      client.alive = true;
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      if (client.socket !== socket) return;
      clients.delete(client.id);
      const room = client.room ? rooms.get(client.room) : undefined;
      if (
        !shuttingDown &&
        client.resumeToken &&
        room?.view.status === "waiting"
      ) {
        client.input = emptyInput();
        room.view.players.forEach((player) => {
          player.ready = false;
          if (player.id === client.id) player.connected = false;
        });
        const timer = setTimeout(() => {
          resumeTimers.delete(client.resumeToken!);
          leave(client, false);
        }, reconnectGraceMs);
        timer.unref();
        resumeTimers.set(client.resumeToken, timer);
        publishRoom(room);
      } else leave(client, false);
      scheduleRoomList();
    });
    socket.on("message", (raw) => {
      if (client.socket !== socket) return;
      const now = Date.now();
      if (now - client.window >= 1000) {
        client.window = now;
        client.messages = 0;
        client.controls = 0;
        client.lists = 0;
      }
      if (++client.messages > 180) return;
      let message: ClientMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        error(client, "Ese mensaje no se pudo leer.");
        return;
      }
      if (
        !message ||
        typeof message !== "object" ||
        typeof message.type !== "string"
      )
        return;
      if (
        (message.type === "select" ||
          message.type === "ready" ||
          message.type === "rematch") &&
        ++client.controls > 30
      )
        return;
      const current = client.room ? rooms.get(client.room) : undefined;
      if (message.type === "list") {
        if (++client.lists > 5) return;
        publishList(client);
        return;
      }
      if (message.type === "leave") {
        leave(client);
        return;
      }
      if (message.type === "create") {
        if (current) {
          error(client, "Primero sal de tu sala actual.");
          return;
        }
        if (!allowedFighter(message.fighter) || !isStage(message.stage)) {
          error(client, "Elige un luchador y un escenario válidos.");
          return;
        }
        let code: string;
        do {
          code = randomBytes(16).toString("hex").toUpperCase();
        } while (rooms.has(code));
        const nickname = cleanName(message.name);
        client.nickname = nickname;
        const player: RoomPlayer = {
          id: client.id,
          name: nickname || "Jugador 1",
          fighter: message.fighter,
          ready: false,
          wins: cleanWins(message.wins),
        };
        const room: Room = {
          view: {
            code,
            name: nickname
              ? `La sala de ${nickname}`
              : `Sala ${code.slice(0, 6)}`,
            stage: message.stage,
            players: [player],
            status: "waiting",
            host: client.id,
          },
          clients: [client],
          private: Boolean(message.private),
          state: null,
          touched: now,
        };
        rooms.set(code, room);
        client.room = code;
        if (client.resumeToken) sessions.set(client.resumeToken, client);
        publishRoom(room);
        scheduleRoomList(room);
        return;
      }
      if (message.type === "join") {
        if (current) {
          error(client, "Ya estás en una sala.");
          return;
        }
        if (!isRoomCode(message.code) || !allowedFighter(message.fighter))
          return;
        const room = rooms.get(normalizeRoomCode(message.code));
        if (!room) {
          error(client, "No encontramos esa sala. Revisa el código.");
          return;
        }
        if (room.clients.length >= 2 || room.view.status !== "waiting") {
          error(client, "Esa sala está ocupada. Crea una nueva o elige otra.");
          return;
        }
        client.nickname = cleanName(message.name);
        room.clients.push(client);
        room.view.players.push({
          id: client.id,
          name: client.nickname || "Jugador 2",
          fighter: message.fighter,
          ready: false,
          wins: cleanWins(message.wins),
        });
        room.touched = now;
        client.room = room.view.code;
        if (client.resumeToken) sessions.set(client.resumeToken, client);
        publishRoom(room);
        scheduleRoomList(room);
        return;
      }
      if (!current) return;
      if (message.type === "select" && current.view.status === "waiting") {
        const player = current.view.players.find((p) => p.id === client.id)!;
        let changed = false;
        if (allowedFighter(message.fighter)) {
          const wins = cleanWins(message.wins);
          if (player.fighter !== message.fighter || player.wins !== wins) {
            player.fighter = message.fighter;
            player.wins = wins;
            player.ready = false;
            changed = true;
          }
        }
        if (
          client.id === current.view.host &&
          isStage(message.stage) &&
          current.view.stage !== message.stage
        ) {
          current.view.stage = message.stage;
          current.view.players.forEach((p) => {
            p.ready = false;
          });
          changed = true;
        }
        if (changed) {
          publishRoom(current);
          scheduleRoomList(current);
        }
      }
      if (message.type === "ready" && current.view.status === "waiting") {
        if (typeof message.ready !== "boolean") return;
        const player = current.view.players.find((p) => p.id === client.id)!;
        if (player.ready !== message.ready) {
          player.ready = message.ready;
          publishRoom(current);
          scheduleRoomList(current);
          if (message.ready) start(current);
        }
      }
      if (message.type === "input" && current.view.status === "playing") {
        if (message.matchId !== current.state?.id) return;
        const input = message.input;
        if (
          !input ||
          typeof input !== "object" ||
          !input.actions ||
          typeof input.actions !== "object"
        )
          return;
        const safe = emptyInput();
        safe.left = input.left === true;
        safe.right = input.right === true;
        safe.block = input.block === true;
        safe.down = input.down === true;
        for (const action of ACTIONS) {
          const n = input.actions[action];
          if (
            !Number.isSafeInteger(n) ||
            n < client.input.actions[action] ||
            n > 1_000_000_000
          )
            return;
          safe.actions[action] = n;
        }
        client.input = safe;
        client.inputAt = performance.now();
      }
      if (message.type === "rematch" && current.view.status === "finished") {
        const player = current.view.players.find((p) => p.id === client.id)!;
        if (!player.ready) {
          player.ready = true;
          if (current.view.players.every((p) => p.ready)) start(current);
          else publishRoom(current);
        }
      }
    });
  });

  let tick = 0;
  const ticker = new FixedStepTicker(1000 / 60, 5);
  const gameLoop = setInterval(() => {
    const now = performance.now();
    const due = ticker.advance(now);
    for (let step = 0; step < due; step++) {
      tick++;
      rooms.forEach((room) => {
        if (
          !room.state ||
          room.view.status !== "playing" ||
          room.clients.length !== 2
        )
          return;
        // A stalled or suspended client must not keep walking or guarding.
        // Preserve counters so expiring a hold cannot replay an old attack.
        room.clients.forEach((client) => {
          if (now - client.inputAt <= INPUT_TIMEOUT_MS) return;
          client.input.left = false;
          client.input.right = false;
          client.input.block = false;
          client.input.down = false;
        });
        stepMatch(room.state, [room.clients[0].input, room.clients[1].input]);
        if (tick % 2 === 0 || room.state.phase === "finished") {
          const message = JSON.stringify({ type: "state", state: room.state });
          room.clients.forEach((client) => sendEncoded(client, message));
        }
        if (room.state.phase === "finished") {
          room.view.status = "finished";
          room.view.players.forEach((p, index) => {
            p.ready = false;
            if (room.state!.winner === index) p.wins++;
          });
          publishRoom(room);
        }
      });
    }
  }, 1000 / 60);
  const heartbeat = setInterval(() => {
    clients.forEach((c) => {
      if (!c.alive) c.socket.terminate();
      else {
        c.alive = false;
        c.socket.ping();
      }
    });
    rooms.forEach((room) => {
      if (
        room.view.status !== "playing" &&
        Date.now() - room.touched > 60 * 60 * 1000
      )
        room.clients.slice().forEach((c) => leave(c));
    });
  }, 15_000);
  http.on("close", () => {
    resumeTimers.forEach(clearTimeout);
    resumeTimers.clear();
    sessions.clear();
    clearInterval(gameLoop);
    clearInterval(heartbeat);
    if (roomListTimer) clearTimeout(roomListTimer);
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
      app.use(
        express.static(dist, {
          index: false,
          setHeaders: (res, file) => {
            // Bundles, lobby banners and generated cutouts change URL with content.
            const name = path.basename(file);
            if (
              /[-\w]+-[\w-]{8}\.(?:js|css)$/.test(name) ||
              /^lobby-cast-banner(?:-(?:mobile|tablet))?-[\w-]{8}\.webp$/.test(
                name,
              ) ||
              /^entrance-(?:renny|capriles)-[a-f0-9]{12}\.(?:avif|webp)$/.test(
                name,
              )
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
              creator.dataDir.replaceAll("\\", "/") + "/**",
              creator.databasePath.replaceAll("\\", "/"),
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
        );
        res
          .type("html")
          .send(await vite!.transformIndexHtml(req.originalUrl, html));
      });
    }
  }
  let closing: Promise<void> | null = null;
  return {
    http,
    creator,
    clients,
    rooms,
    close: () =>
      (closing ??= (async () => {
        shuttingDown = true;
        creator.stop();
        clients.forEach((c) => c.socket.terminate());
        // Stop accepting connections first, but retain SQLite until in-flight auth,
        // uploads and catalog writes finish. Bound keep-alive/slow-client shutdown.
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
          await creator.close();
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
