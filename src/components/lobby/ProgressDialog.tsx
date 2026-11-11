import { Trophy } from "lucide-react";
import { fighterById } from "../../../shared/roster/roster";
import type { Progress } from "../../app/storage";
import { Modal } from "../ui/Modal";

interface Props {
  progress: Progress;
  onClose: () => void;
}

/** Matches played, wins, best streak and the recent match history. */
export function ProgressDialog({ progress, onClose }: Props) {
  const totalWins = Object.values(progress.wins).reduce<number>(
    (a, b) => a + (Number(b) || 0),
    0,
  );
  return (
    <Modal
      title="Mi progreso"
      className="progress-modal content-modal"
      onClose={onClose}
    >
      <div className="dialog-content progress-content">
        <div className="progress-metrics">
          <div>
            <strong>{progress.played}</strong>
            <span>Peleas</span>
          </div>
          <div>
            <strong>{totalWins}</strong>
            <span>Victorias</span>
          </div>
          <div>
            <strong>{progress.bestCombo}</strong>
            <span>Mejor racha</span>
          </div>
        </div>
        {progress.recent.length > 0 ? (
          <>
            <h3 id="progress-history-title">Historial de peleas</h3>
            <div
              className="recent-matches"
              role="list"
              aria-labelledby="progress-history-title"
            >
              {progress.recent.map((m, i) => (
                <div key={i} role="listitem">
                  <span className={m.won ? "won" : "lost"}>
                    {m.won ? "VICTORIA" : "PARTIDA"}
                  </span>
                  <span>
                    {fighterById(m.fighter).shortName} <small>vs.</small>{" "}
                    {fighterById(m.rival).shortName}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-progress">
            <Trophy size={29} />
            <p>
              Todavía no has registrado peleas.
              <br />
              Elige tu luchador y empieza a jugar.
            </p>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <button type="button" className="dialog-done" onClick={onClose}>
          Entendido
        </button>
      </div>
    </Modal>
  );
}
