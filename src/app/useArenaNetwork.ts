import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RoomView,
  ServerMessage,
} from "../../shared/lobby/protocol";
import { parseServerMessage } from "../../shared/lobby/server-message";
import {
  ARENA_SOCKET_PROTOCOL,
  ROOM_RESUME_PROTOCOL_PREFIX,
} from "../../shared/lobby/protocol";
import type { MatchState, PlayerIndex } from "../../shared/engine/engine";

const ROOM_SESSION_KEY = "arena-room-session-v1";
/** Keeps the server from dropping an idle connection (it waits 30 s). */
const PING_INTERVAL_MS = 5_000;
/** A live match streams state many times a second; this much silence is a lost link. */
const MATCH_SILENCE_MS = 4_000;
function savedRoomSession() {
  try {
    const token = sessionStorage.getItem(ROOM_SESSION_KEY);
    return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
  } catch {
    return null;
  }
}
function saveRoomSession(token: string | null) {
  try {
    if (token) sessionStorage.setItem(ROOM_SESSION_KEY, token);
    else sessionStorage.removeItem(ROOM_SESSION_KEY);
  } catch {}
}

export function useArenaNetwork() {
  const socket = useRef<WebSocket | null>(null);
  const resumeToken = useRef(savedRoomSession());
  const roomSession = useRef(resumeToken.current);
  const state = useRef<MatchState | null>(null);
  const roomCode = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [id, setId] = useState("");
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<{
    initial: MatchState;
    index: PlayerIndex;
  } | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  useEffect(() => {
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let wasHidden = false;
    let lastMessageAt = Date.now();
    let lastPingAt = Date.now();
    /** Show the loss and schedule a reconnect, once per socket. */
    const lost = (ws: WebSocket) => {
      if (disposed || socket.current !== ws) return;
      socket.current = null;
      roomCode.current = null;
      setConnected(false);
      setRooms([]);
      setMatch(null);
      setOpponentLeft(false);
      state.current = null;
      setError(
        roomSession.current
          ? "Recuperando tu sala…"
          : "Se perdió la conexión. Reconectando con la arena…",
      );
      reconnect = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10_000));
    };
    const connect = () => {
      if (disposed) return;
      clearTimeout(reconnect);
      const previous = socket.current;
      const token = roomSession.current;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
        [
          ARENA_SOCKET_PROTOCOL,
          ...(token ? [ROOM_RESUME_PROTOCOL_PREFIX + token] : []),
        ],
      );
      socket.current = ws;
      lastMessageAt = Date.now();
      previous?.close();
      setConnected(false);
      ws.onerror = () => {};
      ws.onmessage = (event) => {
        if (disposed || socket.current !== ws) return;
        lastMessageAt = Date.now();
        if (typeof event.data !== "string") return;
        let message: ServerMessage | null;
        try {
          message = parseServerMessage(JSON.parse(event.data));
        } catch {
          return;
        }
        if (!message) return;
        if (message.type === "welcome") {
          attempts = 0;
          setConnected(true);
          setId(message.id);
          resumeToken.current = message.resumeToken ?? null;
          if (token && !message.resumed) {
            roomSession.current = null;
            saveRoomSession(null);
            setRoom(null);
            setMatch(null);
            state.current = null;
            setError(
              "La sala ya no está disponible. Puedes crear otra o entrar con un código.",
            );
          } else setError("");
        }
        if (message.type === "rooms") {
          setRooms(message.rooms);
          setOnline(message.online);
        }
        if (message.type === "room") {
          // Arriving in a different room settles any earlier join error.
          if (roomCode.current !== message.room.code) setError("");
          roomCode.current = message.room.code;
          roomSession.current = resumeToken.current;
          saveRoomSession(roomSession.current);
          setRoom(message.room);
          if (message.room.players.length === 2) setOpponentLeft(false);
          if (message.room.status === "waiting") {
            setMatch(null);
            state.current = null;
          }
        }
        if (message.type === "start") {
          state.current = message.state;
          setMatch({ initial: message.state, index: message.index });
          setOpponentLeft(false);
          setError("");
        }
        if (message.type === "state") state.current = message.state;
        if (message.type === "error") setError(message.message);
        if (message.type === "left") {
          roomCode.current = null;
          roomSession.current = null;
          saveRoomSession(null);
          setRoom(null);
          setMatch(null);
          setOpponentLeft(false);
          state.current = null;
        }
        if (message.type === "opponent-left") {
          setOpponentLeft(true);
          setMatch(null);
          state.current = null;
        }
      };
      ws.onclose = () => lost(ws);
    };
    const wake = () => {
      if (
        document.hidden ||
        socket.current?.readyState === WebSocket.CONNECTING
      )
        return;
      connect();
    };
    const visibility = () => {
      if (document.hidden) wasHidden = true;
      else if (wasHidden) {
        wasHidden = false;
        wake();
      }
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) wake();
    };
    // Keep the connection alive, and notice a match whose state stopped
    // arriving: a dropped network can leave the socket open but silent.
    const heartbeat = setInterval(() => {
      const ws = socket.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (
        state.current &&
        state.current.phase !== "finished" &&
        now - lastMessageAt > MATCH_SILENCE_MS
      ) {
        ws.close();
        lost(ws);
        return;
      }
      if (now - lastPingAt >= PING_INTERVAL_MS) {
        lastPingAt = now;
        const ping: ClientMessage = { type: "ping" };
        ws.send(JSON.stringify(ping));
      }
    }, 1000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("online", wake);
    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("online", wake);
      socket.current?.close();
    };
  }, []);
  const send = useCallback((message: ClientMessage) => {
    if (message.type === "leave") {
      roomSession.current = null;
      saveRoomSession(null);
      setRoom(null);
      setMatch(null);
      setOpponentLeft(false);
      state.current = null;
      setError("");
      if (socket.current?.readyState !== WebSocket.OPEN) return true;
    }
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setError("La arena aún no está conectada. Inténtalo en un momento.");
      return false;
    }
    socket.current.send(JSON.stringify(message));
    return true;
  }, []);
  return {
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
    send,
  };
}
