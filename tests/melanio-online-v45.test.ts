import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput, type Input, type MatchState } from "../shared/engine";
import type { BuiltInFighterId } from "../shared/content";
import type { ServerMessage } from "../shared/protocol";

class Peer {
  readonly messages: ServerMessage[] = [];
  readonly socket: WebSocket;
  id = "";

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      this.messages.push(message);
      if (message.type === "welcome") this.id = message.id;
    });
  }

  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }

  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () =>
      true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const end = Date.now() + 4_000;
    while (Date.now() < end) {
      const index = this.messages.findIndex(
        (message) =>
          message.type === type &&
          predicate(message as Extract<ServerMessage, { type: T }>),
      );
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<
          ServerMessage,
          { type: T }
        >;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      `Timed out waiting for ${type}; latest state: ${JSON.stringify(this.messages.filter((message) => message.type === "state").at(-1))}`,
    );
  }

  async state(matchId: string, predicate: (state: MatchState) => boolean) {
    return (
      await this.wait(
        "state",
        (message) => message.state.id === matchId && predicate(message.state),
      )
    ).state;
  }
}

async function listeningServer() {
  const dataDir = await mkdtemp(join(tmpdir(), "melanio-v45-"));
  try {
    const server = await makeArenaServer({
      serveClient: false,
      workshopEnabled: false,
      creator: { dataDir, databasePath: ":memory:", provider: null },
    });
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address === "object");
    return {
      server,
      url: `ws://127.0.0.1:${address.port}/ws`,
      close: async () => {
        await server.close();
        await rm(dataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }
}

async function startPair(
  server: Awaited<ReturnType<typeof makeArenaServer>>,
  host: Peer,
  guest: Peer,
  fighters: [BuiltInFighterId, BuiltInFighterId],
) {
  const roomName = `Melanio ${++roomSequence}`;
  host.send({
    type: "create",
    name: roomName,
    fighter: fighters[0],
    stage: "canaima",
    wins: 0,
    private: true,
  });
  const { room } = await host.wait(
    "room",
    (message) => message.room.players[0]?.name === roomName,
  );
  guest.send({
    type: "join",
    code: room.code,
    name: "Guest",
    fighter: fighters[1],
    wins: 0,
  });
  await host.wait("room", (message) => message.room.players.length === 2);
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const [hostStart, guestStart] = await Promise.all([
    host.wait("start"),
    guest.wait("start"),
  ]);
  assert.deepEqual(hostStart.state, guestStart.state);
  const active = server.rooms.get(room.code);
  assert.ok(active?.state);
  active.state.phase = "playing";
  active.state.players.forEach((player, i) => {
    player.x = i === 0 ? 300 : 900;
    player.y = 500;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.supportPlatform = null;
    player.jumps = 0;
    player.invincible = 0;
    player.energy = 100;
    player.attack = null;
    player.attackTick = 0;
    player.cooldown = 0;
  });
  return { code: room.code, state: active.state };
}

let roomSequence = 0;

function input(patch: Partial<Input> = {}): Input {
  return {
    ...emptyInput(),
    ...patch,
    actions: { ...emptyInput().actions, ...patch.actions },
  };
}

function sendInput(peer: Peer, matchId: string, value: Input) {
  peer.send({ type: "input", matchId, input: value });
}

test("Melanio moves and triggers jump, light, heavy and signal over WebSocket on either seat", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url),
    guest = new Peer(fixture.url);
  try {
    await Promise.all([host.wait("welcome"), guest.wait("welcome")]);
    for (const melanioSide of [0, 1] as const) {
      const fighters: [BuiltInFighterId, BuiltInFighterId] =
        melanioSide === 0 ? ["melanio", "javier"] : ["javier", "melanio"];
      const pair = await startPair(fixture.server, host, guest, fighters);
      const actor = melanioSide === 0 ? host : guest;
      const other = melanioSide === 0 ? guest : host;
      const { state } = pair;
      const player = state.players[melanioSide];
      const initialX = player.x;
      let counters = { ...emptyInput().actions };
      const action = (key: keyof typeof counters) => {
        counters = { ...counters, [key]: counters[key] + 1 };
        return input({ actions: counters });
      };
      const neutral = () => input({ actions: counters });

      sendInput(actor, state.id, input({ right: true }));
      await other.state(
        state.id,
        (s) => s.players[melanioSide].x > initialX + 8,
      );
      sendInput(actor, state.id, neutral());
      const afterRight = player.x;
      sendInput(actor, state.id, input({ left: true }));
      await actor.state(
        state.id,
        (s) => s.players[melanioSide].x < afterRight - 8,
      );
      sendInput(actor, state.id, neutral());

      const jump = action("jump");
      sendInput(actor, state.id, jump);
      await other.state(
        state.id,
        (s) =>
          s.players[melanioSide].jumps === 1 && s.players[melanioSide].y < 500,
      );
      assert.equal(player.jumps, 1);

      const groundLimit = Date.now() + 4_000;
      while (!player.grounded && Date.now() < groundLimit)
        await new Promise((resolve) => setTimeout(resolve, 20));
      assert.ok(
        player.grounded,
        "the network jump lands before the next action probe",
      );
      sendInput(actor, state.id, neutral());

      const light = action("light");
      sendInput(actor, state.id, light);
      await other.state(
        state.id,
        (s) => s.players[melanioSide].attack === "light",
      );
      sendInput(actor, state.id, neutral());
      await other.state(
        state.id,
        (s) =>
          s.players[melanioSide].attack === null &&
          s.players[melanioSide].cooldown === 0 &&
          s.players[melanioSide].history.some(
            (entry) => entry.action === "light",
          ),
      );
      const heavy = action("heavy");
      sendInput(actor, state.id, heavy);
      await actor.state(state.id, (s) =>
        s.players[melanioSide].history.some(
          (entry) => entry.action === "heavy",
        ),
      );
      sendInput(actor, state.id, neutral());
      await other.state(
        state.id,
        (s) =>
          s.players[melanioSide].attack === null &&
          s.players[melanioSide].cooldown === 0 &&
          s.players[melanioSide].history.some(
            (entry) => entry.action === "heavy",
          ),
      );

      const energy = player.energy;
      sendInput(actor, state.id, action("special"));
      const launched = await actor.state(state.id, (s) =>
        s.players[melanioSide].history.some(
          (entry) => entry.action === "special",
        ),
      );
      assert.ok(launched.players[melanioSide].energy < energy - 20);
      const returned = await other.state(state.id, (s) =>
        s.projectiles.some(
          (shot) =>
            shot.kind === "signal" &&
            (shot.age ?? 0) >= (shot.returnAfter ?? Infinity),
        ),
      );
      const signal = returned.projectiles.find(
        (shot) => shot.kind === "signal",
      )!;
      assert.equal(
        signal.owner,
        melanioSide,
        "signal keeps Melanio's ownership as it returns",
      );
      assert.equal(
        Math.sign(signal.vx),
        melanioSide === 0 ? -1 : 1,
        "signal velocity points back toward Melanio's source",
      );
      const hostReturn = (
        await actor.wait(
          "state",
          (message) =>
            message.state.id === state.id &&
            message.state.tick === returned.tick,
        )
      ).state;
      assert.deepEqual(
        returned,
        hostReturn,
        "the host and guest receive the same authoritative return tick",
      );

      // Finish this room before reusing the same connected peers.
      state.players[1 - melanioSide].stocks = 1;
      state.players[1 - melanioSide].hp = 0;
      await Promise.all([
        host.state(state.id, (s) => s.phase === "finished"),
        guest.state(state.id, (s) => s.phase === "finished"),
      ]);
      host.send({ type: "rematch" });
      guest.send({ type: "rematch" });
      const [nextHost, nextGuest] = await Promise.all([
        host.wait("start"),
        guest.wait("start"),
      ]);
      assert.notEqual(nextHost.state.id, state.id);
      const next = fixture.server.rooms.get(pair.code)!.state!;
      next.phase = "playing";
      const before = next.players[melanioSide].x;
      sendInput(
        actor,
        state.id,
        input({ right: true, actions: { ...emptyInput().actions, jump: 1 } }),
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        next.players[melanioSide].x,
        before,
        "a late old-match packet cannot move Melanio after rematch",
      );
      assert.equal(
        next.players[melanioSide].jumps,
        0,
        "a late old-match packet cannot trigger a jump after rematch",
      );
      assert.equal(nextHost.state.id, nextGuest.state.id);

      host.send({ type: "leave" });
      await Promise.all([
        host.wait("left"),
        guest.wait(
          "room",
          (m) => m.room.code === pair.code && m.room.players.length === 1,
        ),
      ]);
      guest.send({ type: "leave" });
      await guest.wait("left");
    }
  } finally {
    host.socket.terminate();
    guest.socket.terminate();
    await fixture.close();
  }
});

test("duplicate, reordered and empty inputs do not replay Melanio jumps or signal emissions", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url),
    guest = new Peer(fixture.url);
  try {
    const [welcome] = await Promise.all([
      host.wait("welcome"),
      guest.wait("welcome"),
    ]);
    const { state } = await startPair(fixture.server, host, guest, [
      "melanio",
      "javier",
    ]);
    let counters = { ...emptyInput().actions };
    const jump = input({
      right: true,
      actions: { ...emptyInput().actions, jump: 4 },
    });
    counters = { ...counters, jump: 4 };
    sendInput(host, state.id, jump);
    await guest.state(
      state.id,
      (s) => s.players[0].jumps === 1 && s.players[0].x > 300,
    );
    sendInput(host, state.id, jump);
    sendInput(
      host,
      state.id,
      input({ left: true, actions: { ...emptyInput().actions, jump: 3 } }),
    ); // lower counter: reject whole packet
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      state.players[0].jumps,
      1,
      "same or lower jump counter never creates a second jump edge",
    );
    assert.equal(fixture.server.clients.get(welcome.id)?.input.actions.jump, 4);

    counters = { ...counters, special: 8 };
    const special = input({ actions: counters });
    sendInput(host, state.id, special);
    await guest.state(state.id, (s) =>
      s.players[0].history.some((entry) => entry.action === "special"),
    );
    sendInput(host, state.id, special);
    sendInput(host, state.id, input({ actions: { ...counters, special: 7 } }));
    const returned = await guest.state(state.id, (s) =>
      s.projectiles.some(
        (shot) =>
          shot.kind === "signal" &&
          (shot.age ?? 0) >= (shot.returnAfter ?? Infinity),
      ),
    );
    assert.equal(
      returned.projectiles.filter((shot) => shot.kind === "signal").length,
      1,
    );
    assert.ok(
      returned.players[0].energy < 78,
      "duplicate packets do not charge energy or re-emit the special",
    );

    const movingX = state.players[0].x;
    sendInput(host, state.id, input({ right: true, actions: counters }));
    await guest.state(state.id, (s) => s.players[0].x > movingX + 8);
    const movingFrom = state.players[0].x;
    sendInput(host, state.id, input({ actions: counters })); // browser blur/reset releases the held direction
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(fixture.server.clients.get(welcome.id)?.input.right, false);
    const stoppedAt = state.players[0].x;
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.ok(
      state.players[0].x - stoppedAt < 2,
      `empty input releases motion (last movement ${movingFrom} -> ${stoppedAt})`,
    );
  } finally {
    host.socket.terminate();
    guest.socket.terminate();
    await fixture.close();
  }
});

test("Melanio signal movement and projectiles stay isolated between live rooms", async () => {
  const fixture = await listeningServer();
  const a = new Peer(fixture.url),
    b = new Peer(fixture.url),
    c = new Peer(fixture.url),
    d = new Peer(fixture.url);
  try {
    await Promise.all([a, b, c, d].map((peer) => peer.wait("welcome")));
    const first = await startPair(fixture.server, a, b, ["melanio", "javier"]);
    const second = await startPair(fixture.server, c, d, [
      "bolivar",
      "melanio",
    ]);
    const untouchedX = second.state.players.map((p) => p.x);
    const initialSecondTick = second.state.tick;
    sendInput(
      a,
      first.state.id,
      input({ right: true, actions: { ...emptyInput().actions, special: 1 } }),
    );
    const active = await b.state(first.state.id, (s) =>
      s.projectiles.some((shot) => shot.kind === "signal"),
    );
    await Promise.all([
      c.state(second.state.id, (s) => s.tick > initialSecondTick),
      d.state(second.state.id, (s) => s.tick > initialSecondTick),
    ]);
    assert.deepEqual(
      second.state.players.map((p) => p.x),
      untouchedX,
    );
    assert.equal(
      second.state.projectiles.some((shot) => shot.kind === "signal"),
      false,
    );
    assert.deepEqual(
      active.players.map((p) => p.config.fighter),
      ["melanio", "javier"],
    );
  } finally {
    [a, b, c, d].forEach((peer) => peer.socket.terminate());
    await fixture.close();
  }
});
