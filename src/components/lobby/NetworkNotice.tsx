import { Globe2, X } from "lucide-react";
import type { useArenaNetwork } from "../../app/useArenaNetwork";

export function NetworkNotice({
  network,
}: {
  network: ReturnType<typeof useArenaNetwork>;
}) {
  return (
    <div className="notice-banner" role="status">
      <Globe2 size={16} />
      <span>
        {network.opponentLeft
          ? "Tu pana salió. Invítalo de nuevo o busca otra pelea."
          : network.error}
      </span>
      <button
        className="icon-button"
        aria-label="Cerrar aviso"
        onClick={() => {
          network.setError("");
          network.setOpponentLeft(false);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
