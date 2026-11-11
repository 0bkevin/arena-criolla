import type { RefObject } from "react";
import { Expand, Smartphone } from "lucide-react";

interface Props {
  ref: RefObject<HTMLDivElement | null>;
  online: boolean;
  onLandscape: () => void;
  onExit: () => void;
}

/** Blocks a portrait phone until it is turned to landscape. */
export function OrientationGate({ ref, online, onLandscape, onExit }: Props) {
  return (
    <div
      ref={ref}
      className="orientation-gate"
      role="dialog"
      aria-modal="true"
      aria-label="Jugar en horizontal"
    >
      <div className="orientation-card">
        <Smartphone size={48} aria-hidden="true" />
        <h2>Gira tu teléfono</h2>
        <p>
          {online
            ? "Tu rival sigue en la arena. Gira el teléfono para volver al pique."
            : "La arena se juega en horizontal. Tu pelea te espera."}
        </p>
        <button className="primary-button" onClick={onLandscape}>
          <Expand size={18} /> Jugar en horizontal
        </button>
        <button className="text-button" onClick={onExit}>
          Volver a la selección
        </button>
      </div>
    </div>
  );
}
