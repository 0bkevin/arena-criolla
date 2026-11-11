import type { MouseEvent } from "react";
import {
  ArrowLeft,
  CircleHelp,
  Expand,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { GameMode } from "./Game";

interface Props {
  mode: GameMode;
  touch: boolean;
  /** Hidden but kept in layout while the result screen takes over. */
  resultMounted: boolean;
  paused: boolean;
  finished: boolean;
  soundEnabled?: boolean | undefined;
  onToggleSound?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onHelp: () => void;
  onLandscape: () => void;
  onPause: () => void;
  onExit: () => void;
}

/** The bar above the arena: back, mode, sound, help, fullscreen and pause. */
export function GameToolbar({
  mode,
  touch,
  resultMounted,
  paused,
  finished,
  soundEnabled,
  onToggleSound,
  onHelp,
  onLandscape,
  onPause,
  onExit,
}: Props) {
  return (
    <div
      className="game-topline"
      inert={resultMounted}
      style={resultMounted ? { visibility: "hidden" } : undefined}
    >
      <button
        className="text-button"
        aria-label="Volver a la selección"
        onClick={onExit}
      >
        <ArrowLeft size={16} /> {touch ? "Selección" : "Volver a la selección"}
      </button>
      <span className="game-mode">
        <span className="live-dot" />
        {mode === "online"
          ? "MULTIJUGADOR EN LÍNEA"
          : mode === "local"
            ? "VERSUS LOCAL"
            : "COMBATE CONTRA LA CPU"}
      </span>
      <div className="game-tools">
        {onToggleSound && (
          <button
            className="icon-button"
            aria-label={soundEnabled ? "Silenciar sonido" : "Activar sonido"}
            aria-pressed={soundEnabled}
            onClick={onToggleSound}
          >
            {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        )}
        <button
          className="icon-button"
          aria-label="Ver controles"
          onClick={onHelp}
        >
          <CircleHelp size={19} />
        </button>
        <button
          className="icon-button"
          aria-label="Pantalla completa"
          onClick={onLandscape}
        >
          <Expand size={18} />
        </button>
        <button
          className="icon-button"
          aria-label={paused ? "Continuar pelea" : "Pausar"}
          aria-pressed={paused}
          disabled={finished}
          onClick={onPause}
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>
    </div>
  );
}
