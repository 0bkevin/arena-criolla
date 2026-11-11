// Smoke-test a deployed Arena Criolla: pages, headers, and a full online match
// start between two WebSocket clients. Usage: node scripts/cloudflare-smoke.mjs <origin>
import { WebSocket } from "ws";

const origin = (process.argv[2] ?? "http://127.0.0.1:8799").replace(/\/$/, "");
const fail = (message) => {
  console.error(`✘ ${message}`);
  process.exit(1);
};
const ok = (message) => console.log(`✓ ${message}`);

async function get(path, init) {
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
]) {
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
function client(name) {
  const socket = new WebSocket(`${wsOrigin}/ws`, ["arena-v1"], {
    headers: { Origin: origin },
  });
  const messages = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    messages.push(message);
    for (const waiter of waiters.splice(0))
      if (!waiter(message)) waiters.push(waiter);
  });
  const next = (predicate, label) =>
    new Promise((resolve, reject) => {
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
    send: (message) => socket.send(JSON.stringify(message)),
  };
}

try {
  const a = client("host"),
    b = client("guest");
  await Promise.all([a.opened, b.opened]);
  if (a.socket.protocol !== "arena-v1") fail("subprotocol not negotiated");
  await a.next((m) => m.type === "welcome" && m.resumeToken, "welcome");
  await b.next((m) => m.type === "welcome", "welcome");
  a.send({
    type: "create",
    name: "Smoke A",
    fighter: "zavarce",
    stage: "caracas",
    wins: 0,
    private: true,
  });
  const { room } = await a.next((m) => m.type === "room", "room");
  b.send({
    type: "join",
    code: room.code,
    name: "Smoke B",
    fighter: "zavarce",
    wins: 0,
  });
  await b.next((m) => m.type === "room" && m.room.players.length === 2, "join");
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  const start = await a.next((m) => m.type === "start", "start");
  await b.next((m) => m.type === "start", "start");
  const input = {
    left: false,
    right: true,
    block: false,
    down: false,
    superHeld: false,
    actions: { jump: 0, light: 0, heavy: 0, special: 0, dash: 0, super: 0 },
  };
  const states = [];
  a.socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.type === "state") states.push(performance.now());
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
  await b.next((m) => m.type === "opponent-left", "opponent-left");
  ok("leave notifies the opponent");
  a.socket.close();
  b.socket.close();
} catch (error) {
  fail(error.message);
}
