import { useState } from "react";
import { ChevronDown, Gamepad2, Keyboard, Smartphone } from "lucide-react";
import { hasTouchInput } from "../game/mobile";
import { Modal } from "./Modal";
import "../help.css";

type Device = "keyboard" | "touch" | "gamepad";

const devices = [
  { id: "keyboard", label: "Teclado", icon: Keyboard },
  { id: "touch", label: "Teléfono", icon: Smartphone },
  { id: "gamepad", label: "Mando", icon: Gamepad2 },
] as const;

const controls = [
  {
    action: "Mover",
    first: ["A", "D"],
    second: ["←", "→"],
    touch: "Flechas",
    gamepad: "Stick / cruceta",
  },
  {
    action: "Saltar",
    note: "Puedes saltar dos veces",
    first: ["W"],
    second: ["↑"],
    touch: "Saltar",
    gamepad: "A",
  },
  {
    action: "Bajar de plataforma",
    first: ["S"],
    second: ["↓"],
    touch: "Bajar",
    gamepad: "Stick ↓",
  },
  {
    action: "Bloquear",
    note: "Mantén pulsado",
    first: ["U"],
    second: ["0"],
    touch: "Bloqueo",
    gamepad: "LB",
  },
  {
    action: "Esquivar",
    first: ["Shift izq."],
    second: ["Enter"],
    touch: "Esquiva",
    gamepad: "RB",
  },
  {
    action: "Golpe ligero",
    first: ["J"],
    second: ["1"],
    touch: "Golpe",
    gamepad: "X",
  },
  {
    action: "Golpe fuerte",
    first: ["K"],
    second: ["2"],
    touch: "Fuerte",
    gamepad: "B",
  },
  {
    action: "Especial",
    note: "25 de energía",
    first: ["L"],
    second: ["3"],
    touch: "Especial",
    gamepad: "Y",
  },
  {
    action: "Súper",
    note: "3 victorias · 75 de energía",
    first: ["I"],
    second: ["5"],
    touch: "Súper",
    gamepad: "RT",
  },
] as const;

export function Help({ onClose }: { onClose: () => void }) {
  const [device, setDevice] = useState<Device>(() =>
    hasTouchInput() ? "touch" : "keyboard",
  );
  const [player, setPlayer] = useState<0 | 1>(0);
  const light =
    device === "keyboard"
      ? player === 0
        ? "J"
        : "1"
      : device === "touch"
        ? "Golpe"
        : "X";
  const heavy =
    device === "keyboard"
      ? player === 0
        ? "K"
        : "2"
      : device === "touch"
        ? "Fuerte"
        : "B";

  return (
    <Modal title="Cómo jugar" className="help-modal" onClose={onClose}>
      <div className="help-content">
        <section className="help-goal" aria-labelledby="help-goal-title">
          <h3 id="help-goal-title">Quita las dos vidas a tu rival.</h3>
          <p>
            Vacía su barra de vida o sácalo de la arena para quitarle una vida.
          </p>
        </section>

        <section aria-labelledby="help-controls-title">
          <div className="help-controls-heading">
            <h3 id="help-controls-title">Controles</h3>
            <div
              className="help-devices"
              role="group"
              aria-label="Dispositivo de juego"
            >
              {devices.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={device === id}
                  onClick={() => setDevice(id)}
                >
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {device === "keyboard" ? (
            <div
              className="help-players"
              role="group"
              aria-label="Controles del jugador"
            >
              <button
                type="button"
                aria-pressed={player === 0}
                onClick={() => setPlayer(0)}
              >
                Jugador 1 / en línea
              </button>
              <button
                type="button"
                aria-pressed={player === 1}
                onClick={() => setPlayer(1)}
              >
                Jugador 2 · local
              </button>
            </div>
          ) : (
            <p className="help-device-note">
              {device === "touch"
                ? "Juega en horizontal. Mueve con la izquierda y ataca con la derecha."
                : "Conecta tu mando. Los botones siguen la distribución Xbox."}
            </p>
          )}

          <div className="help-controls-grid">
            {[controls.slice(0, 5), controls.slice(5)].map((group, index) => (
              <dl key={index}>
                {group.map((control) => (
                  <div className="help-control" key={control.action}>
                    <dt>
                      {control.action}
                      {"note" in control && <span>{control.note}</span>}
                    </dt>
                    <dd>
                      {device === "keyboard" ? (
                        (player === 0 ? control.first : control.second).map(
                          (key) => <kbd key={key}>{key}</kbd>,
                        )
                      ) : (
                        <span className="help-input">{control[device]}</span>
                      )}
                    </dd>
                  </div>
                ))}
                {index === 1 && (
                  <div className="help-control">
                    <dt>{device === "keyboard" ? "Pausa / menú" : "Pausar"}</dt>
                    <dd>
                      {device === "keyboard" ? (
                        <kbd>Esc</kbd>
                      ) : (
                        <span className="help-input">Botón de pausa</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            ))}
          </div>

          {device === "keyboard" && player === 1 && (
            <p className="help-device-note">
              Puedes usar los números de la fila superior o del teclado
              numérico.
            </p>
          )}
        </section>

        <details className="help-more">
          <summary>
            Combos y reglas extra <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <ul>
            <li>
              <strong>Combos:</strong> {light} → {heavy} desde el inicio;{" "}
              {light} → {light} → {heavy} tras una victoria con ese personaje.
              Deja terminar cada golpe y completa la secuencia en 2,5 segundos.
            </li>
            <li>
              <strong>Energía:</strong> se recarga al golpear y recibir golpes.
              El súper se desbloquea con tres victorias con ese personaje.
              El especial de las motos de Vicente también requiere tres
              victorias con él.
            </li>
            <li>
              <strong>Tiempo:</strong> cada pelea dura 90 segundos. Si se acaba,
              gana quien conserve más vidas y, si empatan, más salud.
            </li>
          </ul>
        </details>
      </div>
      <div className="help-footer">
        <button type="button" className="help-done" onClick={onClose}>
          Entendido
        </button>
      </div>
    </Modal>
  );
}
