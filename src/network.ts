import { syncCommunityCatalog } from "../shared/community";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RoomView,
  ServerMessage,
} from "../shared/protocol";
import type { MatchState } from "../shared/engine";

export function useArenaNetwork() {
  const socket = useRef<WebSocket | null>(null);
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
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
      );
      socket.current = ws;
      ws.onopen = () => {
        attempts = 0;
        setConnected(true);
        setError("");
      };
      ws.onerror = () => {};
      ws.onmessage = (event) => {
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
        if (message.type === "welcome") setId(message.id);
        if (message.type === "rooms") {
          setRooms(message.rooms);
          setOnline(message.online);
        }
        if (message.type === "room") {
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
        if (disposed) return;
        setConnected(false);
        setRoom(null);
        setRooms([]);
        setMatch(null);
        setOpponentLeft(false);
        state.current = null;
        setError("Se perdió la conexión. Reconectando con la arena…");
        reconnect = setTimeout(
          connect,
          Math.min(1000 * 2 ** attempts++, 10_000),
        );
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      socket.current?.close();
    };
  }, []);
  const send = useCallback((message: ClientMessage) => {
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
