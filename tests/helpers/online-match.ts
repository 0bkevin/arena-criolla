// Two real WebSocket clients against an in-process Node server.
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { makeArenaServer } from "../../server/index";
import type { Input } from "../../shared/engine/engine";
import type { ServerMessage } from "../../shared/lobby/protocol";
import { type FighterId, STAGES } from "../../shared/roster/roster";

export class TestClient {
  messages: ServerMessage[] = [];
  socket: WebSocket;
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      this.messages.push(JSON.parse(raw.toString()));
    });
  }
  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }
  hold(matchId: string, input: Input) {
    const send = () => this.send({ type: "input", matchId, input });
    send();
    const timer = setInterval(send, 100);
    return () => clearInterval(timer);
  }
  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 4000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const index = this.messages.findIndex(
        (m) =>
          m.type === type &&
          predicate(m as Extract<ServerMessage, { type: T }>),
      );
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<
          ServerMessage,
          { type: T }
        >;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    throw new Error(`Timed out waiting for ${type}`);
  }
}

export async function onlineMatch(
  stage: (typeof STAGES)[number]["id"] = "poliedro",
  fighters: [FighterId, FighterId] = ["zavarce", "vallenilla"],
  wins: [number, number] = [0, 0],
) {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const a = new TestClient(url);
  const b = new TestClient(url);
  const [welcome] = await Promise.all([a.wait("welcome"), b.wait("welcome")]);
  a.send({
    type: "create",
    name: "Host",
    fighter: fighters[0],
    stage,
    wins: wins[0],
    private: true,
  });
  const { room } = await a.wait("room");
  b.send({
    type: "join",
    code: room.code,
    name: "Guest",
    fighter: fighters[1],
    wins: wins[1],
  });
  await a.wait("room", (message) => message.room.players.length === 2);
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  const starts = await Promise.all([a.wait("start"), b.wait("start")]);
  for (const start of starts) assert.equal(start.state.remaining, 120 * 60);
  const active = server.rooms.get(room.code)!;
  active.state!.phase = "playing";
  active.state!.players.forEach((player) => {
    player.invincible = 0;
  });
  return {
    server,
    a,
    b,
    active,
    client: server.clients.get(welcome.id)!,
    close: async () => {
      a.socket.terminate();
      b.socket.terminate();
      await server.close();
    },
  };
}
