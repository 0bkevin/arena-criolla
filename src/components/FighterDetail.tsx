import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowRight } from "lucide-react";
import { fighterById, type FighterId } from "../../shared/content";
import { Modal } from "./Modal";
import { FighterMovePreview } from "./FighterMovePreview";
import { moveDemoLabel, type GuideMove } from "../game/move-demo";
import {
  PREVIEW_MOVES,
  PREVIEW_GAMEPAD_KEYS,
} from "../game/move-preview-input";
import { TOUCH_ATTACK_BUTTONS } from "./TouchControls";
import { useMovePreviewControls } from "./useMovePreviewControls";
import { ControlDeviceTabs, type ControlDevice } from "./ControlDeviceTabs";

const TOUCH_ATTACK_FOR_KEY = {
  J: "light",
  K: "heavy",
  L: "special",
  I: "super",
} as const;

export function FighterDetail({
  fighter,
  onClose,
  onSelect,
}: {
  fighter: FighterId;
  onClose: () => void;
  onSelect: () => void;
}) {
  const f = fighterById(fighter);
  const content = useRef<HTMLDivElement>(null);
  const manualDevice = useRef(false);
  const hasGamepad = useRef(false);
  const [device, setDevice] = useState<ControlDevice>("keyboard");
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [preview, setPreview] = useState<{
    move: GuideMove | null;
    revision: number;
  }>({
    move: null,
    revision: 0,
  });
  const play = useCallback((move: GuideMove) => {
    setPreview((value) => ({ move, revision: value.revision + 1 }));
  }, []);
  const onGamepadConnection = useCallback((connected: boolean) => {
    hasGamepad.current = connected;
    setGamepadConnected(connected);
    if (!manualDevice.current)
      setDevice(
        connected
          ? "gamepad"
          : window.matchMedia("(max-width: 800px), (pointer: coarse)").matches
            ? "touch"
            : "keyboard",
      );
  }, []);
  const resetInput = useMovePreviewControls(content, play, onGamepadConnection);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px), (pointer: coarse)");
    const update = () => {
      if (!manualDevice.current)
        setDevice(
          hasGamepad.current ? "gamepad" : media.matches ? "touch" : "keyboard",
        );
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const moveButton = (move: GuideMove) => {
    const definition = PREVIEW_MOVES[move];
    const sequence = definition.keys
      .map((key) =>
        device === "gamepad"
          ? PREVIEW_GAMEPAD_KEYS[key]
          : device === "touch"
            ? TOUCH_ATTACK_BUTTONS[TOUCH_ATTACK_FOR_KEY[key]].label
            : key,
      )
      .join(" → ");
    return (
      <button
        type="button"
        className={
          "move-shortcut" +
          (device === "touch"
            ? " move-touch-control"
            : device === "gamepad"
              ? " move-gamepad-control"
              : "")
        }
        key={move}
        data-move={move}
        aria-label={sequence + ": " + moveDemoLabel(fighter, move)}
        aria-keyshortcuts={
          device === "keyboard" && definition.keys.length === 1
            ? definition.keys[0]
            : undefined
        }
        aria-pressed={preview.move === move}
        onClick={() => {
          resetInput();
          play(move);
        }}
      >
        {definition.keys.map((key, index) => {
          const touch = TOUCH_ATTACK_BUTTONS[TOUCH_ATTACK_FOR_KEY[key]];
          return (
            <Fragment key={index}>
              {index > 0 && (
                <ArrowRight
                  className="move-sequence-arrow"
                  size={14}
                  aria-hidden="true"
                />
              )}
              {device === "touch" ? (
                <span className="move-touch-key" aria-hidden="true">
                  <touch.Icon size={22} />
                  {definition.keys.length === 1 && <span>{touch.text}</span>}
                </span>
              ) : device === "gamepad" ? (
                <kbd
                  className={
                    "help-input" +
                    (PREVIEW_GAMEPAD_KEYS[key].length === 1
                      ? " is-face-button"
                      : "")
                  }
                >
                  {PREVIEW_GAMEPAD_KEYS[key]}
                </kbd>
              ) : (
                <kbd>{key}</kbd>
              )}
            </Fragment>
          );
        })}
      </button>
    );
  };

  const moveList = (combos: boolean) => (
    <dl
      className={
        "controls-guide-list " +
        (combos ? "move-shortcut-combos" : "move-shortcuts")
      }
      aria-label={combos ? "Combos" : "Ataques"}
    >
      {(combos
        ? (["combo1", "combo2"] as const)
        : (["light", "heavy", "special", "final"] as const)
      ).map((move) => (
        <div key={move}>
          <dt>
            {moveDemoLabel(fighter, move)}
            {move === "special" && <small>Especial</small>}
            {move === "final" && <small>Definitiva</small>}
            {move === "combo1" && <small>Combo corto</small>}
            {move === "combo2" && <small>Combo largo</small>}
          </dt>
          <dd>{moveButton(move)}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Modal
      title={f.name}
      wide
      className="content-modal fighter-moves-modal"
      onClose={onClose}
    >
      <div
        ref={content}
        className="fighter-detail"
        style={{ "--fighter-color": f.color } as CSSProperties}
      >
        <FighterMovePreview
          key={fighter}
          fighter={fighter}
          move={preview.move}
          label={
            preview.move ? moveDemoLabel(fighter, preview.move) : "En guardia"
          }
          playbackKey={preview.revision}
        />
        <div className="detail-info">
          <div
            className="detail-moves controls-guide"
            data-input={device}
            role="group"
            aria-label="Mis movimientos"
          >
            <ControlDeviceTabs
              device={device}
              label="Vista de controles"
              onChange={(next) => {
                manualDevice.current = true;
                resetInput();
                setDevice(next);
              }}
            />
            <p
              className="move-list-intro"
              role={device === "gamepad" ? "status" : undefined}
            >
              {device === "touch"
                ? "Toca un botón para ver el movimiento."
                : device === "gamepad"
                  ? gamepadConnected
                    ? "Mando conectado · botones Xbox."
                    : "Conecta un mando o pulsa los botones."
                  : "Pulsa las teclas o los botones."}
            </p>
            {moveList(false)}
          </div>
        </div>
        <section
          className="move-combo-section controls-guide"
          aria-labelledby="move-combos-title"
        >
          <h3 id="move-combos-title">Combos</h3>
          {moveList(true)}
        </section>
        <button
          type="button"
          className="dialog-done help-done"
          onClick={onSelect}
        >
          Elegir a {f.shortName} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </Modal>
  );
}
