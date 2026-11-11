import test from "node:test";
import assert from "node:assert/strict";
import { makeArenaServer } from "../../server/index";
import { SocketPeer } from "../helpers/socket-peer";

class Peer extends SocketPeer {
  constructor(url: string) {
    super(url, {
      ignore: ["state", "rooms"],
      timeoutMs: 10_000,
      failOnError: true,
    });
  }
}

test("guests can connect and start matches beyond the former 300-connection and 100-room limits", async () => {
  const server = await makeArenaServer({
    serveClient: false,
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  assert.ok(address && typeof address === "object");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const peers: Peer[] = [];
  try {
    for (let offset = 0; offset < 302; offset += 50) {
      const batch = Array.from(
        { length: Math.min(50, 302 - offset) },
        () => new Peer(url),
      );
      peers.push(...batch);
      await Promise.all(batch.map((peer) => peer.wait("welcome")));
    }
    assert.equal(server.clients.size, 302);

    const hosts = peers.filter((_peer, index) => index % 2 === 0);
    hosts.forEach((host, index) =>
      host.send({
        type: "create",
        name: `Host ${index}`,
        fighter: "zavarce",
        stage: "caracas",
        wins: 0,
        private: true,
      }),
    );
    const rooms = await Promise.all(hosts.map((host) => host.wait("room")));
    assert.equal(server.rooms.size, 151);
    const joined = peers
      .filter((_peer, index) => index % 2 === 1)
      .map((guest, index) => {
        guest.send({
          type: "join",
          code: rooms[index].room.code,
          name: `Guest ${index}`,
          fighter: "capriles",
          wins: 0,
        });
        return guest.wait("room");
      });
    await Promise.all(joined);
    peers.forEach((peer) => peer.send({ type: "ready", ready: true }));
    const starts = await Promise.all(peers.map((peer) => peer.wait("start")));
    assert.equal(new Set(starts.map((message) => message.state.id)).size, 151);
    assert.ok(
      [...server.rooms.values()].every(
        (room) => room.view.status === "playing",
      ),
    );
    assert.equal(server.clients.size, 302);
  } finally {
    peers.forEach((peer) => peer.socket.terminate());
    await server.close();
  }
});
