import type { RefObject } from "react";
import { CircleHelp, Expand, Play, Volume2, VolumeX } from "lucide-react";

interface Props {
  ref: RefObject<HTMLDivElement | null>;
  /** False while another overlay (such as the orientation gate) is on top. */
  active: boolean;
  online: boolean;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onResume: () => void;
  onHelp: () => void;
  onLandscape: () => void;
  onExit: () => void;
}

/** The pause dialog; online matches keep running behind it. */
export function PauseMenu({
  ref,
  active,
  online,
  soundEnabled,
  onToggleSound,
  onResume,
  onHelp,
  onLandscape,
  onExit,
}: Props) {
  return (
    <div
      ref={ref}
      className="game-overlay"
      role="dialog"
      aria-modal={active}
      aria-hidden={!active}
      aria-labelledby="pause-title"
    >
      <div className="pause-card">
        <h2 id="pause-title">{online ? "La pelea sigue" : "Pausa"}</h2>
        {online && <p>El combate continúa mientras estás en el menú.</p>}
        <button className="primary-button" onClick={onResume}>
          <Play size={18} /> Continuar
        </button>
        <div className="pause-tools">
          {onToggleSound && (
            <button
              className="secondary-button"
              aria-label={soundEnabled ? "Silenciar sonido" : "Activar sonido"}
              aria-pressed={soundEnabled}
              onClick={onToggleSound}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              Sonido
            </button>
          )}
          <button
            className="secondary-button"
            aria-label="Ver controles"
            onClick={onHelp}
          >
            <CircleHelp size={18} /> Controles
          </button>
          <button
            className="secondary-button"
            aria-label="Pantalla completa"
            onClick={onLandscape}
          >
            <Expand size={18} /> Pantalla completa
          </button>
        </div>
        <button className="secondary-button" onClick={onExit}>
          Salir del combate
        </button>
      </div>
    </div>
  );
}
