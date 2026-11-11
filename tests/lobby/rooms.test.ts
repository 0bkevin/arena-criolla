import test from "node:test";
import assert from "node:assert/strict";
import { makeArenaServer } from "../../server/index";
import { emptyInput } from "../../shared/engine/engine";
import type { ClientMessage } from "../../shared/lobby/protocol";
import { TestClient } from "../helpers/online-match";

test("players create, find, join and start a room without choosing names", async (t) => {
  const server = await makeArenaServer({ serveClient: false });
  t.after(() => server.close());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const host = new TestClient(url);
  const guest = new TestClient(url);
  await Promise.all([host.wait("welcome"), guest.wait("welcome")]);

  host.send({
    type: "create",
    fighter: "zavarce",
    stage: "caracas",
    wins: 2,
    private: false,
  } satisfies ClientMessage);
  const { room } = await host.wait("room");
  assert.equal(room.players[0].name, "Jugador 1");
  assert.equal(room.name, `Sala ${room.code.slice(0, 6)}`);
  const listed = await guest.wait("rooms", (message) =>
    message.rooms.some((listedRoom) => listedRoom.code === room.code),
  );
  assert.equal(listed.rooms.find((r) => r.code === room.code)?.name, room.name);

  guest.send({
    type: "join",
    code: room.code,
    fighter: "zavarce",
    wins: 0,
  } satisfies ClientMessage);
  const joined = await host.wait(
    "room",
    (message) => message.room.players.length === 2,
  );
  assert.deepEqual(
    joined.room.players.map((player) => player.name),
    ["Jugador 1", "Jugador 2"],
  );
  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  const starts = await Promise.all([host.wait("start"), guest.wait("start")]);
  assert.deepEqual(starts[0].state, starts[1].state);
  assert.deepEqual(
    starts[0].state.players.map((player) => player.config.name),
    ["Jugador 1", "Jugador 2"],
  );
  assert.deepEqual(
    starts[0].state.players.map((player) => player.config.wins),
    [2, 0],
  );
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
    b.send({ type: "ready", ready: true });
    await a.wait("room", (m) => m.room.players[1]?.ready === true);
    a.send({ type: "select", stage: "guaira" });
    await a.wait(
      "room",
      (m) => m.room.stage === "guaira" && m.room.players.every((p) => !p.ready),
    );
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

test("anonymous rooms reject retired characters", async () => {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const client = new TestClient(`ws://127.0.0.1:${address.port}/ws`);
  try {
    await client.wait("welcome");
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
