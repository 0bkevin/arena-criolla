import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { makeArenaServer } from "../server/index";
import { emptyInput } from "../shared/engine";
import type { ServerMessage } from "../shared/protocol";
import { FIGHTERS, STAGES, platformsAtTick } from "../shared/content";

class TestClient {
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
  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const end = Date.now() + 4000;
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

async function onlineMatch(stage: (typeof STAGES)[number]["id"] = "poliedro") {
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
    fighter: "zavarce",
    stage,
    wins: 0,
    private: true,
  });
  const { room } = await a.wait("room");
  b.send({
    type: "join",
    code: room.code,
    name: "Guest",
    fighter: "vallenilla",
    wins: 0,
  });
  await a.wait("room", (message) => message.room.players.length === 2);
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  await Promise.all([a.wait("start"), b.wait("start")]);
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

test("stalled online input releases held controls without replaying actions, then recovers", async () => {
  const match = await onlineMatch();
  try {
    const input = emptyInput();
    input.left = true;
    input.block = true;
    input.down = true;
    input.actions.light = 1;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    const held = await match.a.wait(
      "state",
      (message) => message.state.players[0].blocking,
    );
    const released = await match.a.wait(
      "state",
      (message) =>
        message.state.tick > held.state.tick &&
        !message.state.players[0].blocking,
    );
    assert.equal(match.client.input.left, false);
    assert.equal(match.client.input.right, false);
    assert.equal(match.client.input.down, false);
    assert.equal(match.client.input.block, false);
    assert.equal(
      match.client.input.actions.light,
      1,
      "expiry preserves consumed action counters",
    );
    assert.equal(match.active.state!.players[0].hits, 0);

    input.left = false;
    input.right = true;
    input.block = false;
    input.down = false;
    const x = match.active.state!.players[0].x;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    await match.a.wait(
      "state",
      (message) =>
        message.state.tick > released.state.tick &&
        message.state.players[0].x > x + 8,
    );
    assert.equal(match.client.input.right, true, "fresh input resumes control");
    assert.equal(
      match.active.state!.players[0].attack,
      null,
      "old attack is not replayed",
    );
  } finally {
    await match.close();
  }
});

test("older action counters cannot trigger a second jump or overwrite held controls", async () => {
  const match = await onlineMatch();
  try {
    const input = emptyInput();
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 1,
    );
    const older = emptyInput();
    older.right = true;
    match.a.send({
      type: "input",
      matchId: match.active.state!.id,
      input: older,
    });
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(match.client.input.actions.jump, 1);
    assert.equal(match.client.input.right, false);
    assert.equal(match.active.state!.players[0].jumps, 1);
    input.actions.jump = 2;
    match.a.send({ type: "input", matchId: match.active.state!.id, input });
    await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 2,
    );
  } finally {
    await match.close();
  }
});

test("rematches reject previous-match input and accept the first fresh action", async () => {
  const match = await onlineMatch();
  try {
    const previousId = match.active.state!.id;
    const input = emptyInput();
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: previousId, input });
    await match.a.wait(
      "state",
      (message) => message.state.players[0].jumps === 1,
    );
    match.active.state!.players[1].stocks = 1;
    match.active.state!.players[1].hp = 0;
    await match.a.wait(
      "state",
      (message) => message.state.phase === "finished",
    );
    match.a.send({ type: "rematch" });
    match.b.send({ type: "rematch" });
    const [next, peer] = await Promise.all([
      match.a.wait("start"),
      match.b.wait("start"),
    ]);
    assert.deepEqual(next.state, peer.state);
    assert.notEqual(next.state.id, previousId);
    input.right = true;
    input.actions.jump = 5;
    match.a.send({ type: "input", matchId: previousId, input });
    match.a.send({ type: "input", input });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(match.client.input, emptyInput());
    match.active.state!.phase = "playing";
    input.actions.jump = 1;
    match.a.send({ type: "input", matchId: next.state.id, input });
    const jumped = await match.a.wait(
      "state",
      (message) =>
        message.state.id === next.state.id &&
        message.state.players[0].jumps === 1,
    );
    assert.ok(jumped.state.players[0].x > 330);
    assert.equal(jumped.state.players[0].config.wins, 1);
  } finally {
    await match.close();
  }
});

test("online double knockouts synchronize a draw and award neither player a win", async () => {
  const match = await onlineMatch();
  try {
    match.active.state!.players.forEach((player) => {
      player.stocks = 1;
      player.hp = 0;
    });
    const [a, b] = await Promise.all([
      match.a.wait("state", (message) => message.state.phase === "finished"),
      match.b.wait("state", (message) => message.state.phase === "finished"),
    ]);
    assert.equal(a.state.winner, "draw");
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(
      match.active.view.players.map((player) => player.wins),
      [0, 0],
    );
    match.a.send({ type: "rematch" });
    match.b.send({ type: "rematch" });
    const next = await match.a.wait("start");
    assert.ok(
      next.state.players.every(
        (player) => player.stocks === 2 && player.config.wins === 0,
      ),
    );
  } finally {
    await match.close();
  }
});

test("all nine stages synchronize movement and special attacks over real sockets", async () => {
  for (const stage of STAGES) {
    const match = await onlineMatch(stage.id);
    try {
      const input = emptyInput();
      input.right = true;
      input.actions.special = 1;
      match.a.send({ type: "input", matchId: match.active.state!.id, input });
      const a = await match.a.wait(
        "state",
        (message) => message.state.players[0].x > 340,
      );
      const b = await match.b.wait(
        "state",
        (message) => message.state.tick === a.state.tick,
      );
      assert.equal(a.state.stage, stage.id);
      assert.deepEqual(a.state, b.state, stage.id);
      assert.equal(a.state.players[0].lastActions.special, 1);
      assert.ok(
        a.state.players.every(
          (player) => Number.isFinite(player.x) && Number.isFinite(player.y),
        ),
      );
    } finally {
      await match.close();
    }
  }
});

test("online riders agree on moving-platform carry, jumping and dropping through all five mechanisms", async () => {
  for (const stage of STAGES.filter((s) => s.platforms.some((p) => p.motion))) {
    const match = await onlineMatch(stage.id);
    try {
      const state = match.active.state!;
      const index = stage.platforms.findIndex((p) => p.motion);
      const rider = state.players[0];
      const placeRider = () => {
        const platform = platformsAtTick(stage.id, state.tick)[index];
        Object.assign(rider, {
          x: platform.x + platform.width / 2,
          y: platform.y,
          vx: 0,
          vy: 0,
          grounded: true,
          supportPlatform: index,
          jumps: 0,
          dropThrough: 0,
        });
        state.players[1].x = 50;
        return state.tick;
      };
      const start = placeRider();
      const carried = await match.a.wait(
        "state",
        (m) => m.state.tick >= start + 10,
      );
      const remote = await match.b.wait(
        "state",
        (m) => m.state.tick === carried.state.tick,
      );
      assert.deepEqual(carried.state, remote.state, stage.id);
      const surface = platformsAtTick(stage.id, carried.state.tick)[index];
      assert.equal(carried.state.players[0].supportPlatform, index);
      assert.equal(carried.state.players[0].y, surface.y);
      assert.ok(
        Math.abs(carried.state.players[0].x - surface.x - surface.width / 2) <
          0.002,
      );

      const input = emptyInput();
      input.down = true;
      match.a.send({ type: "input", matchId: state.id, input });
      const dropped = await match.a.wait(
        "state",
        (m) => m.state.players[0].dropThrough > 0,
      );
      assert.equal(dropped.state.players[0].supportPlatform, null);
      assert.equal(dropped.state.players[0].grounded, false);
      input.down = false;
      match.a.send({ type: "input", matchId: state.id, input });
      const landed = await match.a.wait(
        "state",
        (m) =>
          m.state.tick > dropped.state.tick &&
          m.state.players[0].supportPlatform === -1,
      );
      const landedRemote = await match.b.wait(
        "state",
        (m) => m.state.tick === landed.state.tick,
      );
      assert.deepEqual(landed.state, landedRemote.state, stage.id + " floor");
      assert.equal(landed.state.players[0].stocks, 2);

      const jumpTick = placeRider();
      input.actions.jump++;
      match.a.send({ type: "input", matchId: state.id, input });
      const jumped = await match.a.wait(
        "state",
        (m) => m.state.tick > jumpTick && m.state.players[0].jumps === 1,
      );
      assert.equal(jumped.state.players[0].supportPlatform, null);
      assert.ok(jumped.state.players[0].vy < 0);
      const jumpedRemote = await match.b.wait(
        "state",
        (m) => m.state.tick === jumped.state.tick,
      );
      assert.deepEqual(jumped.state, jumpedRemote.state, stage.id + " jump");
    } finally {
      await match.close();
    }
  }
});

test("anonymous rooms synchronize two players, validate inputs, rematch, and recover from disconnect", async () => {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const a = new TestClient(url);
  const b = new TestClient(url);
  const c = new TestClient(url);
  try {
    const [aWelcome, bWelcome] = await Promise.all([
      a.wait("welcome"),
      b.wait("welcome"),
      c.wait("welcome"),
    ]);
    a.send({
      type: "create",
      name: "<Pana Uno>",
      fighter: "zavarce",
      stage: "caracas",
      wins: 0,
      private: false,
    });
    const { room } = await a.wait("room");
    assert.equal(room.players[0].name, "Pana Uno");
    assert.equal(room.host, aWelcome.id);
    await b.wait("rooms", (m) => m.rooms.some((r) => r.code === room.code));
    b.send({
      type: "join",
      code: room.code.toLowerCase(),
      name: "Pana Dos",
      fighter: "capriles",
      wins: 0,
    });
    const joined = await a.wait("room", (m) => m.room.players.length === 2);
    assert.equal(joined.room.players[1].id, bWelcome.id);
    c.send({
      type: "join",
      code: room.code,
      name: "Pana Tres",
      fighter: "zavarce",
      wins: 0,
    });
    await c.wait("error", (m) => m.message.includes("ocupada"));
    b.send({ type: "select", stage: "valencia" });
    await new Promise((resolve) => setTimeout(resolve, 35));
    assert.equal(server.rooms.get(room.code)!.view.stage, "caracas");
    a.send({ type: "select", stage: "guaira" });
    await a.wait("room", (m) => m.room.stage === "guaira");
    a.send({ type: "ready", ready: true });
    b.send({ type: "ready", ready: true });
    const [first, second] = await Promise.all([
      a.wait("start"),
      b.wait("start"),
    ]);
    assert.equal(first.state.id, second.state.id);
    assert.equal(first.index, 0);
    assert.equal(second.index, 1);
    assert.equal(first.state.stage, "guaira");
    const active = server.rooms.get(room.code)!;
    active.state!.phase = "playing";
    active.state!.players.forEach((p) => {
      p.invincible = 0;
    });
    const input = emptyInput();
    input.right = true;
    a.send({ type: "input", matchId: active.state!.id, input });
    const moved = await a.wait("state", (m) => m.state.players[0].x > 335);
    assert.ok(moved.state.players[0].x > 335);
    const prior = server.clients.get(aWelcome.id)!.input.actions.light;
    a.send({
      type: "input",
      matchId: active.state!.id,
      input: { ...input, actions: { ...input.actions, light: -4 } },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(server.clients.get(aWelcome.id)!.input.actions.light, prior);
    active.state!.players[1].stocks = 1;
    active.state!.players[1].hp = 0;
    const [finalA, finalB] = await Promise.all([
      a.wait("state", (m) => m.state.phase === "finished"),
      b.wait("state", (m) => m.state.phase === "finished"),
    ]);
    assert.equal(finalA.state.winner, 0);
    assert.deepEqual(finalA.state, finalB.state);
    assert.equal(active.view.players[0].wins, 1);
    a.send({ type: "rematch" });
    await a.wait(
      "room",
      (m) => m.room.status === "finished" && m.room.players[0].ready,
    );
    b.send({ type: "rematch" });
    const [againA, againB] = await Promise.all([
      a.wait("start"),
      b.wait("start"),
    ]);
    assert.equal(againA.state.id, againB.state.id);
    assert.notEqual(againA.state.id, first.state.id);
    assert.equal(againA.state.players[0].config.wins, 1);
    a.socket.close();
    await b.wait("opponent-left");
    const recovered = await b.wait("room", (m) => m.room.players.length === 1);
    assert.equal(recovered.room.host, bWelcome.id);
    assert.equal(recovered.room.status, "waiting");
    b.send({ type: "leave" });
    await b.wait("left");
    assert.equal(server.rooms.size, 0);
    b.send({
      type: "create",
      name: "Privada",
      fighter: "capriles",
      stage: "valencia",
      wins: 0,
      private: true,
    });
    const privateRoom = await b.wait("room");
    c.send({ type: "list" });
    const publicRooms = await c.wait(
      "rooms",
      (m) => !m.rooms.some((r) => r.code === privateRoom.room.code),
    );
    assert.ok(!publicRooms.rooms.some((r) => r.code === privateRoom.room.code));
    c.send({
      type: "join",
      code: privateRoom.room.code,
      name: "Invitado",
      fighter: "javier",
      wins: 0,
    });
    await b.wait("room", (m) => m.room.players.length === 2);
  } finally {
    a.socket.terminate();
    b.socket.terminate();
    c.socket.terminate();
    await server.close();
  }
});

test("anonymous rooms synchronize Lele's launched trap reflected by Dudamel", async () => {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const a = new TestClient(url),
    b = new TestClient(url);
  try {
    await Promise.all([a.wait("welcome"), b.wait("welcome")]);
    a.send({
      type: "create",
      name: "Lele",
      fighter: "lele",
      stage: "guaira",
      wins: 0,
      private: true,
    });
    const { room } = await a.wait("room");
    b.send({
      type: "join",
      code: room.code,
      name: "Batuta",
      fighter: "dudamel",
      wins: 0,
    });
    await a.wait("room", (m) => m.room.players.length === 2);
    a.send({ type: "ready", ready: true });
    b.send({ type: "ready", ready: true });
    await Promise.all([a.wait("start"), b.wait("start")]);
    const state = server.rooms.get(room.code)!.state!;
    state.phase = "playing";
    state.players.forEach((p) => {
      p.invincible = 0;
      p.energy = 60;
    });
    state.players[0].x = 400;
    state.players[1].x = 630;
    const input = emptyInput();
    input.actions.special++;
    a.send({ type: "input", matchId: state.id, input });
    b.send({ type: "input", matchId: state.id, input });
    const [left, right] = await Promise.all([
      a.wait("state", (m) =>
        m.state.projectiles.some((p) => p.kind === "prank" && p.owner === 1),
      ),
      b.wait("state", (m) =>
        m.state.projectiles.some((p) => p.kind === "prank" && p.owner === 1),
      ),
    ]);
    assert.deepEqual(left.state, right.state);
    assert.equal(left.state.players[0].config.fighter, "lele");
    assert.equal(left.state.players[1].config.fighter, "dudamel");
    assert.ok(
      left.state.projectiles.some(
        (p) => p.vx < 0 && p.plantAfter === undefined,
      ),
    );
    assert.ok(left.state.players.every((p) => p.energy < 40));
  } finally {
    a.socket.terminate();
    b.socket.terminate();
    await server.close();
  }
});

test("anonymous rooms accept every expanded fighter and reject retired characters", async () => {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const client = new TestClient(`ws://127.0.0.1:${address.port}/ws`);
  try {
    await client.wait("welcome");
    for (const fighter of FIGHTERS) {
      client.send({
        type: "create",
        name: "Pana",
        fighter: fighter.id,
        stage: "caracas",
        wins: 0,
        private: true,
      });
      const { room } = await client.wait("room");
      assert.equal(room.players[0].fighter, fighter.id);
      client.send({ type: "leave" });
      await client.wait("left");
    }
    for (const stage of STAGES) {
      client.send({
        type: "create",
        name: "Explorador",
        fighter: "zavarce",
        stage: stage.id,
        wins: 0,
        private: true,
      });
      const { room } = await client.wait("room");
      assert.equal(room.stage, stage.id);
      client.send({ type: "leave" });
      await client.wait("left");
    }
    for (const fighter of ["delsa", "lacava", "john", "kilometro"]) {
      client.send({
        type: "create",
        name: "Pana",
        fighter,
        stage: "caracas",
        wins: 0,
        private: true,
      });
      await client.wait("error", (message) =>
        message.message.includes("válidos"),
      );
      assert.equal(server.rooms.size, 0);
    }
  } finally {
    client.socket.terminate();
    await server.close();
  }
});
