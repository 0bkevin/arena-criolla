// Online lobby and authoritative match loop as one Cloudflare Durable Object.
// The room rules live in shared/lobby; this only adapts Workers WebSockets.
import { DurableObject } from "cloudflare:workers";
import { Lobby } from "../shared/lobby/lobby";

const MAX_MESSAGE_BYTES = 4096;

export class ArenaLobby extends DurableObject {
  private lobby = new Lobby<WebSocket>({
    send: (socket, data) => {
      try {
        socket.send(data);
      } catch {}
    },
    replace: (socket) => {
      try {
        socket.close(4000, "replaced");
      } catch {}
    },
  });

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health")
      return Response.json({
        status: "ok",
        rooms: this.lobby.rooms.size,
        players: this.lobby.clients.size,
      });
    if (url.pathname === "/api/rooms")
      return Response.json(this.lobby.publicRooms());
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response(null, { status: 426 });
    const protocols = (request.headers.get("Sec-WebSocket-Protocol") ?? "")
      .split(",")
      .map((protocol) => protocol.trim())
      .filter(Boolean);
    const pair = new WebSocketPair();
    const [browser, server] = [pair[0], pair[1]];
    server.accept();
    this.attach(server, protocols);
    const headers = new Headers();
    // Like `ws`, select the first offered subprotocol.
    if (protocols.length) headers.set("Sec-WebSocket-Protocol", protocols[0]);
    return new Response(null, { status: 101, webSocket: browser, headers });
  }

  private attach(socket: WebSocket, protocols: string[]) {
    const client = this.lobby.connect(socket, protocols);
    const close = () => this.lobby.disconnect(client, socket);
    socket.addEventListener("close", close);
    socket.addEventListener("error", close);
    socket.addEventListener("message", (event) => {
      if (client.socket !== socket || typeof event.data !== "string") return;
      // A UTF-16 length over the limit always means more bytes than that.
      if (
        event.data.length > MAX_MESSAGE_BYTES ||
        new TextEncoder().encode(event.data).byteLength > MAX_MESSAGE_BYTES
      ) {
        try {
          socket.close(1009, "too big");
        } catch {}
        return;
      }
      this.lobby.receive(client, event.data);
    });
  }
}
