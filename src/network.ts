import { syncCommunityCatalog } from "../shared/community";
import { creatorRequest } from "./creator-api";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RoomView,
  ServerMessage,
} from "../shared/protocol";
import type { MatchState } from "../shared/engine";
import type { ArenaAccount, RankingReceipt } from "../shared/ranking";
import {
  MAX_CLIENT_BUFFER_BYTES,
  NETWORK_HEARTBEAT_MS,
  NETWORK_TIMEOUT_MS,
} from "../shared/network";

type ResultHandler = (state: MatchState, index: number) => void;
const RESUME_KEY = "arena-ranked-resume-v1";
const ABANDON_KEY = "arena-ranked-abandon-v1";
const resumeHint = () => {
  try {
    return sessionStorage.getItem(RESUME_KEY);
  } catch {
    return null;
  }
};
const rememberMatch = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(RESUME_KEY, id);
    else sessionStorage.removeItem(RESUME_KEY);
  } catch {}
};
const pendingAbandon = () => {
  try {
    return sessionStorage.getItem(ABANDON_KEY);
  } catch {
    return null;
  }
};
const rememberAbandon = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(ABANDON_KEY, id);
    else sessionStorage.removeItem(ABANDON_KEY);
  } catch {}
};
export function useArenaNetwork(
  onResult?: ResultHandler,
  identityRevision = 0,
) {
  const socket = useRef<WebSocket | null>(null);
  const state = useRef<MatchState | null>(null);
  const resultHandler = useRef(onResult);
  resultHandler.current = onResult;
  const retireSocket = useRef<(() => void) | null>(null);
  const [communityVersion, setCommunityVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [id, setId] = useState("");
  const [account, setAccount] = useState<ArenaAccount | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const identity = useRef({
    external: identityRevision,
    session: sessionRevision,
  });
  const [rankingResult, setRankingResult] = useState<RankingReceipt | null>(
    null,
  );
  const [rankingRevision, setRankingRevision] = useState(0);
  const [recoveringRanked, setRecoveringRanked] = useState(() =>
    Boolean(resumeHint()),
  );
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [match, setMatch] = useState<{
    initial: MatchState;
    index: number;
    ranked: boolean;
  } | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  useEffect(() => {
    if (
      identity.current.external !== identityRevision ||
      identity.current.session !== sessionRevision
    ) {
      identity.current = {
        external: identityRevision,
        session: sessionRevision,
      };
      rememberMatch(null);
      rememberAbandon(null);
      setRecoveringRanked(false);
      setConnected(false);
      setAccount(null);
      setId("");
      setRoom(null);
      setMatch(null);
      setRankingResult(null);
      state.current = null;
    }
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let monitor: ReturnType<typeof setInterval>;
    let attempts = 0;
    let displaced = false;
    let currentRoom: RoomView | null = null;
    let currentMatch: { id: string; index: number } | null = null;
    let completedId = "";
    let sessionProbe: {
      controller: AbortController;
      timer: ReturnType<typeof setTimeout>;
    } | null = null;
    let inspectSession = () => {};
    const cancelSessionProbe = () => {
      if (!sessionProbe) return;
      clearTimeout(sessionProbe.timer);
      sessionProbe.controller.abort();
      sessionProbe = null;
    };
    const focus = () => inspectSession();
    const visible = () => {
      if (document.visibilityState === "visible") inspectSession();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const detach = (ws: WebSocket) => {
      ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* Already closed or never established. */
      }
    };
    const retire = (ws: WebSocket) => {
      if (disposed || socket.current !== ws) return;
      socket.current = null;
      cancelSessionProbe();
      clearInterval(monitor);
      detach(ws);
      currentRoom = null;
      currentMatch = null;
      state.current = null;
      setConnected(false);
      setId("");
      setAccount(null);
      setRecoveringRanked(Boolean(resumeHint()));
      setOnline(0);
      setLatencyMs(null);
      setRoom(null);
      setRooms([]);
      setMatch(null);
      setOpponentLeft(false);
      setError(
        displaced
          ? "Tu partida continúa en otra pestaña o dispositivo."
          : "Se perdió la conexión. Reconectando con la arena…",
      );
      const delay = Math.min(1000 * 2 ** attempts++, 10_000);
      reconnect = setTimeout(
        connect,
        Math.min(delay * (0.8 + Math.random() * 0.4), 10_000),
      );
    };
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
      );
      socket.current = ws;
      retireSocket.current = () => retire(ws);
      let lastReceived = performance.now();
      let lastPong = lastReceived;
      let openedAt = lastReceived;
      let lastMonitor = lastReceived;
      const pendingPings = new Set<number>();
      let welcomed = false;
      let accountId: string | null = null;
      const active = () => !disposed && socket.current === ws;
      inspectSession = () => {
        if (!active() || !welcomed) return;
        // A new focus may follow another tab changing the cookie while an old
        // request is in flight. Only the latest probe can describe that cookie.
        cancelSessionProbe();
        const controller = new AbortController();
        const probe = {
          controller,
          timer: setTimeout(() => controller.abort(), 10_000),
        };
        sessionProbe = probe;
        void creatorRequest<{ user: ArenaAccount | null }>(
          "/api/auth/session",
          { signal: controller.signal },
        )
          .then(({ user }) => {
            // Cookies can change in another tab while the old session remains
            // valid on this socket. Switch transports only after HTTP confirms
            // a different account; connection failures must preserve recovery.
            if (
              active() &&
              !controller.signal.aborted &&
              (user?.id ?? null) !== accountId
            )
              setSessionRevision((revision) => revision + 1);
          })
          .catch(() => {
            /* A failed probe does not prove a session change. */
          })
          .finally(() => {
            clearTimeout(probe.timer);
            if (sessionProbe === probe) sessionProbe = null;
          });
      };
      monitor = setInterval(() => {
        if (!active()) return;
        const now = performance.now();
        // Browsers suspend timers in background tabs or during device sleep.
        // Probe again on resume; elapsed sleep alone does not prove link loss.
        if (now - lastMonitor > NETWORK_TIMEOUT_MS) {
          lastReceived = lastPong = now;
          pendingPings.clear();
        }
        lastMonitor = now;
        if (
          now - lastReceived >= NETWORK_TIMEOUT_MS ||
          now - lastPong >= NETWORK_TIMEOUT_MS ||
          ws.bufferedAmount >= MAX_CLIENT_BUFFER_BYTES
        ) {
          retire(ws);
          return;
        }
        if (ws.readyState === WebSocket.OPEN) {
          try {
            pendingPings.add(now);
            ws.send(JSON.stringify({ type: "ping", sentAt: now }));
          } catch {
            retire(ws);
          }
        }
      }, NETWORK_HEARTBEAT_MS);
      ws.onopen = () => {
        if (!active()) return;
        lastReceived = lastPong = openedAt = performance.now();
        setConnected(true);
        if (!displaced) setError("");
        const abandon = pendingAbandon();
        if (abandon) {
          try {
            ws.send(JSON.stringify({ type: "abandon", matchId: abandon }));
          } catch {
            retire(ws);
            return;
          }
        }
        const resume = resumeHint();
        if (resume) {
          try {
            ws.send(JSON.stringify({ type: "resume", matchId: resume }));
          } catch {
            retire(ws);
          }
        }
      };
      ws.onerror = () => retire(ws);
      ws.onclose = () => retire(ws);
      ws.onmessage = (event) => {
        if (!active()) return;
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (
          !message ||
          typeof message !== "object" ||
          typeof message.type !== "string"
        )
          return;
        lastReceived = performance.now();
        // A server that accepts TCP then immediately closes must still back off.
        if (welcomed && performance.now() - openedAt >= 10_000) attempts = 0;
        if (message.type === "pong" && pendingPings.delete(message.sentAt)) {
          lastPong = performance.now();
          setLatencyMs(Math.max(0, lastPong - message.sentAt));
        }
        if (message.type === "community" && Array.isArray(message.characters)) {
          syncCommunityCatalog(message.characters);
          setCommunityVersion((value) => value + 1);
        }
        if (message.type === "welcome" && typeof message.id === "string") {
          welcomed = true;
          accountId = message.account?.id ?? null;
          setId(message.id);
          setAccount(message.account ?? null);
        }
        if (message.type === "rooms" && Array.isArray(message.rooms)) {
          setRooms(message.rooms);
          setOnline(message.online);
        }
        if (
          message.type === "room" &&
          message.room &&
          Array.isArray(message.room.players)
        ) {
          const changedRoom = currentRoom?.code !== message.room.code;
          currentRoom = message.room;
          setRoom(message.room);
          if (changedRoom) setError("");
          if (changedRoom || message.room.players.length === 2)
            setOpponentLeft(false);
          if (message.room.status === "waiting") {
            rememberMatch(null);
            setRecoveringRanked(false);
            currentMatch = null;
            setMatch(null);
            state.current = null;
          }
        }
        if (
          message.type === "start" &&
          message.state &&
          typeof message.state.id === "string" &&
          (message.index === 0 || message.index === 1)
        ) {
          currentMatch = { id: message.state.id, index: message.index };
          completedId = "";
          state.current = message.state;
          const ranked = message.ranked === true;
          setRecoveringRanked(false);
          rememberMatch(
            ranked && message.state.phase !== "finished"
              ? message.state.id
              : null,
          );
          setRankingResult(
            ranked ? { matchId: message.state.id, status: "pending" } : null,
          );
          setMatch({ initial: message.state, index: message.index, ranked });
          if (message.state.phase === "finished") {
            completedId = message.state.id;
            resultHandler.current?.(message.state, message.index);
          }
          setOpponentLeft(false);
          setError("");
        }
        if (
          message.type === "state" &&
          message.state &&
          currentMatch &&
          message.state.id === currentMatch.id
        ) {
          state.current = message.state;
          if (
            message.state.phase === "finished" &&
            completedId !== message.state.id &&
            currentMatch
          ) {
            completedId = message.state.id;
            rememberMatch(null);
            // Persist before another message can unmount Game, even without RAF.
            resultHandler.current?.(message.state, currentMatch.index);
          }
        }
        if (message.type === "error" && typeof message.message === "string")
          setError(message.message);
        if (
          message.type === "ranked-result" &&
          message.result &&
          typeof message.result.matchId === "string"
        ) {
          if (currentMatch?.id === message.result.matchId)
            setRankingResult(message.result);
          setRankingRevision((revision) => revision + 1);
        }
        if (message.type === "resume-unavailable") {
          rememberMatch(null);
          setRecoveringRanked(false);
          setError(message.message);
        }
        if (message.type === "session-replaced") {
          displaced = true;
          rememberMatch(null);
          setRecoveringRanked(false);
          currentMatch = null;
          currentRoom = null;
          state.current = null;
          setMatch(null);
          setRoom(null);
          setError("Tu partida continúa en otra pestaña o dispositivo.");
        }
        if (message.type === "left") {
          rememberMatch(null);
          setRecoveringRanked(false);
          currentRoom = null;
          currentMatch = null;
          setRoom(null);
          setMatch(null);
          setOpponentLeft(false);
          state.current = null;
        }
        if (message.type === "opponent-left") {
          rememberMatch(null);
          setRecoveringRanked(false);
          currentMatch = null;
          setOpponentLeft(true);
          setMatch(null);
          state.current = null;
        }
        if (
          message.type === "abandon-accepted" &&
          message.matchId === pendingAbandon()
        )
          rememberAbandon(null);
      };
    };
    connect();
    return () => {
      disposed = true;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
      cancelSessionProbe();
      clearTimeout(reconnect);
      clearInterval(monitor);
      retireSocket.current = null;
      const ws = socket.current;
      socket.current = null;
      if (ws) detach(ws);
    };
  }, [identityRevision, sessionRevision]);
  const send = useCallback((message: ClientMessage) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("La arena aún no está conectada. Inténtalo en un momento.");
      return false;
    }
    if (ws.bufferedAmount >= MAX_CLIENT_BUFFER_BYTES) {
      retireSocket.current?.();
      return false;
    }
    try {
      ws.send(JSON.stringify(message));
      if (
        message.type === "select" ||
        message.type === "ready" ||
        message.type === "rematch"
      )
        setError("");
      return true;
    } catch {
      retireSocket.current?.();
      return false;
    }
  }, []);
  const abandonResume = useCallback(() => {
    const id = resumeHint();
    if (!id) return;
    rememberAbandon(id);
    rememberMatch(null);
    setRecoveringRanked(false);
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "abandon", matchId: id }));
      } catch {
        retireSocket.current?.();
      }
    }
  }, []);
  return {
    communityVersion,
    connected,
    id,
    account,
    rankingResult,
    rankingRevision,
    recoveringRanked,
    abandonResume,
    rooms,
    room,
    online,
    error,
    setError,
    match,
    state,
    opponentLeft,
    setOpponentLeft,
    latencyMs,
    send,
  };
}
