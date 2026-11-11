// Online rooms and the authoritative match loop, shared by the Node server and
// the Cloudflare Durable Object. Each host only adapts its socket type.
import { isFighter } from "../roster/roster";
import {
  ACTIONS,
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../engine/engine";
import {
  ARENA_SOCKET_PROTOCOL,
  ROOM_RESUME_PROTOCOL_PREFIX,
  type ClientMessage,
  type RoomPlayer,
  type RoomView,
  type ServerMessage,
} from "./protocol";
import { normalizeRoomCode } from "./room-code";
import { messageType, parseClientMessage } from "./client-message";
import { FixedStepTicker } from "./ticker";

/** How a host delivers to, and retires, one of its sockets. */
export interface LobbyTransport<Socket> {
  /**
   * Deliver an encoded message. Unreliable messages (state snapshots, room
   * lists) may be dropped under backpressure; reliable ones must not be.
   */
  send(socket: Socket, data: string, reliable: boolean): void;
  /** Close a socket superseded by a resumed connection. */
  replace(socket: Socket): void;
}

export interface LobbyClient<Socket> {
  id: string;
  socket: Socket;
  room: string | null;
  nickname: string;
  input: Input;
  inputAt: number;
  messages: number;
  controls: number;
  lists: number;
  window: number;
  /** When the server last heard anything from this client. */
  lastSeen: number;
  resumeToken: string | null;
}

export interface LobbyRoom<Socket> {
  view: RoomView;
  clients: LobbyClient<Socket>[];
  private: boolean;
  state: MatchState | null;
  touched: number;
}

export interface LobbyOptions {
  /** How long a disconnected player keeps their seat in a waiting room. */
  reconnectGraceMs?: number | undefined;
}

const STEP_MS = 1000 / 60;
const INPUT_TIMEOUT_MS = 250;
const ROOM_IDLE_MS = 60 * 60 * 1000;
const ROOM_SWEEP_MS = 15_000;
/** Clients send a ping every 5 s; silence this long means the link is gone. */
const CLIENT_TIMEOUT_MS = 30_000;
const LIVENESS_SWEEP_MS = 5_000;
const ROOM_LIST_DELAY_MS = 100;
// Bounds on what scripted connections can make every player download, and on
// what one host keeps in memory.
const MAX_LISTED_ROOMS = 50;
const MAX_ROOMS = 2_000;
const MESSAGES_PER_SECOND = 180;
const CONTROLS_PER_SECOND = 30;
const LISTS_PER_SECOND = 5;
const CONTROL_MESSAGES = new Set(["select", "ready", "rematch"]);

const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** Let Node exit while only a reconnect grace timer is pending. */
function unref(timer: unknown) {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  )
    timer.unref();
}

export class Lobby<Socket> {
  readonly clients = new Map<string, LobbyClient<Socket>>();
  readonly rooms = new Map<string, LobbyRoom<Socket>>();
  private readonly sessions = new Map<string, LobbyClient<Socket>>();
  private readonly resumeTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly reconnectGraceMs: number;
  private roomListCache = "";
  private lastPublishedList = "";
  private roomListTimer: ReturnType<typeof setTimeout> | null = null;
  private gameLoop: ReturnType<typeof setInterval> | null = null;
  private sweep: ReturnType<typeof setInterval> | null = null;
  private liveness: ReturnType<typeof setInterval> | null = null;
  private ticker = new FixedStepTicker(STEP_MS, 5);
  private tick = 0;
  private closed = false;

  private readonly transport: LobbyTransport<Socket>;

  constructor(transport: LobbyTransport<Socket>, options: LobbyOptions = {}) {
    this.transport = transport;
    this.reconnectGraceMs = options.reconnectGraceMs ?? 5 * 60_000;
  }

  /** Rooms anyone can see; private rooms are reachable only by code. */
  publicRooms(): RoomView[] {
    return [...this.rooms.values()]
      .filter((r) => !r.private)
      .slice(0, MAX_LISTED_ROOMS)
      .map((r) => r.view);
  }

  /** Register a socket, resuming the offered session when it is still seated. */
  connect(socket: Socket, protocols: string[]): LobbyClient<Socket> {
    const resumable = protocols.includes(ARENA_SOCKET_PROTOCOL);
    const resumeToken = protocols
      .find((protocol) => protocol.startsWith(ROOM_RESUME_PROTOCOL_PREFIX))
      ?.slice(ROOM_RESUME_PROTOCOL_PREFIX.length);
    const previous =
      resumable && resumeToken ? this.sessions.get(resumeToken) : undefined;
    const previousRoom = previous?.room ? this.rooms.get(previous.room) : null;
    const client: LobbyClient<Socket> =
      previous && previousRoom
        ? previous
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
            lastSeen: Date.now(),
            resumeToken: resumable ? randomHex(32) : null,
          };
    if (previousRoom) {
      const replaced = client.socket;
      client.socket = socket;
      this.cancelResumeTimer(client);
      this.transport.replace(replaced);
      const player = previousRoom.view.players.find((p) => p.id === client.id);
      if (player) player.connected = true;
    }
    client.lastSeen = Date.now();
    this.clients.set(client.id, client);
    if (client.resumeToken) this.sessions.set(client.resumeToken, client);
    this.send(client, {
      type: "welcome",
      id: client.id,
      resumeToken: client.resumeToken ?? undefined,
      resumed: Boolean(previousRoom),
    });
    // The online count changed, so the cached list is stale.
    this.roomListCache = "";
    this.publishList(client);
    if (previousRoom) {
      this.publishRoom(previousRoom);
      if (previousRoom.state)
        this.send(client, {
          type: "start",
          state: previousRoom.state,
          index: previousRoom.clients.indexOf(client) === 1 ? 1 : 0,
        });
    }
    this.scheduleRoomList();
    this.updateTimers();
    return client;
  }

  /**
   * Handle a closed socket. A player in a waiting room keeps their seat for the
   * reconnect grace period; anyone else leaves at once. Closing a socket that a
   * resumed connection already replaced, or closing twice, does nothing.
   */
  disconnect(client: LobbyClient<Socket>, socket: Socket) {
    if (client.socket !== socket || this.clients.get(client.id) !== client)
      return;
    this.clients.delete(client.id);
    const room = client.room ? this.rooms.get(client.room) : undefined;
    const token = client.resumeToken;
    if (!this.closed && token && room?.view.status === "waiting") {
      client.input = emptyInput();
      room.view.players.forEach((player) => {
        player.ready = false;
        if (player.id === client.id) player.connected = false;
      });
      const timer = setTimeout(() => {
        this.resumeTimers.delete(token);
        this.leave(client, false);
      }, this.reconnectGraceMs);
      unref(timer);
      this.resumeTimers.set(token, timer);
      this.publishRoom(room);
    } else this.leave(client, false);
    this.scheduleRoomList();
    this.updateTimers();
  }

  /** Handle one text frame from a connected client. */
  receive(client: LobbyClient<Socket>, raw: string) {
    const now = Date.now();
    client.lastSeen = now;
    if (now - client.window >= 1000) {
      client.window = now;
      client.messages = 0;
      client.controls = 0;
      client.lists = 0;
    }
    if (++client.messages > MESSAGES_PER_SECOND) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      this.error(client, "Ese mensaje no se pudo leer.");
      return;
    }
    const type = messageType(data);
    if (type === null) return;
    if (CONTROL_MESSAGES.has(type) && ++client.controls > CONTROLS_PER_SECOND)
      return;
    if (type === "ping") return;
    const message = parseClientMessage(data);
    const current = client.room ? this.rooms.get(client.room) : undefined;
    if (type === "list") {
      if (++client.lists <= LISTS_PER_SECOND) this.publishList(client);
      return;
    }
    if (type === "leave") {
      this.leave(client);
      return;
    }
    if (type === "create") {
      if (current) this.error(client, "Primero sal de tu sala actual.");
      else if (message?.type !== "create")
        this.error(client, "Elige un luchador y un escenario válidos.");
      else if (this.rooms.size >= MAX_ROOMS)
        this.error(client, "La arena está llena. Intenta de nuevo en un rato.");
      else this.create(client, message, now);
      return;
    }
    if (type === "join") {
      if (current) this.error(client, "Ya estás en una sala.");
      else if (message?.type === "join") this.join(client, message, now);
      return;
    }
    if (!current || !message) return;
    const player = current.view.players.find((p) => p.id === client.id);
    if (!player) return;
    const status = current.view.status;
    if (message.type === "select" && status === "waiting") {
      let changed = false;
      if (message.fighter) {
        const wins = message.wins ?? 0;
        if (player.fighter !== message.fighter || player.wins !== wins) {
          player.fighter = message.fighter;
          player.wins = wins;
          player.ready = false;
          changed = true;
        }
      }
      if (
        client.id === current.view.host &&
        message.stage &&
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
    } else if (message.type === "ready" && status === "waiting") {
      if (player.ready !== message.ready) {
        player.ready = message.ready;
        this.publishRoom(current);
        this.scheduleRoomList(current);
        if (message.ready) this.start(current);
      }
    } else if (message.type === "input" && status === "playing") {
      if (message.matchId !== current.state?.id) return;
      // Action counters only grow, so a replayed packet cannot repeat an attack.
      for (const action of ACTIONS)
        if (message.input.actions[action] < client.input.actions[action])
          return;
      client.input = message.input;
      client.inputAt = performance.now();
    } else if (message.type === "rematch" && status === "finished") {
      if (!player.ready) {
        player.ready = true;
        if (current.view.players.every((p) => p.ready)) this.start(current);
        else this.publishRoom(current);
      }
    }
  }

  /** Stop every timer. Later disconnects leave their room immediately. */
  close() {
    this.closed = true;
    this.resumeTimers.forEach(clearTimeout);
    this.resumeTimers.clear();
    this.sessions.clear();
    if (this.roomListTimer) clearTimeout(this.roomListTimer);
    this.roomListTimer = null;
    this.stopTimers();
  }

  private create(
    client: LobbyClient<Socket>,
    message: Extract<ClientMessage, { type: "create" }>,
    now: number,
  ) {
    let code: string;
    do {
      code = randomHex(16).toUpperCase();
    } while (this.rooms.has(code));
    const nickname = message.name ?? "";
    client.nickname = nickname;
    const player: RoomPlayer = {
      id: client.id,
      name: nickname || "Jugador 1",
      fighter: message.fighter,
      ready: false,
      wins: message.wins,
    };
    const room: LobbyRoom<Socket> = {
      view: {
        code,
        name: nickname ? `La sala de ${nickname}` : `Sala ${code.slice(0, 6)}`,
        stage: message.stage,
        players: [player],
        status: "waiting",
        host: client.id,
      },
      clients: [client],
      private: message.private,
      state: null,
      touched: now,
    };
    this.rooms.set(code, room);
    client.room = code;
    if (client.resumeToken) this.sessions.set(client.resumeToken, client);
    this.publishRoom(room);
    this.scheduleRoomList(room);
    this.updateTimers();
  }

  private join(
    client: LobbyClient<Socket>,
    message: Extract<ClientMessage, { type: "join" }>,
    now: number,
  ) {
    const room = this.rooms.get(normalizeRoomCode(message.code));
    if (!room) {
      this.error(client, "No encontramos esa sala. Revisa el código.");
      return;
    }
    if (room.clients.length >= 2 || room.view.status !== "waiting") {
      this.error(client, "Esa sala está ocupada. Crea una nueva o elige otra.");
      return;
    }
    client.nickname = message.name ?? "";
    room.clients.push(client);
    room.view.players.push({
      id: client.id,
      name: client.nickname || "Jugador 2",
      fighter: message.fighter,
      ready: false,
      wins: message.wins,
    });
    room.touched = now;
    client.room = room.view.code;
    if (client.resumeToken) this.sessions.set(client.resumeToken, client);
    this.publishRoom(room);
    this.scheduleRoomList(room);
  }

  private leave(client: LobbyClient<Socket>, notify = true) {
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
        // Automatic labels follow the new slots; explicit nicknames stay.
        p.name = room.clients[index]?.nickname || `Jugador ${index + 1}`;
      });
      const host = room.clients[0];
      if (!host) this.rooms.delete(room.view.code);
      else {
        room.view.host = host.id;
        if (wasPlaying)
          room.clients.forEach((c) => this.send(c, { type: "opponent-left" }));
        this.publishRoom(room);
      }
      this.scheduleRoomList(room);
    }
    if (notify) this.send(client, { type: "left" });
    this.updateTimers();
  }

  private start(room: LobbyRoom<Socket>) {
    // A closed lobby runs no loop, so a match started now would never advance.
    if (
      this.closed ||
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
    const [firstClient, secondClient] = room.clients;
    if (!first || !second || !firstClient || !secondClient) return;
    const state = createMatch(
      room.view.stage,
      [first, second],
      crypto.randomUUID(),
    );
    room.state = state;
    room.view.status = "playing";
    room.touched = Date.now();
    this.send(firstClient, { type: "start", state, index: 0 });
    this.send(secondClient, { type: "start", state, index: 1 });
    this.publishRoom(room);
    this.scheduleRoomList(room);
    this.updateTimers();
  }

  /** Advance every live match by the fixed steps that are due. */
  private step() {
    const now = performance.now();
    const due = this.ticker.advance(now);
    for (let step = 0; step < due; step++) {
      this.tick++;
      this.rooms.forEach((room) => {
        const state = room.state;
        const [first, second] = room.clients;
        if (!state || room.view.status !== "playing" || !first || !second)
          return;
        // A stalled or suspended client must not keep walking or guarding.
        // Preserve counters so expiring a hold cannot replay an old attack.
        room.clients.forEach((client) => {
          if (now - client.inputAt <= INPUT_TIMEOUT_MS) return;
          client.input.left = false;
          client.input.right = false;
          client.input.block = false;
          client.input.down = false;
          client.input.superHeld = false;
        });
        stepMatch(state, [first.input, second.input]);
        if (this.tick % 2 === 0 || state.phase === "finished") {
          const message = JSON.stringify({ type: "state", state });
          room.clients.forEach((client) =>
            this.transport.send(client.socket, message, false),
          );
        }
        if (state.phase === "finished") {
          room.view.status = "finished";
          room.view.players.forEach((p, index) => {
            p.ready = false;
            if (state.winner === index) p.wins++;
          });
          this.publishRoom(room);
        }
      });
    }
    this.updateTimers();
  }

  /**
   * Drop connections that have gone silent. Node also pings at the protocol
   * level, but a Worker cannot, and a half-open socket would otherwise keep
   * its seat, and its opponent waiting, indefinitely.
   */
  private dropSilentClients() {
    const now = Date.now();
    for (const client of [...this.clients.values()])
      if (now - client.lastSeen > CLIENT_TIMEOUT_MS) {
        this.transport.replace(client.socket);
        this.disconnect(client, client.socket);
      }
  }

  /** Close rooms nobody has played in for an hour. */
  private expireRooms() {
    this.rooms.forEach((room) => {
      if (
        room.view.status !== "playing" &&
        Date.now() - room.touched > ROOM_IDLE_MS
      )
        room.clients.slice().forEach((c) => this.leave(c));
    });
  }

  /** Run the 60 Hz loop only while a match is live, so idle lobbies cost nothing. */
  private updateTimers() {
    if (this.closed) return;
    const playing = [...this.rooms.values()].some(
      (room) => room.view.status === "playing",
    );
    if (playing && !this.gameLoop) {
      this.ticker = new FixedStepTicker(STEP_MS, 5);
      this.gameLoop = setInterval(() => this.step(), STEP_MS);
    } else if (!playing && this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    if (this.clients.size && !this.liveness)
      this.liveness = setInterval(
        () => this.dropSilentClients(),
        LIVENESS_SWEEP_MS,
      );
    else if (!this.clients.size && this.liveness) {
      clearInterval(this.liveness);
      this.liveness = null;
    }
    if (this.rooms.size && !this.sweep)
      this.sweep = setInterval(() => this.expireRooms(), ROOM_SWEEP_MS);
    else if (!this.rooms.size && this.sweep) {
      clearInterval(this.sweep);
      this.sweep = null;
    }
  }

  private stopTimers() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    if (this.liveness) clearInterval(this.liveness);
    this.liveness = null;
    if (this.sweep) clearInterval(this.sweep);
    this.gameLoop = null;
    this.sweep = null;
  }

  private send(client: LobbyClient<Socket>, message: ServerMessage) {
    // A dropped `start` or `left` would strand the client; only state is replaceable.
    this.transport.send(
      client.socket,
      JSON.stringify(message),
      message.type !== "state",
    );
  }

  private error(client: LobbyClient<Socket>, message: string) {
    this.send(client, { type: "error", message });
  }

  private forgetSession(client: LobbyClient<Socket>) {
    if (!client.resumeToken) return;
    this.cancelResumeTimer(client);
    this.sessions.delete(client.resumeToken);
  }

  private cancelResumeTimer(client: LobbyClient<Socket>) {
    if (!client.resumeToken) return;
    const timer = this.resumeTimers.get(client.resumeToken);
    if (timer !== undefined) clearTimeout(timer);
    this.resumeTimers.delete(client.resumeToken);
  }

  private publishRoom(room: LobbyRoom<Socket>) {
    const message = JSON.stringify({ type: "room", room: room.view });
    room.clients.forEach((client) =>
      this.transport.send(client.socket, message, true),
    );
  }

  private publishList(recipient?: LobbyClient<Socket>) {
    if (!this.roomListCache) {
      const rooms = [...this.rooms.values()]
        // A seat held for a disconnected player cannot start a match, so a
        // stranger joining that room would wait for nobody. Its code and
        // invite link still work.
        .filter(
          (r) =>
            !r.private &&
            r.view.status === "waiting" &&
            r.clients.length < 2 &&
            r.view.players.every((player) => player.connected !== false),
        )
        .slice(0, MAX_LISTED_ROOMS)
        .map((r) => r.view);
      this.roomListCache = JSON.stringify({
        type: "rooms",
        rooms,
        online: this.clients.size,
      });
    }
    const encoded = this.roomListCache;
    if (recipient) this.transport.send(recipient.socket, encoded, false);
    else if (encoded !== this.lastPublishedList) {
      this.lastPublishedList = encoded;
      this.clients.forEach((client) =>
        this.transport.send(client.socket, encoded, false),
      );
    }
  }

  private scheduleRoomList(room?: LobbyRoom<Socket>) {
    if (room?.private || this.closed) return;
    this.roomListCache = "";
    if (this.roomListTimer) return;
    this.roomListTimer = setTimeout(() => {
      this.roomListTimer = null;
      this.publishList();
    }, ROOM_LIST_DELAY_MS);
  }
}
