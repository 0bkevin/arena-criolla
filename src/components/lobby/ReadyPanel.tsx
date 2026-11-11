import type { RefObject } from "react";
import { Copy } from "lucide-react";
import type { RoomView } from "../../../shared/lobby/protocol";
import type { useArenaNetwork } from "../../app/useArenaNetwork";
import type { GameMode } from "../match/Game";
import { PixelIcon } from "../ui/PixelIcon";

type Difficulty = "easy" | "normal" | "hard";

const difficulties = [
  ["easy", "Suave"],
  ["normal", "Normal"],
  ["hard", "Candela"],
] as const;

function DifficultyPicker({
  difficulty,
  onDifficulty,
}: {
  difficulty: Difficulty;
  onDifficulty: (difficulty: Difficulty) => void;
}) {
  return (
    <div className="ready-difficulty">
      <span>NIVEL DEL CPU</span>
      <div role="group" aria-label="Dificultad del CPU">
        {difficulties.map(([value, label]) => (
          <button
            key={value}
            className={difficulty === value ? "active" : ""}
            aria-pressed={difficulty === value}
            onClick={() => onDifficulty(value)}
          >
            {label}
            {value === "hard" && <PixelIcon kind="bolt" size={11} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomPlayers({
  room,
  ownId,
  onLeave,
}: {
  room: RoomView;
  ownId: string;
  onLeave: () => void;
}) {
  return (
    <div className="ready-room-players">
      {room.players.map((p) => (
        <span key={p.id} className={p.ready ? "ready" : ""}>
          <span className="ready-player-dot" />
          {p.name}
          {p.id === ownId ? " (tú)" : ""} ·{" "}
          {p.connected === false
            ? "RECONECTANDO…"
            : p.ready
              ? "LISTO"
              : "ELIGIENDO"}
        </span>
      ))}
      {room.players.length === 1 && <span>Esperando a tu pana…</span>}
      <button onClick={onLeave}>Salir de la sala</button>
    </div>
  );
}

/** Room code, CPU level or online status, and the start or ready button. */
export function ReadyPanel({
  ref,
  mode,
  difficulty,
  network,
  onDifficulty,
  onStart,
  onStartIntent,
  onReady,
  onInvite,
}: {
  ref: RefObject<HTMLElement | null>;
  mode: GameMode;
  difficulty: Difficulty;
  network: ReturnType<typeof useArenaNetwork>;
  onDifficulty: (difficulty: Difficulty) => void;
  onStart: () => void;
  onStartIntent?: () => void;
  onReady: (ready: boolean) => void;
  onInvite: () => void;
}) {
  const ownRoomPlayer = network.room?.players.find(
    (player) => player.id === network.id,
  );
  return (
    <section
      className={`arcade-ready ${mode === "local" ? "local-ready" : ""} ${mode === "online" ? "online-ready" : ""} ${network.room ? "in-room" : ""}`}
      ref={ref}
      id="prepare-fight"
      aria-label="Preparar pelea"
    >
      <div className="ready-intro">
        <PixelIcon kind="swords" size={28} />
        <div>
          <strong>PREPARAR PELEA</strong>
        </div>
      </div>
      {network.room && (
        <div className="ready-room">
          <span>CÓDIGO DE SALA</span>
          <strong>{network.room.code}</strong>
          <button aria-label="Copiar invitación" onClick={onInvite}>
            <Copy size={16} />
          </button>
        </div>
      )}
      {mode === "practice" && (
        <DifficultyPicker difficulty={difficulty} onDifficulty={onDifficulty} />
      )}
      {mode === "online" && (
        <div className="ready-online-status">
          <span
            className={`live-dot ${network.connected ? "connected" : ""}`}
          />
          <span>
            {network.room
              ? `${network.room.players.length}/2 PANAS EN LA SALA`
              : "INVITA A UN PANA"}
          </span>
          {network.room && (
            <button onClick={onInvite}>
              Invitar <Copy size={12} />
            </button>
          )}
        </div>
      )}
      <button
        className="arcade-start primary-button fight-button"
        disabled={mode === "online" && !network.connected}
        onPointerEnter={network.room ? undefined : onStartIntent}
        onPointerDown={network.room ? undefined : onStartIntent}
        onFocus={network.room ? undefined : onStartIntent}
        onClick={network.room ? () => onReady(!ownRoomPlayer?.ready) : onStart}
      >
        <PixelIcon kind={mode === "online" ? "bolt" : "gamepad"} size={20} />
        <span>
          {network.room
            ? ownRoomPlayer?.ready
              ? "¡LISTO!"
              : "¡ESTOY LISTO!"
            : mode === "online"
              ? "BUSCAR SALAS"
              : "¡A DARLE!"}
        </span>
        <PixelIcon kind="arrow" size={20} />
      </button>
      {network.room && (
        <RoomPlayers
          room={network.room}
          ownId={network.id}
          onLeave={() => network.send({ type: "leave" })}
        />
      )}
    </section>
  );
}
