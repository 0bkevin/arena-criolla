import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { makeArenaServer } from "../../server/index";
import { SocketPeer } from "../helpers/socket-peer";

test("the Node server ignores binary frames, as the Worker does", async () => {
  const server = await makeArenaServer({ serveClient: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const { port } = server.http.address() as AddressInfo;
  const peer = new SocketPeer(`ws://127.0.0.1:${port}/ws`);
  try {
    await peer.wait("welcome");
    // Let the debounced room-list broadcast after connecting arrive first.
    await new Promise((resolve) => setTimeout(resolve, 300));
    peer.messages.length = 0;
    peer.socket.send(Buffer.from(JSON.stringify({ type: "list" })), {
      binary: true,
    });
    peer.socket.send(Buffer.from("{broken"), { binary: true });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.deepEqual(peer.messages, [], "binary frames got a reply");
    peer.send({ type: "list" });
    await peer.wait("rooms");
  } finally {
    peer.socket.terminate();
    await server.close();
  }
});
