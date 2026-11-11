import { CircleHelp, Volume2, VolumeX } from "lucide-react";
import { PixelIcon } from "../components/ui/PixelIcon";
import { assetUrl } from "../game/assets/asset-url";
import type { LobbyModal } from "./App";

interface Props {
  /** Whether a match is on screen; the lobby-only controls hide then. */
  active: boolean;
  modal: LobbyModal;
  connected: boolean;
  audio: boolean;
  onHome: () => void;
  onPlay: () => void;
  onModal: (modal: Exclude<LobbyModal, null>) => void;
  onToggleAudio: () => void;
}

/** Brand, main navigation, help, progress, server status and sound. */
export function SiteHeader({
  active,
  modal,
  connected,
  audio,
  onHome,
  onPlay,
  onModal,
  onToggleAudio,
}: Props) {
  return (
    <header className="site-header page-width">
      <button
        className="brand"
        aria-label="Arena Criolla, inicio"
        onClick={onHome}
      >
        <span className="brand-icon" aria-hidden="true">
          <img
            src={assetUrl("/assets/arena-icon.svg")}
            width="29"
            height="29"
            alt=""
          />
        </span>
        <span className="brand-name">
          ARENA
          <span>CRIOLLA</span>
        </span>
      </button>
      <nav className="main-nav" aria-label="Navegación principal">
        <button className={!modal ? "active" : ""} onClick={onPlay}>
          Jugar
        </button>
        <button
          className={modal === "fighters" ? "active" : ""}
          onClick={() => onModal("fighters")}
        >
          Luchadores
        </button>
      </nav>
      <div className="header-right">
        <button
          className="icon-button header-help"
          onClick={() => onModal("help")}
          aria-label="Cómo jugar"
          title="Cómo jugar"
        >
          <CircleHelp size={19} aria-hidden="true" />
          <span>Cómo jugar</span>
        </button>
        {!active && (
          <button
            className="icon-button header-progress"
            onClick={() => onModal("progress")}
            aria-label="Mi progreso"
            title="Mi progreso"
          >
            <PixelIcon kind="star" size={18} />
          </button>
        )}
        <span
          className={`server-status ${connected ? "connected" : ""}`}
          title={
            connected ? "Servidor de salas conectado" : "Conectando al servidor"
          }
        >
          <i />
          {connected ? "En línea" : "Conectando"}
        </span>
        <button
          className="icon-button"
          onClick={onToggleAudio}
          aria-label={audio ? "Silenciar sonido" : "Activar sonido"}
          aria-pressed={audio}
        >
          {audio ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </div>
    </header>
  );
}
