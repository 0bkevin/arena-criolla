// Online lobby and authoritative match loop as one Cloudflare Durable Object.
// This is a port of the WebSocket section of server/index.ts; keep the two in
// step when the protocol or match rules change.
import { DurableObject } from "cloudflare:workers";
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
import { FixedStepTicker } from "../server/ticker";

interface Client {
  id: string;
  socket: WebSocket;
  room: string | null;
  nickname: string;
  input: Input;
  inputAt: number;
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

const INPUT_TIMEOUT_MS = 250;
const RECONNECT_GRACE_MS = 5 * 60_000;
const MAX_MESSAGE_BYTES = 4096;
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
const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export class ArenaLobby extends DurableObject {
  private clients = new Map<string, Client>();
  private rooms = new Map<string, Room>();
  private sessions = new Map<string, Client>();
  private resumeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private roomListCache = "";
  private lastPublishedList = "";
  private roomListTimer: ReturnType<typeof setTimeout> | null = null;
  private gameLoop: ReturnType<typeof setInterval> | null = null;
  private sweep: ReturnType<typeof setInterval> | null = null;
  private ticker = new FixedStepTicker(1000 / 60, 5);
  private tick = 0;

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health")
      return Response.json({
        status: "ok",
        rooms: this.rooms.size,
        players: this.clients.size,
      });
    if (url.pathname === "/api/rooms")
      return Response.json(
        [...this.rooms.values()].filter((r) => !r.private).map((r) => r.view),
      );
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response(null, { status: 426 });
    const protocols = (request.headers.get("Sec-WebSocket-Protocol") ?? "")
      .split(",")
      .map((protocol) => protocol.trim())
      .filter(Boolean);
    const pair = new WebSocketPair();
    const [browser, server] = [pair[0], pair[1]];
    server.accept();
    this.attach(server, protocols);
    const headers = new Headers();
    // Like `ws`, select the first offered subprotocol.
    if (protocols.length) headers.set("Sec-WebSocket-Protocol", protocols[0]);
    return new Response(null, { status: 101, webSocket: browser, headers });
  }

  private sendEncoded(client: Client, message: string) {
    try {
      client.socket.send(message);
    } catch {}
  }
  private send(client: Client, message: ServerMessage) {
    this.sendEncoded(client, JSON.stringify(message));
  }
  private error(client: Client, message: string) {
    this.send(client, { type: "error", message });
  }
  private forgetSession(client: Client) {
    if (!client.resumeToken) return;
    clearTimeout(this.resumeTimers.get(client.resumeToken));
    this.resumeTimers.delete(client.resumeToken);
    this.sessions.delete(client.resumeToken);
  }
  private publishRoom(room: Room) {
    const message = JSON.stringify({ type: "room", room: room.view });
    room.clients.forEach((client) => this.sendEncoded(client, message));
  }
  private roomListMessage() {
    const list = [...this.rooms.values()]
      .filter(
        (r) =>
          !r.private && r.view.status === "waiting" && r.clients.length < 2,
      )
      .map((r) => r.view);
    return JSON.stringify({
      type: "rooms",
      rooms: list,
      online: this.clients.size,
    });
  }
  private publishList(recipient?: Client) {
    if (!this.roomListCache) this.roomListCache = this.roomListMessage();
    const encoded = this.roomListCache;
    if (recipient) this.sendEncoded(recipient, encoded);
    else if (encoded !== this.lastPublishedList) {
      this.lastPublishedList = encoded;
      this.clients.forEach((client) => this.sendEncoded(client, encoded));
    }
  }
  private scheduleRoomList(room?: Room) {
    if (room?.private) return;
    this.roomListCache = "";
    if (this.roomListTimer) return;
    this.roomListTimer = setTimeout(() => {
      this.roomListTimer = null;
      this.publishList();
    }, 100);
  }

  private leave(client: Client, notify = true) {
    this.forgetSession(client);
    const room = client.room ? this.rooms.get(client.room) : undefined;
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
        p.name = room.clients[index].nickname || `Jugador ${index + 1}`;
      });
      if (room.clients.length === 0) this.rooms.delete(room.view.code);
      else {
        room.view.host = room.clients[0].id;
        if (wasPlaying)
          room.clients.forEach((c) => this.send(c, { type: "opponent-left" }));
        this.publishRoom(room);
      }
      this.scheduleRoomList(room);
    }
    if (notify) this.send(client, { type: "left" });
    this.updateTimers();
  }

  private start(room: Room) {
    if (
      room.clients.length !== 2 ||
      !room.view.players.every((p) => p.ready) ||
      room.view.players.some((player) => player.connected === false)
    )
      return;
    if (room.view.players.some((player) => !isFighter(player.fighter))) {
      room.view.status = "waiting";
      room.state = null;
      room.view.players.forEach((player) => {
        player.ready = false;
        if (!isFighter(player.fighter)) {
          player.fighter = "zavarce";
          player.wins = 0;
        }
      });
      room.clients.forEach((client) =>
        this.error(
          client,
          "Un personaje fue retirado. Elijan sus luchadores y marquen listo de nuevo.",
        ),
      );
      this.publishRoom(room);
      this.scheduleRoomList(room);
      return;
    }
    room.clients.forEach((c) => {
      c.input = emptyInput();
      c.inputAt = performance.now();
    });
    const [first, second] = room.view.players;
    room.state = createMatch(
      room.view.stage,
      [first, second],
      crypto.randomUUID(),
    );
    room.view.status = "playing";
    room.touched = Date.now();
    room.clients.forEach((c, index) =>
      this.send(c, { type: "start", state: room.state!, index }),
    );
    this.publishRoom(room);
    this.scheduleRoomList(room);
    this.updateTimers();
  }

  /** Run the 60 Hz loop only while a match is live, so idle lobbies cost nothing. */
  private updateTimers() {
    const playing = [...this.rooms.values()].some(
      (room) => room.view.status === "playing",
    );
    if (playing && !this.gameLoop) {
      this.ticker = new FixedStepTicker(1000 / 60, 5);
      this.gameLoop = setInterval(() => this.step(), 1000 / 60);
    } else if (!playing && this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    if (this.rooms.size && !this.sweep)
      this.sweep = setInterval(() => this.expireRooms(), 15_000);
    else if (!this.rooms.size && this.sweep) {
      clearInterval(this.sweep);
      this.sweep = null;
    }
  }

  private step() {
    const now = performance.now();
    const due = this.ticker.advance(now);
    for (let step = 0; step < due; step++) {
      this.tick++;
      this.rooms.forEach((room) => {
        if (
          !room.state ||
          room.view.status !== "playing" ||
          room.clients.length !== 2
        )
          return;
        // A stalled or suspended client must not keep walking or guarding.
        room.clients.forEach((client) => {
          if (now - client.inputAt <= INPUT_TIMEOUT_MS) return;
          client.input.left = false;
          client.input.right = false;
          client.input.block = false;
          client.input.down = false;
          client.input.superHeld = false;
        });
        stepMatch(room.state, [room.clients[0].input, room.clients[1].input]);
        if (this.tick % 2 === 0 || room.state.phase === "finished") {
          const message = JSON.stringify({ type: "state", state: room.state });
          room.clients.forEach((client) => this.sendEncoded(client, message));
        }
        if (room.state.phase === "finished") {
          room.view.status = "finished";
          room.view.players.forEach((p, index) => {
            p.ready = false;
            if (room.state!.winner === index) p.wins++;
          });
          this.publishRoom(room);
        }
      });
    }
    this.updateTimers();
  }

  private expireRooms() {
    this.rooms.forEach((room) => {
      if (
        room.view.status !== "playing" &&
        Date.now() - room.touched > 60 * 60 * 1000
      )
        room.clients.slice().forEach((c) => this.leave(c));
    });
  }

  private attach(socket: WebSocket, protocols: string[]) {
    const resumable = protocols.includes(ARENA_SOCKET_PROTOCOL);
    const resumeToken = protocols
      .find((protocol) => protocol.startsWith(ROOM_RESUME_PROTOCOL_PREFIX))
      ?.slice(ROOM_RESUME_PROTOCOL_PREFIX.length);
    const previous =
      resumable && resumeToken ? this.sessions.get(resumeToken) : null;
    const resumed = Boolean(previous?.room && this.rooms.has(previous.room));
    const client: Client = resumed
      ? previous!
      : {
          id: crypto.randomUUID(),
          socket,
          room: null,
          nickname: "",
          input: emptyInput(),
          inputAt: performance.now(),
          messages: 0,
          controls: 0,
          lists: 0,
          window: Date.now(),
          resumeToken: resumable ? randomHex(32) : null,
        };
    if (resumed) {
      const oldSocket = client.socket;
      client.socket = socket;
      if (client.resumeToken) {
        clearTimeout(this.resumeTimers.get(client.resumeToken));
        this.resumeTimers.delete(client.resumeToken);
      }
      try {
        oldSocket.close(4000, "replaced");
      } catch {}
      const player = this.rooms
        .get(client.room!)
        ?.view.players.find((p) => p.id === client.id);
      if (player) player.connected = true;
    }
    this.clients.set(client.id, client);
    if (client.resumeToken) this.sessions.set(client.resumeToken, client);
    this.send(client, {
      type: "welcome",
      id: client.id,
      resumeToken: client.resumeToken ?? undefined,
      resumed,
    });
    this.publishList(client);
    if (resumed) {
      const room = this.rooms.get(client.room!)!;
      this.publishRoom(room);
      if (room.state)
        this.send(client, {
          type: "start",
          state: room.state,
          index: room.clients.indexOf(client),
        });
    }
    this.scheduleRoomList();

    let closed = false;
    const onClose = () => {
      if (closed || client.socket !== socket) return;
      closed = true;
      this.clients.delete(client.id);
      const room = client.room ? this.rooms.get(client.room) : undefined;
      if (client.resumeToken && room?.view.status === "waiting") {
        client.input = emptyInput();
        room.view.players.forEach((player) => {
          player.ready = false;
          if (player.id === client.id) player.connected = false;
        });
        const timer = setTimeout(() => {
          this.resumeTimers.delete(client.resumeToken!);
          this.leave(client, false);
        }, RECONNECT_GRACE_MS);
        this.resumeTimers.set(client.resumeToken, timer);
        this.publishRoom(room);
      } else this.leave(client, false);
      this.scheduleRoomList();
    };
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onClose);
    socket.addEventListener("message", (event) => {
      if (client.socket !== socket) return;
      if (typeof event.data !== "string") return;
      if (event.data.length > MAX_MESSAGE_BYTES) {
        try {
          socket.close(1009, "too big");
        } catch {}
        return;
      }
      this.handle(client, event.data);
    });
  }

  private handle(client: Client, raw: string) {
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
      message = JSON.parse(raw);
    } catch {
      this.error(client, "Ese mensaje no se pudo leer.");
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
    const current = client.room ? this.rooms.get(client.room) : undefined;
    if (message.type === "list") {
      if (++client.lists > 5) return;
      this.publishList(client);
      return;
    }
    if (message.type === "leave") {
      this.leave(client);
      return;
    }
    if (message.type === "create") {
      if (current) {
        this.error(client, "Primero sal de tu sala actual.");
        return;
      }
      if (!isFighter(message.fighter) || !isStage(message.stage)) {
        this.error(client, "Elige un luchador y un escenario válidos.");
        return;
      }
      let code: string;
      do {
        code = randomHex(16).toUpperCase();
      } while (this.rooms.has(code));
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
      this.rooms.set(code, room);
      client.room = code;
      if (client.resumeToken) this.sessions.set(client.resumeToken, client);
      this.publishRoom(room);
      this.scheduleRoomList(room);
      this.updateTimers();
      return;
    }
    if (message.type === "join") {
      if (current) {
        this.error(client, "Ya estás en una sala.");
        return;
      }
      if (!isRoomCode(message.code) || !isFighter(message.fighter)) return;
      const room = this.rooms.get(normalizeRoomCode(message.code));
      if (!room) {
        this.error(client, "No encontramos esa sala. Revisa el código.");
        return;
      }
      if (room.clients.length >= 2 || room.view.status !== "waiting") {
        this.error(
          client,
          "Esa sala está ocupada. Crea una nueva o elige otra.",
        );
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
      if (client.resumeToken) this.sessions.set(client.resumeToken, client);
      this.publishRoom(room);
      this.scheduleRoomList(room);
      return;
    }
    if (!current) return;
    if (message.type === "select" && current.view.status === "waiting") {
      const player = current.view.players.find((p) => p.id === client.id)!;
      let changed = false;
      if (isFighter(message.fighter)) {
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
        this.publishRoom(current);
        this.scheduleRoomList(current);
      }
    }
    if (message.type === "ready" && current.view.status === "waiting") {
      if (typeof message.ready !== "boolean") return;
      const player = current.view.players.find((p) => p.id === client.id)!;
      if (player.ready !== message.ready) {
        player.ready = message.ready;
        this.publishRoom(current);
        this.scheduleRoomList(current);
        if (message.ready) this.start(current);
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
      safe.superHeld = input.superHeld === true;
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
        if (current.view.players.every((p) => p.ready)) this.start(current);
        else this.publishRoom(current);
      }
    }
  }
}
