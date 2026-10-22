import { ArrowRight } from "lucide-react";
import {
  SUPER_CHARGE_SECONDS_LABEL,
  SUPER_ENERGY_COST,
} from "../../shared/content";

const groups = [
  {
    title: "Muévete",
    label: "Movimiento",
    controls: [
      { action: "Mover", input: "Stick / cruceta" },
      { action: "Saltar", input: "A", note: "Puedes saltar dos veces" },
      { action: "Bajar de plataforma", input: "Stick ↓" },
    ],
  },
  {
    title: "Ataca",
    label: "Ataques",
    controls: [
      { action: "Ligero", input: "X", note: "Rápido" },
      { action: "Fuerte", input: "B", note: "Más daño" },
      { action: "Especial", input: "Y", note: "25 de energía" },
    ],
  },
  {
    title: "Defiéndete",
    label: "Defensa y menú",
    controls: [
      { action: "Bloquear", input: "LB", note: "Mantén pulsado" },
      { action: "Esquivar", input: "RB" },
      { action: "Pausa / menú", input: "Start / Menú" },
    ],
  },
] as const;

function ButtonLabel({ input }: { input: string }) {
  return (
    <span
      className={`help-input${input.length === 1 ? " is-face-button" : ""}`}
    >
      {input}
    </span>
  );
}

export function GamepadControlsGuide() {
  return (
    <div
      className="controls-guide gamepad-controls-guide"
      aria-label="Guía de mando"
    >
      <p className="controls-guide-intro">
        Conecta tu mando. Los botones siguen la distribución Xbox.
      </p>
      <div className="controls-guide-groups">
        {groups.map(({ title, label, controls }) => (
          <section
            className="controls-guide-group"
            aria-label={label}
            key={label}
          >
            <h4>{title}</h4>
            <dl className="controls-guide-list">
              {controls.map((control) => (
                <div key={control.action}>
                  <dt>
                    {control.action}
                    {"note" in control && <small>{control.note}</small>}
                  </dt>
                  <dd>
                    <ButtonLabel input={control.input} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="controls-guide-footer">
        <div className="controls-guide-extra">
          <h4>
            Tu primer combo
            <span className="controls-combo-keys">
              <ButtonLabel input="X" />
              <ArrowRight size={14} aria-hidden="true" />
              <ButtonLabel input="B" />
            </span>
          </h4>
          <small>Deja terminar cada golpe.</small>
        </div>
        <div className="controls-guide-extra">
          <h4>
            Definitiva <ButtonLabel input="RT" />
          </h4>
          <small>
            Mantén {SUPER_CHARGE_SECONDS_LABEL} s · {SUPER_ENERGY_COST} de
            energía · Un uso por pelea
          </small>
        </div>
      </div>
    </div>
  );
}
