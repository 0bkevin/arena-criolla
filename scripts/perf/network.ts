// Isolated loopback game-load probe. Starts its own process and temporary storage.
// No public server, private production data, or paid generation is used.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import type { WebSocket as WebSocketClient } from "ws";
const count = Number(process.env.ARENA_PERF_PLAYERS || 500);
const seconds = Number(process.env.ARENA_PERF_SECONDS || 15);
const mixedRoster = process.env.ARENA_PERF_ROSTER === "all";
const fighters: { id: string }[] = JSON.parse(
  await readFile("shared/roster/fighters.json", "utf8"),
);
const stages: { id: string }[] = JSON.parse(
  await readFile("shared/roster/stages.json", "utf8"),
);
if (
  !Number.isSafeInteger(count) ||
  count < 2 ||
  count % 2 ||
  count > 2000 ||
  !Number.isFinite(seconds) ||
  seconds < 5 ||
  seconds > 300
)
  throw new Error(
    "Use an even ARENA_PERF_PLAYERS (2..2000) and ARENA_PERF_SECONDS (5..300).",
  );
const require = createRequire(path.join(process.cwd(), "package.json"));
const { WebSocket }: { WebSocket: typeof WebSocketClient } = require("ws");
const dataDir = await mkdtemp(path.join(tmpdir(), "arena-network-perf-"));
const childSource = `
import { makeArenaServer } from ${JSON.stringify(pathToFileURL(path.resolve("server/index.ts")).href)};
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { FixedStepTicker } from ${JSON.stringify(pathToFileURL(path.resolve("shared/lobby/ticker.ts")).href)};
let steps=0, startSteps=0;const originalAdvance=FixedStepTicker.prototype.advance;FixedStepTicker.prototype.advance=function(now){const n=originalAdvance.call(this,now);steps+=n;return n;};
const server = await makeArenaServer({ serveClient: false, production: true });
const lag = monitorEventLoopDelay({resolution:10}); lag.enable();
let cpu = process.cpuUsage(), began = performance.now(), ticks = [];
process.on('message', m => {
  if(m.type==='reset') {lag.reset();startSteps=steps;cpu=process.cpuUsage();began=performance.now(); ticks=[...server.rooms.values()].map(r=>r.state?.tick??0);process.send({type:'reset'});}
  if(m.type==='stats') {const usage=process.cpuUsage(cpu);const elapsed=performance.now()-began;const nowTicks=[...server.rooms.values()].map(r=>r.state?.tick??0);process.send({type:'stats',elapsedMs:elapsed,cpuPercent:(usage.user+usage.system)/1000/elapsed*100,rssMiB:process.memoryUsage().rss/1024**2,eventLoopP95Ms:lag.percentile(95)/1e6,eventLoopMaxMs:lag.max/1e6,connections:server.clients.size,rooms:server.rooms.size,playingRooms:[...server.rooms.values()].filter(r=>r.view.status==='playing').length,simulationHz:(steps-startSteps)*1000/elapsed,acceptedInputLight:[...server.clients.values()][0]?.input.actions.light,tickRates:nowTicks.map((n,i)=>(n-ticks[i])*1000/elapsed)});}
  if(m.type==='close') void server.close().then(()=>process.exit(0));
});
await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));
process.send({type:'ready',port:server.http.address().port});
`;
const child = spawn(
  process.execPath,
  ["--import", "tsx", "--input-type=module", "-e", childSource],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  },
);
// The child and the server under test reply with JSON objects; their fields
// are narrowed where they are read.
type Message = Record<string, unknown>;
interface PendingIpc {
  type: string;
  resolve: (message: Message) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
interface PendingReply {
  type: string;
  filter: (message: Message) => boolean;
  resolve: (message: Message) => void;
  timer: ReturnType<typeof setTimeout>;
}
interface RoomView {
  code: string;
  players: unknown[];
}
const isRecord = (value: unknown): value is Message =>
  typeof value === "object" && value !== null;
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isNumbers = (value: unknown): value is number[] =>
  isArray(value) && value.every((n) => typeof n === "number");
function roomOf(message: Message): RoomView {
  const { room } = message;
  if (isRecord(room) && typeof room.code === "string" && isArray(room.players))
    return { code: room.code, players: room.players };
  throw new TypeError("Malformed room message");
}
function matchIdOf(message: Message): string {
  const { state } = message;
  if (isRecord(state) && typeof state.id === "string") return state.id;
  throw new TypeError("Malformed start message");
}
let stderr = "";
// stdio pipes stdout and stderr, so both streams exist.
child.stderr!.on("data", (d: Buffer) => (stderr += d));
child.stdout!.on("data", (d: Buffer) => process.stdout.write(d));
const inbox: Message[] = [],
  pending: PendingIpc[] = [];
child.on("message", (m) => {
  if (!isRecord(m)) return;
  const i = pending.findIndex((p) => p.type === m.type);
  if (i >= 0) {
    const p = pending.splice(i, 1)[0];
    clearTimeout(p.timer);
    p.resolve(m);
  } else inbox.push(m);
});
function ipcWait(type: string): Promise<Message> {
  const i = inbox.findIndex((m) => m.type === type);
  if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
  return new Promise((resolve, reject) => {
    const p: PendingIpc = {
      type,
      resolve,
      reject,
      timer: setTimeout(
        () => reject(new Error("IPC timeout " + type + " " + stderr)),
        10000,
      ),
    };
    pending.push(p);
  });
}
function ipc(type: string): Promise<Message> {
  const promise = ipcWait(type);
  child.send({ type });
  return promise;
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const round = (n: number) => Math.round(n * 100) / 100;
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
  );
};
let measuring = false;
class Peer {
  inbox: Message[] = [];
  pending: PendingReply[] = [];
  frames = 0;
  bytes = 0;
  errors: string[] = [];
  matchId: string | null = null;
  closed = false;
  socket: WebSocketClient;
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      const m: unknown = JSON.parse(raw.toString());
      if (!isRecord(m)) return;
      if (m.type === "state") {
        if (measuring) {
          this.frames++;
          // Sockets default to Buffer frames; byteLength equals their length.
          this.bytes += Array.isArray(raw) ? raw.length : raw.byteLength;
        }
        return;
      }
      if (m.type === "start") {
        this.matchId = matchIdOf(m);
        this.input.actions.dash = 1;
      }
      if (m.type === "error") this.errors.push(String(m.message));
      const i = this.pending.findIndex((p) => p.type === m.type && p.filter(m));
      if (i >= 0) {
        const p = this.pending.splice(i, 1)[0];
        clearTimeout(p.timer);
        p.resolve(m);
      } else if (m.type !== "rooms") this.inbox.push(m);
    });
    this.socket.on("error", (e) => this.errors.push(e.message));
    this.socket.on("close", () => (this.closed = true));
  }
  wait(
    type: string,
    filter: (message: Message) => boolean = () => true,
  ): Promise<Message> {
    const i = this.inbox.findIndex((m) => m.type === type && filter(m));
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const p: PendingReply = {
        type,
        filter,
        resolve,
        timer: setTimeout(
          () =>
            reject(
              new Error("Peer timed out " + type + " " + this.errors.join(",")),
            ),
          10000,
        ),
      };
      this.pending.push(p);
    });
  }
  send(m: Message) {
    if (this.socket.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(m));
  }
  input = {
    left: false,
    right: false,
    block: false,
    down: false,
    actions: { jump: 0, light: 0, heavy: 0, special: 0, dash: 0, super: 0 },
  };
}
const peers: Peer[] = [];
const results: Record<string, unknown>[] = [];
let inputTimer: ReturnType<typeof setInterval> | undefined;
try {
  const { port } = await ipcWait("ready");
  if (typeof port !== "number") throw new Error("IPC ready without a port");
  const base = "http://127.0.0.1:" + port;
  const ws = "ws://127.0.0.1:" + port + "/ws";
  inputTimer = setInterval(() => {
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      if (!p.matchId) continue;
      p.input.left = false;
      p.input.right = false;
      p.send({ type: "input", matchId: p.matchId, input: p.input });
    }
  }, 1000 / 30);
  let actionBeat = 0;
  const actions = setInterval(() => {
    actionBeat++;
    for (const p of peers) {
      p.input.actions.jump++;
      p.input.actions.light++;
      if (actionBeat % 2 === 0) p.input.actions.heavy++;
      if (actionBeat % 3 === 0) p.input.actions.special++;
    }
  }, 500);
  try {
    for (const _players of [count]) {
      const additions = Array.from(
        { length: count - peers.length },
        () => new Peer(ws),
      );
      peers.push(...additions);
      await Promise.all(additions.map((p) => p.wait("welcome")));
      for (let i = count - additions.length; i < count; i += 2) {
        const a = peers[i],
          b = peers[i + 1];
        a.send({
          type: "create",
          name: "Load " + i,
          fighter: mixedRoster
            ? fighters[(i / 2) % fighters.length].id
            : "zavarce",
          stage: mixedRoster ? stages[(i / 2) % stages.length].id : "caracas",
          wins: 0,
          private: true,
        });
        const room = roomOf(await a.wait("room"));
        b.send({
          type: "join",
          code: room.code,
          name: "Load " + (i + 1),
          fighter: mixedRoster
            ? fighters[(i / 2 + 13) % fighters.length].id
            : "capriles",
          wins: 0,
        });
        await b.wait("room", (m) => roomOf(m).players.length === 2);
        const starts = [a.wait("start"), b.wait("start")];
        a.send({ type: "ready", ready: true });
        b.send({ type: "ready", ready: true });
        await Promise.all(starts);
      }
      await sleep(3000);
      for (const p of peers) {
        p.frames = 0;
        p.bytes = 0;
      }
      await ipc("reset");
      measuring = true;
      const latencies: number[] = [];
      const began = performance.now();
      while (performance.now() - began < seconds * 1000) {
        const t = performance.now();
        const r = await fetch(base + "/api/health");
        await r.json();
        latencies.push(performance.now() - t);
        await sleep(200);
      }
      measuring = false;
      const stats = await ipc("stats");
      const rates = stats.tickRates;
      delete stats.tickRates;
      if (!isNumbers(rates) || typeof stats.elapsedMs !== "number")
        throw new Error("IPC stats without elapsedMs or tickRates");
      const report = {
        probe: "active-online-load",
        players: count,
        roster: mixedRoster
          ? "all-built-in-fighters-and-stages"
          : "zavarce-capriles-caracas",
        durationSeconds: round(stats.elapsedMs / 1000),
        ...Object.fromEntries(
          Object.entries(stats)
            .filter(([k]) => k !== "type")
            .map(([k, v]): [string, unknown] => [
              k,
              typeof v === "number" ? round(v) : v,
            ]),
        ),
        tickHzMin: round(Math.min(...rates)),
        tickHzMedian: round(percentile(rates, 0.5)),
        stateFramesPerPlayerPerSecond: round(
          peers.reduce((n, p) => n + p.frames, 0) /
            count /
            (stats.elapsedMs / 1000),
        ),
        statePayloadMiBPerSecond: round(
          peers.reduce((n, p) => n + p.bytes, 0) /
            1024 ** 2 /
            (stats.elapsedMs / 1000),
        ),
        healthP95Ms: round(percentile(latencies, 0.95)),
        unexpectedDisconnects: peers.filter((p) => p.closed).length,
        errors: peers.flatMap((p) => p.errors).slice(0, 10),
      };
      results.push(report);
      console.log(JSON.stringify(report));
    }
  } finally {
    clearInterval(actions);
  }
  if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(results, null, 2) + "\n");
} finally {
  clearInterval(inputTimer);
  measuring = false;
  for (const p of peers) p.socket.terminate();
  if (child.connected) child.send({ type: "close" });
  let deadline: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise<void>((resolve) => {
      deadline = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 6000);
    }),
  ]);
  clearTimeout(deadline);
  await rm(dataDir, { recursive: true, force: true });
}
