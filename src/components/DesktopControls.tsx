import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { KEY_MAP, type Control } from "../game/controls";
import {
  fighterById,
  SUPER_CHARGE_SECONDS_LABEL,
  SUPER_ENERGY_COST,
} from "../../shared/content";
import type { PlayerState } from "../../shared/engine";

const bindings = [
  {
    left: "A",
    right: "D",
    jump: "W",
    down: "S",
    light: "J",
    heavy: "K",
    special: "L",
    block: "U",
    dash: "Shift izq.",
    super: "I",
  },
  {
    left: "←",
    right: "→",
    jump: "↑",
    down: "↓",
    light: "1",
    heavy: "2",
    special: "3",
    block: "0",
    dash: "Enter",
    super: "5",
  },
] as const;
type Player = 0 | 1;

function Key({
  control,
  player,
  pressed,
}: {
  control: keyof (typeof bindings)[0];
  player: Player;
  pressed?: ReadonlySet<Control>;
}) {
  return (
    <kbd className={pressed?.has(control) ? "is-held" : undefined}>
      {bindings[player][control]}
    </kbd>
  );
}

export function DesktopControlsGuide({ player }: { player: Player }) {
  const guide = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState<Set<Control>>(() => new Set());
  const [tried, setTried] = useState<Set<Control>>(() => new Set());

  useEffect(() => {
    setPressed(new Set());
    setTried(new Set());
    const dialog = guide.current?.closest("dialog");
    if (!dialog) return;
    const held = new Set<string>();
    const update = () =>
      setPressed(new Set([...held].map((code) => KEY_MAP[code][1])));
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        event.keyCode === 229 ||
        (event.target instanceof HTMLElement &&
          (event.target.closest("input, textarea, select") ||
            event.target.isContentEditable ||
            ((event.code === "Enter" || event.code === "Space") &&
              event.target.closest(
                "button, a[href], summary, [role='button']",
              ))))
      )
        return;
      const binding = KEY_MAP[event.code];
      if (!binding || binding[0] !== player) return;
      event.preventDefault();
      if (held.has(event.code)) return;
      held.add(event.code);
      update();
      setTried((previous) => new Set([...previous, binding[1]]));
    };
    const keyup = (event: KeyboardEvent) => {
      if (held.delete(event.code)) update();
    };
    const clear = () => {
      held.clear();
      setPressed(new Set());
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    dialog.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [player]);

  const key = (control: keyof (typeof bindings)[0]) => (
    <Key control={control} player={player} pressed={pressed} />
  );
  const groups = [
    tried.has("left") || tried.has("right") || tried.has("jump"),
    tried.has("light") || tried.has("heavy") || tried.has("special"),
    tried.has("block") || tried.has("dash"),
  ];
  return (
    <div
      ref={guide}
      className="controls-guide desktop-controls-guide"
      aria-label="Guía rápida de teclado"
    >
      <p className="controls-guide-intro">
        Prueba las teclas aquí. Se iluminan al pulsarlas.
        <span className="controls-tried" role="status">
          {groups.every(Boolean) && (
            <>
              <Check size={15} aria-hidden="true" />
              ¡Ya probaste lo básico!
            </>
          )}
        </span>
      </p>
      <div className="controls-guide-groups">
        <section className="controls-guide-group" aria-label="Movimiento">
          <h4>
            Muévete
            {groups[0] && <Check size={15} aria-label="Teclas probadas" />}
          </h4>
          <dl className="controls-guide-list">
            <div>
              <dt>Mover</dt>
              <dd>
                {key("left")}
                {key("right")}
              </dd>
            </div>
            <div>
              <dt>
                Saltar<small>Pulsa otra vez en el aire</small>
              </dt>
              <dd>{key("jump")}</dd>
            </div>
            <div>
              <dt>Bajar de plataforma</dt>
              <dd>{key("down")}</dd>
            </div>
          </dl>
        </section>
        <section className="controls-guide-group" aria-label="Ataques">
          <h4>
            Ataca{groups[1] && <Check size={15} aria-label="Teclas probadas" />}
          </h4>
          <dl className="controls-guide-list">
            <div>
              <dt>
                Ligero<small>Rápido</small>
              </dt>
              <dd>{key("light")}</dd>
            </div>
            <div>
              <dt>
                Fuerte<small>Más daño</small>
              </dt>
              <dd>{key("heavy")}</dd>
            </div>
            <div>
              <dt>
                Especial<small>25 de energía</small>
              </dt>
              <dd>{key("special")}</dd>
            </div>
          </dl>
        </section>
        <section className="controls-guide-group" aria-label="Defensa y menú">
          <h4>
            Defiéndete
            {groups[2] && <Check size={15} aria-label="Teclas probadas" />}
          </h4>
          <dl className="controls-guide-list">
            <div>
              <dt>
                Bloquear<small>Mantén pulsado</small>
              </dt>
              <dd>{key("block")}</dd>
            </div>
            <div>
              <dt>Esquivar</dt>
              <dd>{key("dash")}</dd>
            </div>
            <div>
              <dt>Pausa / menú</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="controls-guide-footer">
        <div className="controls-guide-extra">
          <h4>
            Tu primer combo
            <span className="controls-combo-keys">
              {key("light")}
              <ArrowRight size={14} aria-hidden="true" />
              {key("heavy")}
            </span>
          </h4>
          <small>Deja terminar cada golpe.</small>
        </div>
        <div className="controls-guide-extra">
          <h4>Definitiva {key("super")}</h4>
          <small>
            Mantén {SUPER_CHARGE_SECONDS_LABEL} s · {SUPER_ENERGY_COST} de
            energía · Un uso por pelea
          </small>
        </div>
      </div>
    </div>
  );
}

export function DesktopControlsBar({
  local,
  players,
  onHelp,
}: {
  local: boolean;
  players: readonly Pick<PlayerState, "config" | "superUsed">[];
  onHelp: () => void;
}) {
  return (
    <div className="game-controls-bar">
      <div className="combat-controls-players">
        {(local ? ([0, 1] as const) : ([0] as const)).map((player) => (
          <div
            className="combat-controls-row"
            key={player}
            aria-label={`Controles del jugador ${player + 1}`}
          >
            {local && (
              <strong className={`combat-player-label combat-player-${player}`}>
                P{player + 1}
              </strong>
            )}
            <span>
              <Key control="left" player={player} />
              <Key control="right" player={player} /> Mover{" "}
              <Key control="jump" player={player} /> Saltar
            </span>
            <span>
              <Key control="light" player={player} /> Ligero{" "}
              <Key control="heavy" player={player} /> Fuerte{" "}
              <Key control="special" player={player} /> Especial
              {players[player].config.wins <
                (fighterById(players[player].config.fighter)
                  .specialUnlockWins ?? 0) &&
                ` (${fighterById(players[player].config.fighter).specialUnlockWins} victorias)`}
            </span>
            <span>
              <Key control="block" player={player} /> Bloquear{" "}
              <Key control="dash" player={player} /> Esquivar
            </span>
            <span>
              <Key control="super" player={player} /> Definitiva (
              {players[player].superUsed
                ? "usada"
                : `mantén ${SUPER_CHARGE_SECONDS_LABEL} s`}
              )
            </span>
          </div>
        ))}
      </div>
      <span className="combat-menu-hint">
        <kbd>Esc</kbd> Menú
      </span>
      <button type="button" className="text-button" onClick={onHelp}>
        Cómo jugar <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
