import test from "node:test";
import assert from "node:assert/strict";
import { makeArenaServer } from "../../server/index";
import {
  emptyInput,
  type Input,
  type MatchState,
} from "../../shared/engine/engine";
import type { FighterId } from "../../shared/roster/roster";
import { SocketPeer } from "../helpers/socket-peer";

class Peer extends SocketPeer {
  async state(matchId: string, predicate: (state: MatchState) => boolean) {
    return (
      await this.wait(
        "state",
        (message) => message.state.id === matchId && predicate(message.state),
      )
    ).state;
  }

  protected override timeoutDetail() {
    return `; latest state: ${JSON.stringify(this.messages.filter((message) => message.type === "state").at(-1))}`;
  }
}

async function listeningServer() {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    url: `ws://127.0.0.1:${address.port}/ws`,
    close: () => server.close(),
  };
}

async function startPair(
  server: Awaited<ReturnType<typeof makeArenaServer>>,
  host: Peer,
  guest: Peer,
  fighters: [FighterId, FighterId],
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

test("Melanio signal returns to its owner with synchronized ownership and velocity on either seat", async () => {
  const fixture = await listeningServer();
  const host = new Peer(fixture.url),
    guest = new Peer(fixture.url);
  try {
    await Promise.all([host.wait("welcome"), guest.wait("welcome")]);
    for (const melanioSide of [0, 1] as const) {
      const fighters: [FighterId, FighterId] =
        melanioSide === 0 ? ["melanio", "javier"] : ["javier", "melanio"];
      const pair = await startPair(fixture.server, host, guest, fighters);
      const actor = melanioSide === 0 ? host : guest;
      const other = melanioSide === 0 ? guest : host;
      const { state } = pair;
      const energy = state.players[melanioSide].energy;
      sendInput(
        actor,
        state.id,
        input({ actions: { ...emptyInput().actions, special: 1 } }),
      );
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
      assert.equal(signal.owner, melanioSide);
      assert.equal(Math.sign(signal.vx), melanioSide === 0 ? -1 : 1);
      const mirrored = (
        await actor.wait(
          "state",
          (message) =>
            message.state.id === state.id &&
            message.state.tick === returned.tick,
        )
      ).state;
      assert.deepEqual(returned, mirrored);

      host.send({ type: "leave" });
      await Promise.all([
        host.wait("left"),
        guest.wait(
          "room",
          (message) =>
            message.room.code === pair.code &&
            message.room.players.length === 1,
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
