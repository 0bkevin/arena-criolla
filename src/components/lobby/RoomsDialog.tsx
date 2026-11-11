import { ArrowRight, Globe2, LockKeyhole, Plus, Radio } from "lucide-react";
import {
  stageById,
  type FighterId,
  type StageId,
} from "../../../shared/roster/roster";
import { isRoomCode, ROOM_CODE_LENGTH } from "../../../shared/lobby/room-code";
import type { useArenaNetwork } from "../../app/useArenaNetwork";
import { assetUrl } from "../../game/assets/asset-url";
import { Modal } from "../ui/Modal";

interface Props {
  network: ReturnType<typeof useArenaNetwork>;
  fighter: FighterId;
  stage: StageId;
  wins: number;
  privateRoom: boolean;
  joinCode: string;
  onPrivateRoom: (privateRoom: boolean) => void;
  onJoinCode: (code: string) => void;
  onClose: () => void;
}

/** Create a room, join one by code, or pick an open public room. */
export function RoomsDialog({
  network,
  fighter,
  stage,
  wins,
  privateRoom,
  joinCode,
  onPrivateRoom,
  onJoinCode,
  onClose,
}: Props) {
  return (
    <Modal
      title="Salas en línea"
      className="rooms-modal"
      wide
      onClose={onClose}
    >
      <div className="lobby-meta">
        <span>
          <i className={network.connected ? "connected-dot" : ""} />
          {network.connected
            ? `${network.online} ${network.online === 1 ? "pana conectado" : "panas conectados"}`
            : "Conectando…"}
        </span>
        <button
          className="text-button"
          onClick={() => network.send({ type: "list" })}
        >
          <Radio size={13} /> Actualizar
        </button>
      </div>
      {network.error && (
        <p className="form-error" role="alert">
          {network.error}
        </p>
      )}
      <div className="lobby-grid">
        <div className="create-room-panel">
          <div className="room-panel-heading">
            <Plus size={20} aria-hidden="true" />
            <h3>Crear sala</h3>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={privateRoom}
              onChange={(e) => onPrivateRoom(e.target.checked)}
            />
            <LockKeyhole size={13} />
            Solo entrar con código
          </label>
          <button
            className="primary-button"
            disabled={!network.connected}
            onClick={() => {
              network.setError("");
              network.send({
                type: "create",
                fighter,
                stage,
                wins,
                private: privateRoom,
              });
            }}
          >
            <Plus size={16} /> Crear sala
          </button>
        </div>
        <div className="join-room-panel">
          <h3>Entrar con código</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isRoomCode(joinCode)) {
                network.setError(
                  "El código de sala debe tener 32 caracteres hexadecimales.",
                );
                return;
              }
              network.send({
                type: "join",
                code: joinCode,
                fighter,
                wins,
              });
            }}
          >
            <input
              aria-label="Código de sala"
              className="plain-input code-input"
              value={joinCode}
              onChange={(e) => {
                onJoinCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-F0-9]/g, "")
                    .slice(0, ROOM_CODE_LENGTH),
                );
                network.setError("");
              }}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="Código de sala"
            />
            <button
              className="secondary-button"
              disabled={!network.connected}
              type="submit"
            >
              Entrar <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </div>
      <div className="section-label rooms-list-heading">
        <h2>SALAS ABIERTAS</h2>
        <span>{network.rooms.length} disponibles</span>
      </div>
      {network.rooms.length === 0 ? (
        <div className="empty-rooms">
          <Globe2 size={27} />
          <div>
            <p>No hay salas abiertas. Crea una e invita a tu pana.</p>
          </div>
        </div>
      ) : (
        <div className="rooms-list">
          {network.rooms.map((room) => (
            <div key={room.code}>
              <img src={assetUrl(`/assets/${room.stage}.webp`)} alt="" />
              <div>
                <strong>{room.name}</strong>
                <span>
                  {stageById(room.stage).location} · {room.players.length}/2
                  jugadores
                </span>
              </div>
              <button
                className="secondary-button"
                onClick={() => {
                  network.send({
                    type: "join",
                    code: room.code,
                    fighter,
                    wins,
                  });
                }}
              >
                Unirme <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
