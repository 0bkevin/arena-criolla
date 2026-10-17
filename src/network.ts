import { syncCommunityCatalog } from "../shared/community";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RoomView,
  ServerMessage,
} from "../shared/protocol";
import type { MatchState } from "../shared/engine";
import {
  MAX_CLIENT_BUFFER_BYTES,
  NETWORK_HEARTBEAT_MS,
  NETWORK_TIMEOUT_MS,
} from "../shared/network";

type ResultHandler = (state: MatchState, index: number) => void;
export function useArenaNetwork(onResult?: ResultHandler) {
  const socket = useRef<WebSocket | null>(null);
  const state = useRef<MatchState | null>(null);
  const resultHandler = useRef(onResult);
  resultHandler.current = onResult;
  const retireSocket = useRef<(() => void) | null>(null);
  const [communityVersion, setCommunityVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [id, setId] = useState("");
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [match, setMatch] = useState<{
    initial: MatchState;
    index: number;
  } | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  useEffect(() => {
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let monitor: ReturnType<typeof setInterval>;
    let attempts = 0;
    let currentRoom: RoomView | null = null;
    let currentMatch: { id: string; index: number } | null = null;
    let completedId = "";
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
      clearInterval(monitor);
      detach(ws);
      currentRoom = null;
      currentMatch = null;
      state.current = null;
      setConnected(false);
      setId("");
      setOnline(0);
      setLatencyMs(null);
      setRoom(null);
      setRooms([]);
      setMatch(null);
      setOpponentLeft(false);
      setError("Se perdió la conexión. Reconectando con la arena…");
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
      const active = () => !disposed && socket.current === ws;
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
        setError("");
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
          setId(message.id);
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
          setMatch({ initial: message.state, index: message.index });
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
            // Persist before another message can unmount Game, even without RAF.
            resultHandler.current?.(message.state, currentMatch.index);
          }
        }
        if (message.type === "error" && typeof message.message === "string")
          setError(message.message);
        if (message.type === "left") {
          currentRoom = null;
          currentMatch = null;
          setRoom(null);
          setMatch(null);
          setOpponentLeft(false);
          state.current = null;
        }
        if (message.type === "opponent-left") {
          currentMatch = null;
          setOpponentLeft(true);
          setMatch(null);
          state.current = null;
        }
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      clearInterval(monitor);
      retireSocket.current = null;
      const ws = socket.current;
      socket.current = null;
      if (ws) detach(ws);
    };
  }, []);
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
      return true;
    } catch {
      retireSocket.current?.();
      return false;
    }
  }, []);
  return {
    communityVersion,
    connected,
    id,
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
