import type { KeyboardEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import {
  STAGES,
  type StageDefinition,
  type StageId,
} from "../../../shared/roster/roster";
import { stageThumbnail } from "../../game/assets/stage-thumbnail";

const stageLabels: Record<StageId, string> = {
  caracas: "Altamira",
  guaira: "La Guaira",
  valencia: "Valencia",
  canaima: "Salto Ángel",
  maracaibo: "Maracaibo",
  merida: "Mérida",
  coro: "Coro",
  roques: "Los Roques",
  poliedro: "Poliedro",
};

/** Arrow, Home and End keys move focus across the enabled stage buttons. */
const handleStageKeys = (event: KeyboardEvent<HTMLDivElement>) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  );
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (index < 0 || !buttons.length) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
          buttons.length;
  buttons[next].focus();
};

export function StageStrip({
  stage,
  stageLocked,
  onStage,
  onMap,
}: {
  stage: StageDefinition;
  /** Room guests see the host's stage but cannot change it. */
  stageLocked: boolean;
  onStage: (id: StageId) => void;
  onMap: () => void;
}) {
  return (
    <section className="arcade-stages" aria-label="Seleccionar escenario">
      <div className="arcade-stage-heading">
        <div>
          <h2>ESCENARIO</h2>
        </div>
        <span className="sr-only" aria-live="polite">
          {stage.location}
        </span>
        <button onClick={onMap}>
          Ver mapa <ArrowRight size={13} />
        </button>
      </div>
      <div
        className="stage-strip"
        role="group"
        aria-label="Escenarios de Venezuela"
        onKeyDown={handleStageKeys}
      >
        {STAGES.map((item) => (
          <button
            key={item.id}
            className={`arcade-stage ${item.id === stage.id ? "selected" : ""}`}
            aria-label={`Elegir escenario ${item.location}`}
            aria-pressed={item.id === stage.id}
            disabled={stageLocked}
            onClick={() => onStage(item.id)}
          >
            <span className="stage-thumbnail">
              <img
                src={stageThumbnail(item.id, "strip")}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
              {item.id === stage.id && (
                <span className="stage-tick">
                  <Check size={12} />
                </span>
              )}
            </span>
            <strong>{stageLabels[item.id]}</strong>
          </button>
        ))}
      </div>
      {stageLocked && (
        <p className="stage-lock-note">El anfitrión elige el escenario.</p>
      )}
    </section>
  );
}
