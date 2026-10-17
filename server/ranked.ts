import { WebSocket } from "ws";
import { emptyInput, type MatchState } from "../shared/engine";
import type { ServerMessage } from "../shared/protocol";
import {
  RANKED_RECONNECT_MS,
  type RankedFinish,
  type RankingReason,
} from "../shared/ranking";
import type { Client, Room } from "./arena-types";
import type { CreatorDatabase } from "./creator/database";
import { RankingStore } from "./ranking";

interface Dependencies {
  rooms: Map<string, Room>;
  clients: Map<string, Client>;
  db: CreatorDatabase;
  store: RankingStore;
  send: (client: Client, message: ServerMessage) => void;
  publishRoom: (room: Room) => void;
  roomsChanged: () => void;
  allowedFighter: (id: unknown) => boolean;
  reconnectMs: number;
}

/** Owns ranked eligibility, disconnect leases, authenticated resume and result
 * retries. Casual room behavior and the simulation remain outside this module. */
export class RankedGames {
  private deps: Dependencies;
  private reconnects = new Map<
    Client,
    {
      timer: ReturnType<typeof setTimeout>;
      until: number;
      beganAt: number;
      allowance: number;
    }
  >();
  private recoveryBudgets = new Map<string, Map<string, number>>();
  private pending = new Map<
    string,
    {
      payload: RankedFinish;
      attempt: number;
      timer?: ReturnType<typeof setTimeout>;
      task?: Promise<void>;
    }
  >();
  private stopping = false;
  constructor(
    deps: Omit<Dependencies, "reconnectMs"> & { reconnectMs?: number },
  ) {
    this.deps = {
      ...deps,
      reconnectMs: deps.reconnectMs ?? RANKED_RECONNECT_MS,
    };
  }
  authenticated(client: Client) {
    return Boolean(
      client.account &&
      client.sessionHash &&
      this.deps.db.session(client.sessionHash)?.id === client.account.id,
    );
  }
  canEnter(client: Client, room?: Room) {
    if (!this.authenticated(client))
      throw new Error(
        "Inicia sesión para jugar una clasificatoria y entrar al ranking.",
      );
    for (const active of this.deps.rooms.values()) {
      if (
        active.view.ranked &&
        active.view.status !== "finished" &&
        active.clients.some((other) => other.account?.id === client.account!.id)
      )
        throw new Error(
          "Tu cuenta ya tiene una sala clasificatoria. Vuelve a esa pestaña o sal de la sala.",
        );
    }
    if (room?.clients.some((other) => other.account?.id === client.account!.id))
      throw new Error("Una cuenta no puede competir contra sí misma.");
  }
  async prepare(room: Room, state: MatchState) {
    const peers = [...room.clients];
    if (
      peers.some(
        (peer) =>
          !this.authenticated(peer) ||
          peer.socket.readyState !== WebSocket.OPEN,
      )
    )
      throw new Error(
        "Ambos jugadores necesitan una sesión activa para la clasificatoria.",
      );
    if (peers[0].account!.id === peers[1].account!.id)
      throw new Error("Necesitas dos cuentas distintas.");
    room.view.starting = true;
    this.deps.publishRoom(room);
    try {
      await this.deps.store.request("begin", {
        matchId: state.id,
        stage: state.stage,
        players: [
          { ...peers[0].account!, fighter: state.players[0].config.fighter },
          { ...peers[1].account!, fighter: state.players[1].config.fighter },
        ],
      });
      const valid =
        this.deps.rooms.get(room.view.code) === room &&
        room.clients.length === 2 &&
        peers.every(
          (peer, i) =>
            room.clients[i] === peer &&
            peer.room === room.view.code &&
            this.authenticated(peer) &&
            peer.socket.readyState === WebSocket.OPEN &&
            room.view.players[i].ready &&
            this.deps.allowedFighter(room.view.players[i].fighter),
        );
      if (!valid) {
        this.persist({
          matchId: state.id,
          winner: null,
          reason: "start_cancelled",
        });
        return false;
      }
      this.recoveryBudgets.set(
        state.id,
        new Map(peers.map((peer) => [peer.account!.id, this.deps.reconnectMs])),
      );
      return true;
    } finally {
      delete room.view.starting;
    }
  }
  complete(room: Room, reason: RankingReason = "combat") {
    const state = room.state!;
    this.recoveryBudgets.delete(state.id);
    room.view.status = "finished";
    delete room.view.reconnectUntil;
    room.clients.forEach((peer) => this.clearLease(peer));
    room.view.players.forEach((player, index) => {
      player.ready = false;
      if (state.winner === index) player.wins++;
    });
    room.clients.forEach((peer) => {
      if (peer.room === room.view.code)
        this.deps.send(peer, { type: "state", state });
    });
    this.deps.publishRoom(room);
    this.persist({
      matchId: state.id,
      winner: state.winner === 0 ? 0 : state.winner === 1 ? 1 : "draw",
      reason,
      players: state.players.map((p) => ({
        hits: p.hits,
        peakCombo: p.peakCombo,
      })) as RankedFinish["players"],
    });
  }
  private persist(payload: RankedFinish) {
    if (this.pending.has(payload.matchId) || this.stopping) return;
    const job = { payload, attempt: 0 } as {
      payload: RankedFinish;
      attempt: number;
      timer?: ReturnType<typeof setTimeout>;
      task?: Promise<void>;
    };
    this.pending.set(payload.matchId, job);
    const run = () => {
      job.task = this.deps.store
        .request("finish", payload)
        .then((results) => {
          this.pending.delete(payload.matchId);
          for (const { userId, receipt } of results)
            this.deps.clients.forEach((peer) => {
              if (peer.account?.id === userId)
                this.deps.send(peer, {
                  type: "ranked-result",
                  result: receipt,
                });
            });
        })
        .catch(() => {
          if (!this.stopping) {
            job.timer = setTimeout(
              run,
              Math.min(250 * 2 ** job.attempt++, 5000),
            );
            job.timer.unref();
          }
        });
    };
    run();
  }
  private clearLease(client: Client) {
    const lease = this.reconnects.get(client);
    if (lease) clearTimeout(lease.timer);
    this.reconnects.delete(client);
  }
  private offline(client: Client, room: Room) {
    client.input = emptyInput();
    const player = room.view.players.find((p) => p.id === client.id);
    if (player) player.connected = false;
  }
  private expire(client: Client, room: Room) {
    this.clearLease(client);
    if (room.view.status !== "playing" || !room.clients.includes(client))
      return;
    const bothGone = room.clients.every(
      (peer) =>
        peer.socket.readyState !== WebSocket.OPEN ||
        peer.room !== room.view.code,
    );
    room.state!.phase = "finished";
    room.state!.winner = bothGone
      ? "draw"
      : room.clients.indexOf(client) === 0
        ? 1
        : 0;
    if (bothGone) {
      room.view.status = "finished";
      room.clients.forEach((peer) => this.clearLease(peer));
      this.recoveryBudgets.delete(room.state!.id);
      this.persist({
        matchId: room.state!.id,
        winner: null,
        reason: "both_disconnected",
      });
      this.deps.rooms.delete(room.view.code);
    } else this.complete(room, "forfeit");
    this.deps.roomsChanged();
  }
  disconnect(client: Client) {
    const room = client.room ? this.deps.rooms.get(client.room) : undefined;
    if (
      !room ||
      !room.view.ranked ||
      !room.state ||
      !["playing", "finished"].includes(room.view.status)
    )
      return false;
    if (this.stopping) return true;
    this.offline(client, room);
    if (room.view.status === "playing") {
      const allowance =
        this.recoveryBudgets.get(room.state.id)?.get(client.account!.id) ??
        this.deps.reconnectMs;
      const beganAt = performance.now(),
        until = Date.now() + allowance;
      this.clearLease(client);
      const timer = setTimeout(() => this.expire(client, room), allowance);
      this.reconnects.set(client, { timer, until, beganAt, allowance });
      room.view.reconnectUntil = Math.min(
        ...room.clients.flatMap(
          (peer) => this.reconnects.get(peer)?.until ?? [],
        ),
      );
    } else if (
      room.clients.every(
        (peer) =>
          peer.socket.readyState !== WebSocket.OPEN ||
          peer.room !== room.view.code,
      )
    ) {
      this.deps.rooms.delete(room.view.code);
    }
    this.deps.publishRoom(room);
    this.deps.roomsChanged();
    return true;
  }
  leave(client: Client) {
    const room = client.room ? this.deps.rooms.get(client.room) : undefined;
    if (!room?.view.ranked || room.view.status !== "playing" || !room.state)
      return false;
    this.offline(client, room);
    room.state.phase = "finished";
    room.state.winner = room.clients.indexOf(client) === 0 ? 1 : 0;
    this.complete(room, "forfeit");
    client.room = null;
    this.deps.publishRoom(room);
    this.deps.send(client, { type: "left" });
    if (
      room.clients.every(
        (peer) =>
          peer.room !== room.view.code ||
          peer.socket.readyState !== WebSocket.OPEN,
      )
    )
      this.deps.rooms.delete(room.view.code);
    this.deps.roomsChanged();
    return true;
  }
  async resume(client: Client, matchId: string) {
    if (client.resumeAttempted) return;
    client.resumeAttempted = true;
    if (!this.authenticated(client)) {
      this.deps.send(client, {
        type: "resume-unavailable",
        message:
          "Inicia sesión de nuevo para consultar el resultado de tu pelea.",
      });
      return;
    }
    const room = [...this.deps.rooms.values()].find(
      (candidate) =>
        candidate.view.ranked &&
        candidate.state?.id === matchId &&
        candidate.clients.some(
          (peer) => peer.account?.id === client.account!.id,
        ),
    );
    if (!room || client.room) {
      const result = await this.deps.store.request("receipt", {
        userId: client.account!.id,
        matchId,
      });
      if (result) this.deps.send(client, { type: "ranked-result", result });
      this.deps.send(client, {
        type: "resume-unavailable",
        message:
          "La pelea ya no está en curso. Revisa tu historial en el ranking.",
      });
      return;
    }
    const index = room.clients.findIndex(
      (peer) => peer.account?.id === client.account!.id,
    );
    const prior = room.clients[index];
    if (prior === client) return;
    const lease = this.reconnects.get(prior);
    if (lease) {
      const elapsed = performance.now() - lease.beganAt;
      if (elapsed >= lease.allowance) {
        this.expire(prior, room);
        if (this.deps.rooms.get(room.view.code) !== room) {
          this.deps.send(client, {
            type: "resume-unavailable",
            message: "El plazo de reconexión terminó. Revisa tu historial.",
          });
          return;
        }
      } else {
        const budgets = this.recoveryBudgets.get(matchId);
        if (budgets)
          budgets.set(
            client.account!.id,
            Math.max(
              0,
              (budgets.get(client.account!.id) ?? this.deps.reconnectMs) -
                elapsed,
            ),
          );
      }
    }
    this.clearLease(prior);
    prior.room = null;
    this.deps.send(prior, { type: "session-replaced" });
    prior.socket.close(4009, "La partida continúa en otra conexión.");
    room.clients[index] = client;
    if (room.view.host === prior.id) room.view.host = client.id;
    room.view.players[index].id = client.id;
    room.view.players[index].connected = true;
    client.room = room.view.code;
    client.input = emptyInput();
    client.inputAt = performance.now();
    room.state!.players[index].lastActions = { ...client.input.actions };
    const deadlines = room.clients.flatMap(
      (peer) => this.reconnects.get(peer)?.until ?? [],
    );
    if (deadlines.length) room.view.reconnectUntil = Math.min(...deadlines);
    else delete room.view.reconnectUntil;
    this.deps.send(client, {
      type: "start",
      state: room.state!,
      index,
      ranked: true,
    });
    this.deps.publishRoom(room);
    if (room.view.status === "finished") {
      const result = await this.deps.store.request("receipt", {
        userId: client.account!.id,
        matchId,
      });
      if (result) this.deps.send(client, { type: "ranked-result", result });
    }
  }
  async abandon(client: Client, matchId: string) {
    if (!this.authenticated(client)) {
      this.deps.send(client, { type: "abandon-accepted", matchId });
      return;
    }
    const room = [...this.deps.rooms.values()].find(
      (candidate) =>
        candidate.view.ranked &&
        candidate.state?.id === matchId &&
        candidate.clients.some(
          (peer) => peer.account?.id === client.account!.id,
        ),
    );
    if (room?.view.status === "playing") {
      const index = room.clients.findIndex(
        (peer) => peer.account?.id === client.account!.id,
      );
      const seat = room.clients[index];
      this.offline(seat, room);
      room.state!.phase = "finished";
      room.state!.winner = index === 0 ? 1 : 0;
      this.complete(room, "forfeit");
      seat.room = null;
      this.deps.send(seat, { type: "left" });
      this.deps.publishRoom(room);
    }
    this.deps.send(client, { type: "abandon-accepted", matchId });
  }
  async close() {
    this.stopping = true;
    this.reconnects.forEach(({ timer }) => clearTimeout(timer));
    this.reconnects.clear();
    this.recoveryBudgets.clear();
    this.pending.forEach((job) => {
      if (job.timer) clearTimeout(job.timer);
    });
    await Promise.allSettled(
      [...this.pending.values()].flatMap((job) => job.task ?? []),
    );
    await this.deps.store.close();
  }
}
