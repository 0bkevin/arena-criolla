import "dotenv/config";
import express from "express";
import { makeCreatorService, type CreatorOptions } from "./creator/router";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { isFighter, isStage } from "../shared/content";
import { isRoomCode, normalizeRoomCode } from "../shared/room-code";
import {
  ACTIONS,
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";
import type {
  ClientMessage,
  RoomPlayer,
  ServerMessage,
} from "../shared/protocol";
import { FixedStepTicker } from "./ticker";
import { INPUT_TIMEOUT_MS } from "../shared/network";
import { currentUser, sessionToken, tokenHash } from "./creator/auth";
import { RankingStore } from "./ranking";
import { RankedGames } from "./ranked";
import type { Client, Room } from "./arena-types";
const cleanName = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f<>]/g, "")
        .trim()
        .slice(0, 20) || "Pana"
    : "Pana";
const cleanWins = (value: unknown) =>
  Number.isFinite(value)
    ? Math.min(9999, Math.max(0, Math.floor(Number(value))))
    : 0;
const releaseHeld = (input: Input) => {
  input.left = input.right = input.block = input.down = false;
};

export async function makeArenaServer(
  options: {
    serveClient?: boolean;
    production?: boolean;
    creator?: CreatorOptions;
    rankedReconnectMs?: number;
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  let notifyCommunity = () => {};
  let endSession = (_hash: string) => {};
  const creator = makeCreatorService({
    ...(options.creator ??
      (options.serveClient === false ? { databasePath: ":memory:" } : {})),
    onCatalogChange: () => notifyCommunity(),
    onSessionEnd: (hash) => endSession(hash),
  });
  app.use("/api", creator.router);
  const http = createServer(app);
  const connections = new Set<import("node:net").Socket>();
  http.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const clients = new Map<string, Client>();
  const rooms = new Map<string, Room>();
  const ranking = new RankingStore(creator.databasePath);

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
  const publishRoom = (room: Room) =>
    room.clients.forEach((c) => {
      if (c.room === room.view.code) send(c, { type: "room", room: room.view });
    });
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
  const publishList = (recipient?: Client) => {
    if (!roomListCache) roomListCache = roomListMessage();
    const encoded = roomListCache;
    if (recipient) sendEncoded(recipient, encoded);
    else clients.forEach((client) => sendEncoded(client, encoded));
  };
  let roomListTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRoomList = () => {
    roomListCache = "";
    if (roomListTimer) return;
    roomListTimer = setTimeout(() => {
      roomListTimer = null;
      publishList();
    }, 100);
  };
  const error = (client: Client, message: string) =>
    send(client, { type: "error", message });
  const ranked = new RankedGames({
    rooms,
    clients,
    db: creator.db,
    store: ranking,
    send,
    publishRoom,
    roomsChanged: scheduleRoomList,
    allowedFighter,
    reconnectMs: options.rankedReconnectMs,
  });
  endSession = (hash) =>
    clients.forEach((client) => {
      if (client.sessionHash === hash) client.socket.terminate();
    });
  const leave = (client: Client, notify = true) => {
    if (notify && ranked.leave(client)) return;
    const room = client.room && rooms.get(client.room);
    client.room = null;
    client.input = emptyInput();
    if (room) {
      const wasPlaying =
        room.view.status === "playing" || room.view.status === "finished";
      room.clients = room.clients.filter((c) => c.id !== client.id);
      room.view.players = room.view.players.filter((p) => p.id !== client.id);
      if (room.view.ranked) {
        room.clients = room.clients.filter(
          (c) =>
            c.room === room.view.code && c.socket.readyState === WebSocket.OPEN,
        );
        room.view.players = room.view.players.filter((p) =>
          room.clients.some((c) => c.id === p.id),
        );
      }
      room.state = null;
      room.view.status = "waiting";
      room.view.players.forEach((p) => {
        p.ready = false;
      });
      if (room.clients.length === 0) rooms.delete(room.view.code);
      else {
        room.view.host = room.clients[0].id;
        if (wasPlaying)
          room.clients.forEach((c) => send(c, { type: "opponent-left" }));
        publishRoom(room);
      }
      scheduleRoomList();
    }
    if (notify) send(client, { type: "left" });
  };
  const start = async (room: Room) => {
    if (
      room.view.starting ||
      room.clients.length !== 2 ||
      !room.view.players.every((p) => p.ready)
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
      scheduleRoomList();
      return;
    }
    const [first, second] = room.view.players;
    const state = createMatch(
      room.view.stage,
      room.view.ranked
        ? [
            { ...first, wins: 3 },
            { ...second, wins: 3 },
          ]
        : [first, second],
      randomUUID(),
    );
    if (room.view.ranked) {
      try {
        if (!(await ranked.prepare(room, state))) {
          room.view.players.forEach((player) => {
            player.ready = false;
          });
          publishRoom(room);
          return;
        }
      } catch (failure) {
        room.view.players.forEach((player) => {
          player.ready = false;
        });
        room.clients.forEach((client) =>
          error(
            client,
            failure instanceof Error
              ? failure.message
              : "No pudimos preparar la clasificatoria.",
          ),
        );
        publishRoom(room);
        return;
      }
    }
    room.clients.forEach((c) => {
      c.input = emptyInput();
      c.inputAt = performance.now();
    });
    room.state = state;
    room.view.status = "playing";
    room.touched = Date.now();
    room.clients.forEach((c, index) =>
      send(c, {
        type: "start",
        state: room.state!,
        index,
        ...(room.view.ranked ? { ranked: true } : {}),
      }),
    );
    publishRoom(room);
    scheduleRoomList();
  };

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", rooms: rooms.size, players: clients.size }),
  );
  app.get("/api/rooms", (_req, res) =>
    res.json([...rooms.values()].filter((r) => !r.private).map((r) => r.view)),
  );
  app.get("/api/ranking", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      res.json(await ranking.request("board", null));
    } catch {
      res
        .status(503)
        .json({ error: "El ranking no está disponible. Inténtalo de nuevo." });
    }
  });
  app.get("/api/ranking/me", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = currentUser(req, creator.db);
    if (!user) {
      res
        .status(401)
        .json({ error: "Inicia sesión para consultar tu historial." });
      return;
    }
    try {
      res.json(
        await ranking.request("profile", { id: user.id, name: user.name }),
      );
    } catch {
      res
        .status(503)
        .json({
          error: "No pudimos consultar tu historial. Inténtalo de nuevo.",
        });
    }
  });
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
    if (clients.size >= 300) {
      socket.end(
        "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        () => socket.destroy(),
      );
      return;
    }
    const origin = request.headers.origin;
    let trusted = false;
    try {
      const parsed = new URL(origin ?? "");
      trusted =
        ["http:", "https:"].includes(parsed.protocol) &&
        parsed.host === request.headers.host &&
        parsed.origin === origin;
    } catch {}
    if ((origin && !trusted) || (sessionToken(request) && !trusted)) {
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
    const user = currentUser(request, creator.db);
    const token = sessionToken(request);
    const client: Client = {
      id: randomUUID(),
      socket,
      room: null,
      input: emptyInput(),
      inputAt: performance.now(),
      alive: true,
      messages: 0,
      controls: 0,
      lists: 0,
      pings: 0,
      window: performance.now(),
      account: user ? { id: user.id, name: user.name } : null,
      sessionHash: token ? tokenHash(token) : null,
    };
    clients.set(client.id, client);
    send(client, { type: "welcome", id: client.id, account: client.account });
    sendEncoded(client, communityPayload(), true);
    publishList(client);
    scheduleRoomList();
    socket.on("pong", () => {
      client.alive = true;
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      clients.delete(client.id);
      if (!ranked.disconnect(client)) leave(client, false);
      scheduleRoomList();
    });
    socket.on("message", (raw) => {
      const now = Date.now();
      const messageAt = performance.now();
      if (messageAt - client.window >= 1000) {
        client.window = messageAt;
        client.messages = 0;
        client.controls = 0;
        client.lists = 0;
        client.pings = 0;
      }
      // Allow a bounded burst after network jitter. Never silently discard the
      // final release: sustained excess closes the peer and releases its input.
      if (++client.messages > 360) {
        releaseHeld(client.input);
        client.socket.close(1008, "Demasiados mensajes.");
        return;
      }
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
      if (message.type === "ping") {
        if (
          ++client.pings <= 5 &&
          Number.isFinite(message.sentAt) &&
          message.sentAt >= 0
        )
          send(client, { type: "pong", sentAt: message.sentAt });
        return;
      }
      const current = client.room ? rooms.get(client.room) : undefined;
      const acceptControl = () => {
        if (++client.controls <= 30) return true;
        error(
          client,
          "Estás eligiendo demasiado rápido. Espera un momento y vuelve a intentarlo.",
        );
        if (client.controls === 31 && current)
          send(client, { type: "room", room: current.view });
        return false;
      };
      if (message.type === "list") {
        if (++client.lists > 5) return;
        publishList(client);
        return;
      }
      if (message.type === "leave") {
        leave(client);
        return;
      }
      if (
        message.type === "resume" &&
        typeof message.matchId === "string" &&
        message.matchId.length <= 100
      ) {
        void ranked
          .resume(client, message.matchId)
          .catch(() =>
            send(client, {
              type: "resume-unavailable",
              message: "No pudimos recuperar esa pelea. Consulta el ranking.",
            }),
          );
        return;
      }
      if (
        message.type === "abandon" &&
        typeof message.matchId === "string" &&
        message.matchId.length <= 100
      ) {
        void ranked
          .abandon(client, message.matchId)
          .catch(() =>
            error(
              client,
              "No pudimos confirmar el abandono. Reintentaremos al reconectar.",
            ),
          );
        return;
      }
      if (message.type === "create") {
        const rankedRoom = message.ranked === true;
        if (current) {
          error(client, "Primero sal de tu sala actual.");
          return;
        }
        if (rankedRoom) {
          try {
            ranked.canEnter(client);
          } catch (failure) {
            error(client, (failure as Error).message);
            return;
          }
        }
        if (!allowedFighter(message.fighter) || !isStage(message.stage)) {
          error(client, "Elige un luchador y un escenario válidos.");
          return;
        }
        if (rooms.size >= 100) {
          error(client, "La arena está llena. Intenta de nuevo en un momento.");
          return;
        }
        let code: string;
        do {
          code = randomBytes(16).toString("hex").toUpperCase();
        } while (rooms.has(code));
        const name = cleanName(
          rankedRoom ? client.account!.name : message.name,
        );
        const player: RoomPlayer = {
          id: client.id,
          name,
          fighter: message.fighter,
          ready: false,
          wins: rankedRoom ? 0 : cleanWins(message.wins),
          ...(rankedRoom ? { connected: true } : {}),
        };
        const room: Room = {
          view: {
            code,
            name: `La sala de ${name}`,
            stage: message.stage,
            players: [player],
            status: "waiting",
            host: client.id,
            ...(rankedRoom ? { ranked: true } : {}),
          },
          clients: [client],
          private: Boolean(message.private),
          state: null,
          touched: now,
        };
        rooms.set(code, room);
        client.room = code;
        publishRoom(room);
        scheduleRoomList();
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
        if (room.view.ranked) {
          try {
            ranked.canEnter(client, room);
          } catch (failure) {
            error(client, (failure as Error).message);
            return;
          }
        }
        room.clients.push(client);
        room.view.players.push({
          id: client.id,
          name: cleanName(
            room.view.ranked ? client.account!.name : message.name,
          ),
          fighter: message.fighter,
          ready: false,
          wins: room.view.ranked ? 0 : cleanWins(message.wins),
          ...(room.view.ranked ? { connected: true } : {}),
        });
        room.touched = now;
        client.room = room.view.code;
        publishRoom(room);
        scheduleRoomList();
        return;
      }
      if (!current) return;
      if (
        current.view.starting &&
        ["select", "ready", "rematch"].includes(message.type)
      ) {
        error(
          client,
          "La clasificatoria se está preparando. Espera un momento.",
        );
        return;
      }
      if (message.type === "select" && current.view.status === "waiting") {
        const player = current.view.players.find((p) => p.id === client.id)!;
        const nextFighter = allowedFighter(message.fighter)
          ? message.fighter
          : player.fighter;
        const nextWins = current.view.ranked
          ? player.wins
          : allowedFighter(message.fighter)
            ? cleanWins(message.wins)
            : player.wins;
        const nextStage =
          client.id === current.view.host && isStage(message.stage)
            ? message.stage
            : current.view.stage;
        const fighterChange =
          player.fighter !== nextFighter || player.wins !== nextWins;
        const stageChange = current.view.stage !== nextStage;
        if ((fighterChange || stageChange) && acceptControl()) {
          if (fighterChange) {
            player.fighter = nextFighter;
            player.wins = nextWins;
            player.ready = false;
          }
          if (stageChange) {
            current.view.stage = nextStage;
            current.view.players.forEach((p) => {
              p.ready = false;
            });
          }
          publishRoom(current);
          scheduleRoomList();
        }
      }
      if (message.type === "ready" && current.view.status === "waiting") {
        if (typeof message.ready !== "boolean") return;
        const player = current.view.players.find((p) => p.id === client.id)!;
        if (player.ready !== message.ready && acceptControl()) {
          player.ready = message.ready;
          publishRoom(current);
          scheduleRoomList();
          if (message.ready) void start(current);
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
          if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000) return;
          safe.actions[action] = n;
        }
        client.input = safe;
        client.inputAt = performance.now();
      }
      if (message.type === "rematch" && current.view.status === "finished") {
        if (
          current.view.ranked &&
          current.view.players.some((p) => p.connected === false)
        ) {
          error(
            client,
            "Tu rival salió. Vuelve a la selección para buscar otra pelea.",
          );
          return;
        }
        const player = current.view.players.find((p) => p.id === client.id)!;
        if (!player.ready && acceptControl()) {
          player.ready = true;
          if (current.view.players.every((p) => p.ready)) void start(current);
          else publishRoom(current);
        }
      }
    });
  });

  let tick = 0;
  const ticker = new FixedStepTicker(1000 / 60, 5);
  const gameLoop = setInterval(() => {
    const due = ticker.advance(performance.now());
    for (let step = 0; step < due; step++) {
      tick++;
      rooms.forEach((room) => {
        if (
          !room.state ||
          room.view.status !== "playing" ||
          room.clients.length !== 2
        )
          return;
        if (room.view.reconnectUntil) return;
        for (const client of room.clients) {
          if (performance.now() - client.inputAt >= INPUT_TIMEOUT_MS)
            releaseHeld(client.input);
        }
        stepMatch(room.state, [room.clients[0].input, room.clients[1].input]);
        if (tick % 2 === 0 || room.state.phase === "finished")
          room.clients.forEach((c) =>
            send(c, { type: "state", state: room.state! }),
          );
        if (room.state.phase === "finished") {
          if (room.view.ranked) {
            ranked.complete(room);
            return;
          }
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
      if (!c.alive || (c.account && !ranked.authenticated(c)))
        c.socket.terminate();
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
    clearInterval(gameLoop);
    clearInterval(heartbeat);
    if (roomListTimer) clearTimeout(roomListTimer);
    wss.close();
  });

  let vite:
    Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
  if (options.serveClient !== false) {
    if (options.production) {
      const dist = path.resolve("dist");
      app.use(express.static(dist));
      app.get("/{*path}", (_req, res) =>
        res.sendFile(path.join(dist, "index.html"), { dotfiles: "allow" }),
      );
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
        appType: "spa",
      });
      app.use(vite.middlewares);
    }
  }
  let closing: Promise<void> | null = null;
  return {
    http,
    creator,
    clients,
    rooms,
    ranking,
    close: () =>
      (closing ??= (async () => {
        creator.stop();
        const rankedClosed = ranked.close();
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
          await rankedClosed;
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
