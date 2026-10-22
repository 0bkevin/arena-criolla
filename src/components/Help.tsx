import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Flame,
  Gamepad2,
  Keyboard,
  Smartphone,
  Swords,
  Zap,
} from "lucide-react";
import {
  SUPER_ENERGY_COST,
  SUPER_CHARGE_SECONDS_LABEL,
  SUPER_INTERRUPT_ENERGY_COST,
} from "../../shared/content";
import { hasTouchInput } from "../game/mobile";
import { Modal } from "./Modal";
import { MobileControlsGuide } from "./MobileControlsGuide";
import { DesktopControlsGuide } from "./DesktopControls";
import { GamepadControlsGuide } from "./GamepadControlsGuide";
import "../help.css";

type Device = "keyboard" | "touch" | "gamepad";

const devices = [
  { id: "keyboard", label: "Teclado", icon: Keyboard },
  { id: "touch", label: "Teléfono", icon: Smartphone },
  { id: "gamepad", label: "Mando", icon: Gamepad2 },
] as const;

function ActionInput({
  action,
  device,
  player,
}: {
  action: "light" | "heavy" | "super";
  device: Device;
  player: 0 | 1;
}) {
  const label = {
    light: "Golpe ligero",
    heavy: "Golpe fuerte",
    super: "Definitiva",
  }[action];

  if (device === "touch") {
    const Icon = { light: Swords, heavy: Flame, super: Zap }[action];
    return (
      <span className="help-rule-input is-touch" role="img" aria-label={label}>
        <Icon size={12} aria-hidden="true" />
      </span>
    );
  }

  const input =
    device === "keyboard"
      ? {
          light: player === 0 ? "J" : "1",
          heavy: player === 0 ? "K" : "2",
          super: player === 0 ? "I" : "5",
        }[action]
      : { light: "X", heavy: "B", super: "RT" }[action];

  return device === "keyboard" ? (
    <kbd className="help-rule-input" aria-label={`${label}: ${input}`}>
      {input}
    </kbd>
  ) : (
    <span
      className={`help-rule-input${input.length === 1 ? " is-face-button" : ""}`}
      role="img"
      aria-label={`${label}: ${input}`}
    >
      {input}
    </span>
  );
}

export function Help({ onClose }: { onClose: () => void }) {
  const [device, setDevice] = useState<Device>(() =>
    hasTouchInput() ? "touch" : "keyboard",
  );
  const [player, setPlayer] = useState<0 | 1>(0);
  const input = (action: "light" | "heavy" | "super") => (
    <ActionInput action={action} device={device} player={player} />
  );

  return (
    <Modal title="Cómo jugar" className="help-modal" onClose={onClose}>
      <div className="help-content">
        <section aria-labelledby="help-controls-title">
          <h3 id="help-controls-title" className="sr-only">
            Controles
          </h3>
          <div className="help-view-switcher">
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
          ) : null}

          {device === "touch" ? (
            <MobileControlsGuide />
          ) : device === "keyboard" ? (
            <DesktopControlsGuide player={player} />
          ) : (
            <GamepadControlsGuide />
          )}

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
          <div className="help-rules-grid">
            <section className="help-rule" aria-labelledby="help-combos-title">
              <h4 id="help-combos-title">Combos</h4>
              <p className="help-rule-intro">
                Pulsa en orden y deja terminar cada golpe.
              </p>
              <div className="help-rule-combos">
                <div className="help-rule-combo">
                  <span>Combo corto</span>
                  <span className="help-rule-sequence">
                    {input("light")}
                    <ArrowRight size={11} aria-hidden="true" />
                    {input("heavy")}
                  </span>
                </div>
                <div className="help-rule-combo">
                  <span>Combo largo</span>
                  <span className="help-rule-sequence">
                    {input("light")}
                    <ArrowRight size={11} aria-hidden="true" />
                    {input("light")}
                    <ArrowRight size={11} aria-hidden="true" />
                    {input("heavy")}
                  </span>
                </div>
              </div>
              <p className="help-rule-note">Completa cada combo en 2,5 s.</p>
            </section>
            <section className="help-rule" aria-labelledby="help-super-title">
              <h4 id="help-super-title">Definitiva</h4>
              <p className="help-rule-intro">
                Reúne <strong>{SUPER_ENERGY_COST} de energía</strong> al dar o
                recibir golpes.
              </p>
              <p className="help-rule-charge">
                Mantén {input("super")} {SUPER_CHARGE_SECONDS_LABEL} s para
                lanzarla. <strong>Un uso por pelea.</strong>
              </p>
              <p className="help-rule-note">
                Al cargar, solo puedes moverte más lento.
              </p>
              <dl className="help-rule-outcomes">
                <div>
                  <dt>Si sueltas</dt>
                  <dd>Cancelas sin gastar el uso.</dd>
                </div>
                <div>
                  <dt>Si te golpean</dt>
                  <dd>
                    Cancelas y pierdes {SUPER_INTERRUPT_ENERGY_COST} de energía.
                  </dd>
                </div>
              </dl>
            </section>
            <section
              className="help-rule help-rule-time"
              aria-labelledby="help-time-title"
            >
              <h4 id="help-time-title">Si se acaban los 2 minutos</h4>
              <p>
                Gana quien conserve más vidas. Si tienen las mismas vidas, gana
                quien tenga más salud en la barra. Si también empatan en salud,
                la pelea termina en empate.
              </p>
            </section>
          </div>
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
