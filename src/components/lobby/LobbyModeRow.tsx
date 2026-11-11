import type { KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import type { GameMode } from "../match/Game";
import { PixelIcon } from "../ui/PixelIcon";

const modes = [
  ["practice", "Contra CPU", "gamepad"],
  ["local", "Dos jugadores", "heart"],
  ["online", "En línea", "bolt"],
] as const;

export function LobbyModeRow({
  mode,
  onMode,
  onModeKeys,
  onProgress,
}: {
  mode: GameMode;
  onMode: (mode: GameMode) => void;
  onModeKeys: (event: KeyboardEvent<HTMLDivElement>) => void;
  onProgress: () => void;
}) {
  return (
    <div className="arcade-mode-row">
      <div
        className="mode-tabs arcade-modes"
        role="tablist"
        aria-label="Modo de juego"
        onKeyDown={onModeKeys}
      >
        {modes.map(([value, label, icon]) => (
          <button
            key={value}
            role="tab"
            id={`mode-${value}`}
            aria-controls="match-setup"
            tabIndex={mode === value ? 0 : -1}
            aria-selected={mode === value}
            title={
              value === "local"
                ? "Dos jugadores en el mismo dispositivo"
                : undefined
            }
            className={mode === value ? "selected" : ""}
            onClick={() => onMode(value)}
          >
            <PixelIcon kind={icon} size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button className="arcade-progress" onClick={onProgress}>
        <PixelIcon kind="star" size={16} /> Mis logros <ArrowRight size={14} />
      </button>
    </div>
  );
}
