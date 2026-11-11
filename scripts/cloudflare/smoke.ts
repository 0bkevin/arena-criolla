// Smoke-test a deployed Arena Criolla: pages, headers, and a full online match
// start between two WebSocket clients. Usage: node scripts/cloudflare/smoke.ts <origin>
import { WebSocket } from "ws";
import { ARENA_SOCKET_PROTOCOL } from "../../shared/lobby/protocol.ts";

const origin = (process.argv[2] ?? "http://127.0.0.1:8799").replace(/\/$/, "");
const fail: (message: string) => never = (message) => {
  console.error(`✘ ${message}`);
  process.exit(1);
};
const ok = (message: string) => console.log(`✓ ${message}`);

async function get(path: string, init?: RequestInit) {
  const response = await fetch(origin + path, { redirect: "manual", ...init });
  return { response, body: await response.text() };
}

{
  const { response, body } = await get("/");
  if (response.status !== 200) fail(`/ returned ${response.status}`);
  const csp = response.headers.get("content-security-policy") ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  if (!nonce || !body.includes(`<script nonce="${nonce}"`))
    fail("HTML shell is missing its CSP nonce");
  if (body.includes("__ARENA_")) fail("HTML shell has unreplaced placeholders");
  const script = /<script[^>]+src="([^"]+)"/.exec(body)?.[1];
  if (!script) fail("HTML shell has no module script");
  const asset = await fetch(origin + script);
  if (asset.status !== 200) fail(`${script} returned ${asset.status}`);
  if (!/immutable/.test(asset.headers.get("cache-control") ?? ""))
    fail(`${script} is not cached as immutable`);
  ok(`HTML shell and ${script}`);
}
for (const [path, status] of [
  ["/agradecimientos", 200],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
  ["/index.html", 308],
  ["/api/health", 200],
  ["/api/community/characters", 404],
  ["/api/auth/session", 404],
  ["/assets/caracas.webp", 200],
  ["/manifest.webmanifest", 200],
] as const) {
  const { response } = await get(path);
  if (response.status !== status)
    fail(`${path} returned ${response.status}, expected ${status}`);
}
ok("routes and status codes");
{
  const avif = await fetch(origin + "/assets/caracas.webp", {
    headers: { Accept: "image/avif,image/webp,*/*" },
  });
  if (avif.headers.get("content-type") !== "image/avif")
    fail("caracas.webp did not negotiate AVIF");
  ok("AVIF negotiation");
}

const wsOrigin = origin.replace(/^http/, "ws");
// Server messages are untrusted input: each wait narrows them by shape.
type ClientMessage = { type: string; [field: string]: unknown };
interface RoomMessage {
  type: "room";
  room: { code: string; players: unknown[] };
}
interface StartMessage {
  type: "start";
  state: { id: string };
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isType = <T extends string>(
  value: unknown,
  type: T,
): value is { type: T } & Record<string, unknown> =>
  isRecord(value) && value.type === type;
const isRoom = (m: unknown): m is RoomMessage =>
  isType(m, "room") &&
  isRecord(m.room) &&
  typeof m.room.code === "string" &&
  isArray(m.room.players);
const isStart = (m: unknown): m is StartMessage =>
  isType(m, "start") && isRecord(m.state) && typeof m.state.id === "string";
function client(name: string) {
  const socket = new WebSocket(`${wsOrigin}/ws`, [ARENA_SOCKET_PROTOCOL], {
    headers: { Origin: origin },
  });
  const messages: unknown[] = [];
  const waiters: ((message: unknown) => boolean)[] = [];
  socket.on("message", (raw) => {
    const message: unknown = JSON.parse(raw.toString());
    messages.push(message);
    for (const waiter of waiters.splice(0))
      if (!waiter(message)) waiters.push(waiter);
  });
  const next = <T>(
    predicate: (message: unknown) => message is T,
    label: string,
  ) =>
    new Promise<T>((resolve, reject) => {
      const found = messages.find(predicate);
      if (found) return resolve(found);
      const timer = setTimeout(
        () => reject(new Error(`${name}: timed out waiting for ${label}`)),
        10_000,
      );
      waiters.push((message) => {
        if (!predicate(message)) return false;
        clearTimeout(timer);
        resolve(message);
        return true;
      });
    });
  const opened = new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    socket,
    next,
    opened,
    send: (message: ClientMessage) => socket.send(JSON.stringify(message)),
  };
}

try {
  const a = client("host"),
    b = client("guest");
  await Promise.all([a.opened, b.opened]);
  if (a.socket.protocol !== ARENA_SOCKET_PROTOCOL)
    fail("subprotocol not negotiated");
  await a.next(
    (m): m is { type: "welcome" } =>
      isType(m, "welcome") && Boolean(m.resumeToken),
    "welcome",
  );
  await b.next((m) => isType(m, "welcome"), "welcome");
  a.send({
    type: "create",
    name: "Smoke A",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: true,
  });
  const { room } = await a.next(isRoom, "room");
  b.send({
    type: "join",
    code: room.code,
    name: "Smoke B",
    fighter: "zavarce",
    wins: 0,
  });
  await b.next(
    (m): m is RoomMessage => isRoom(m) && m.room.players.length === 2,
    "join",
  );
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  const start = await a.next(isStart, "start");
  await b.next(isStart, "start");
  const input = {
    left: false,
    right: true,
    block: false,
    down: false,
    superHeld: false,
    actions: { jump: 0, light: 0, heavy: 0, special: 0, dash: 0, super: 0 },
  };
  const states: number[] = [];
  a.socket.on("message", (raw) => {
    const message: unknown = JSON.parse(raw.toString());
    if (isType(message, "state")) states.push(performance.now());
  });
  const began = performance.now();
  const pump = setInterval(
    () => a.send({ type: "input", matchId: start.state.id, input }),
    45,
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));
  clearInterval(pump);
  const rate = states.length / ((performance.now() - began) / 1000);
  if (rate < 20) fail(`state updates too slow: ${rate.toFixed(1)}/s`);
  ok(`online match running, ${rate.toFixed(1)} state updates/s`);
  a.send({ type: "leave" });
  await b.next((m) => isType(m, "opponent-left"), "opponent-left");
  ok("leave notifies the opponent");
  a.socket.close();
  b.socket.close();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
