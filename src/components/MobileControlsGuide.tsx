import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronsRight,
  Flame,
  LockKeyhole,
  Pause,
  Shield,
  Smartphone,
  Swords,
  Zap,
} from "lucide-react";
import { SUPER_ENERGY_COST, SUPER_UNLOCK_WINS } from "../../shared/content";
import { Portrait } from "./Portrait";

const movement = [
  { icon: ArrowLeftRight, label: "Mover", note: "Flechas izquierda y derecha" },
  { icon: ArrowUp, label: "Saltar", note: "Toca de nuevo en el aire" },
  { icon: ArrowDown, label: "Bajar", note: "Baja de una plataforma" },
  { icon: ChevronsRight, label: "Esquiva", note: "Impúlsate para esquivar" },
  { icon: Pause, label: "Pausa", note: "Arriba a la derecha" },
];
const combat = [
  { icon: Shield, label: "Bloqueo", note: "Mantén pulsado para cubrirte" },
  { icon: Swords, label: "Golpe", note: "Ataque ligero" },
  { icon: Flame, label: "Fuerte", note: "Ataque pesado" },
  { icon: Zap, label: "Especial", note: "Consume 25 de energía" },
  {
    icon: LockKeyhole,
    label: "Súper",
    note: `${SUPER_UNLOCK_WINS} victorias · ${SUPER_ENERGY_COST} de energía`,
  },
];

export function MobileControlsGuide() {
  return (
    <div className="help-touch-guide">
      <p className="help-rotate-note">
        <Smartphone size={20} aria-hidden="true" />
        Juega con el teléfono en horizontal.
      </p>
      <p>
        Desliza sin levantar el dedo para moverte, saltar, esquivar, golpear y
        bloquear. Usa otro dedo para combinar movimiento y ataques. Para
        Especial y Súper, levanta el dedo y toca el botón directamente.
      </p>
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
                <LockKeyhole />
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
      <div className="help-touch-legend">
        {[movement, combat].map((group, index) => (
          <section
            key={index}
            aria-label={index === 0 ? "Movimiento y pausa" : "Combate"}
          >
            <h4>{index === 0 ? "Movimiento" : "Combate"}</h4>
            <dl>
              {group.map(({ icon: Icon, label, note }) => (
                <div key={label}>
                  <Icon size={20} aria-hidden="true" />
                  <dt>{label}</dt>
                  <dd>{note}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
