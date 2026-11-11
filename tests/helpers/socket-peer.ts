// A WebSocket client for tests against the real server. Every frame it
// receives must also pass the client's own parseServerMessage.
import { WebSocket } from "ws";
import type { ServerMessage } from "../../shared/lobby/protocol";
import { parseServerMessage } from "../../shared/lobby/server-message";

export interface SocketPeerOptions {
  protocols?: string[];
  /** Message types to drop on arrival, such as state snapshots under load. */
  ignore?: ServerMessage["type"][];
  /** How long wait() looks for a message before failing. */
  timeoutMs?: number;
  pollMs?: number;
  /** Fail a wait as soon as the server reports an error. */
  failOnError?: boolean;
}

type MessageOf<T extends ServerMessage["type"]> = Extract<
  ServerMessage,
  { type: T }
>;

export class SocketPeer {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  private readonly options: SocketPeerOptions;

  constructor(url: string, options: SocketPeerOptions = {}) {
    this.options = options;
    this.socket = new WebSocket(url, options.protocols ?? []);
    this.socket.on("error", () => {});
    this.socket.on("message", (raw) => {
      const message = parseServerMessage(JSON.parse(raw.toString()));
      if (!message)
        throw new Error(`The client would reject: ${raw.toString()}`);
      if (!options.ignore?.includes(message.type)) this.messages.push(message);
    });
  }

  send(message: object) {
    this.socket.send(JSON.stringify(message));
  }

  /** The first matching message, removed from the queue. */
  async wait<T extends ServerMessage["type"]>(
    type: T,
    predicate: (message: MessageOf<T>) => boolean = () => true,
    timeoutMs = this.options.timeoutMs ?? 4_000,
  ): Promise<MessageOf<T>> {
    const { pollMs = 10, failOnError = false } = this.options;
    const end = Date.now() + timeoutMs;
    const matches = (message: ServerMessage): message is MessageOf<T> =>
      message.type === type && predicate(message as MessageOf<T>);
    while (Date.now() < end) {
      const index = this.messages.findIndex(matches);
      const found = this.messages[index];
      if (found && matches(found)) {
        this.messages.splice(index, 1);
        return found;
      }
      const error = this.messages.find((message) => message.type === "error");
      if (failOnError && error?.type === "error")
        throw new Error(error.message);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    throw new Error(`Timed out waiting for ${type}${this.timeoutDetail()}`);
  }

  /** Extra context for a timeout message. */
  protected timeoutDetail() {
    return "";
  }
}
