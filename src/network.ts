import { syncCommunityCatalog } from "../shared/community";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RoomView,
  ServerMessage,
} from "../shared/protocol";
import {
  ARENA_SOCKET_PROTOCOL,
  ROOM_RESUME_PROTOCOL_PREFIX,
} from "../shared/protocol";
import type { MatchState } from "../shared/engine";

const ROOM_SESSION_KEY = "arena-room-session-v1";
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
  const [communityVersion, setCommunityVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [id, setId] = useState("");
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<{
    initial: MatchState;
    index: number;
  } | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  useEffect(() => {
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let wasHidden = false;
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
      previous?.close();
      setConnected(false);
      ws.onerror = () => {};
      ws.onmessage = (event) => {
        if (disposed || socket.current !== ws) return;
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "community") {
          syncCommunityCatalog(message.characters);
          setCommunityVersion((value) => value + 1);
        }
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
      ws.onclose = () => {
        if (disposed || socket.current !== ws) return;
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
        reconnect = setTimeout(
          connect,
          Math.min(1000 * 2 ** attempts++, 10_000),
        );
      };
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
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("online", wake);
    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
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
    send,
  };
}
