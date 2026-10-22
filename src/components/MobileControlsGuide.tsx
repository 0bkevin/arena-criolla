import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronsRight,
  Flame,
  Pause,
  Shield,
  Swords,
  Zap,
} from "lucide-react";
import {
  SUPER_ENERGY_COST,
  SUPER_CHARGE_SECONDS_LABEL,
} from "../../shared/content";
import { Portrait } from "./Portrait";

const movement = [
  { icon: ArrowLeftRight, label: "Mover" },
  { icon: ArrowUp, label: "Saltar", note: "Repite en el aire" },
  { icon: ArrowDown, label: "Bajar" },
  { icon: ChevronsRight, label: "Esquivar" },
  { icon: Pause, label: "Pausa", note: "Arriba a la derecha" },
];
const combat = [
  { icon: Shield, label: "Bloquear", note: "Mantén pulsado" },
  { icon: Swords, label: "Golpe" },
  { icon: Flame, label: "Fuerte" },
  { icon: Zap, label: "Especial", note: "25 de energía" },
  {
    icon: Zap,
    label: "Cargar",
    note: `Mantén ${SUPER_CHARGE_SECONDS_LABEL} s · ${SUPER_ENERGY_COST} energía · 1 uso`,
  },
];

function ArenaPreview() {
  return (
    <figure className="help-screen-guide">
      <div
        className="help-game-screen"
        role="img"
        aria-label="Vista de la arena en horizontal: vida y energía arriba, pausa en la esquina superior derecha, movimiento abajo a la izquierda y ataques abajo a la derecha."
      >
        <div className="help-screen-art" aria-hidden="true">
          <div className="help-screen-hud">
            <div>
              <span>Tú</span>
              <i />
              <small />
            </div>
            <strong>120</strong>
            <div>
              <span>Rival</span>
              <i />
              <small />
            </div>
          </div>
          <Pause className="help-screen-pause" />
          <Portrait
            fighter="zavarce"
            className="help-screen-fighter help-screen-fighter-left"
            frame={0}
          />
          <Portrait
            fighter="javier"
            className="help-screen-fighter help-screen-fighter-right"
            facing={-1}
            frame={0}
          />
          <div className="help-screen-pad help-screen-movement">
            <span className="help-pad-jump">
              <ArrowUp />
            </span>
            <span className="help-pad-left">
              <ArrowLeft />
            </span>
            <span className="help-pad-right">
              <ArrowRight />
            </span>
            <span className="help-pad-dash">
              <ChevronsRight />
            </span>
            <span className="help-pad-down">
              <ArrowDown />
            </span>
          </div>
          <div className="help-screen-pad help-screen-combat">
            <span className="help-pad-block">
              <Shield />
            </span>
            <span className="help-pad-super">
              <Zap />
            </span>
            <span className="help-pad-light">
              <Swords />
            </span>
            <span className="help-pad-heavy">
              <Flame />
            </span>
            <span className="help-pad-special">
              <Zap />
            </span>
          </div>
        </div>
      </div>
      <figcaption>
        <span>
          <strong>Izquierda</strong>Muévete y esquiva
        </span>
        <span>
          <strong>Derecha</strong>Ataca y bloquea
        </span>
      </figcaption>
    </figure>
  );
}

export function MobileControlsGuide() {
  return (
    <div className="help-touch-guide">
      <div className="help-touch-layout">
        <div className="help-touch-overview">
          <ArenaPreview />
          <p className="help-touch-method">
            Desliza para moverte y atacar. Para <strong>Especial</strong> y{" "}
            <strong>Cargar</strong>, levanta el dedo y pulsa directamente.
          </p>
        </div>
        <div className="help-touch-basics">
          {[movement, combat].map((group, index) => (
            <section
              key={index}
              aria-label={index === 0 ? "Movimiento y pausa" : "Combate"}
            >
              <h4>{index === 0 ? "Muévete" : "Ataca y bloquea"}</h4>
              <dl>
                {group.map((control) => (
                  <div key={control.label}>
                    <dt>
                      <control.icon size={18} aria-hidden="true" />
                      {control.label}
                    </dt>
                    {"note" in control && <dd>{control.note}</dd>}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
