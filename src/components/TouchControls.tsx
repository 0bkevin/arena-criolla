import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type PointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsRight,
  Flame,
  LockKeyhole,
  Shield,
  Swords,
  Zap,
} from "lucide-react";
import type { Control } from "../game/controls";
import { TouchInputState } from "../game/touch-input";

interface ButtonProps {
  control: Control;
  label: string;
  text?: string;
  children: ReactNode;
  pressed: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>, control: Control) => void;
}

function TouchButton({
  control,
  label,
  text,
  children,
  pressed,
  onClick,
  disabled,
  reason,
}: ButtonProps & { disabled?: boolean; reason?: string }) {
  return (
    <button
      type="button"
      className={`touch-button touch-${control}${pressed ? " is-pressed" : ""}`}
      data-control={control}
      aria-label={label}
      aria-description={reason}
      title={reason}
      disabled={disabled}
      onClick={(event) => onClick(event, control)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
      {text && <span>{text}</span>}
    </button>
  );
}

export function TouchControls({
  onPress,
  onRelease,
  reset,
  energy,
  wins,
}: {
  onPress: (pointer: number, control: Control) => void;
  onRelease: (pointer: number) => void;
  reset: number;
  energy: number;
  wins: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onPress, onRelease });
  callbacks.current = { onPress, onRelease };
  const input = useRef<TouchInputState | null>(null);
  if (!input.current) {
    input.current = new TouchInputState(
      (pointer, control) => callbacks.current.onPress(pointer, control),
      (pointer) => callbacks.current.onRelease(pointer),
    );
  }
  const [pressed, setPressed] = useState<Set<Control>>(() => new Set());
  const keyboardPointers = useRef(new Map<string, number>());
  const tapTimers = useRef(new Map<number, number>());
  const nextVirtualPointer = useRef(-1);

  const syncPressed = () => setPressed(input.current!.pressedControls());

  const releaseAll = () => {
    const target = root.current;
    for (const pointer of input.current!.pointers()) {
      if (pointer < 0) continue;
      try {
        if (target?.hasPointerCapture(pointer))
          target.releasePointerCapture(pointer);
      } catch {
        // Pointer capture can already be gone after cancel, blur, or unmount.
      }
    }
    input.current!.releaseAll();
    keyboardPointers.current.clear();
    for (const timer of tapTimers.current.values()) window.clearTimeout(timer);
    tapTimers.current.clear();
    syncPressed();
  };

  useEffect(() => {
    const releasePointer = (event: globalThis.PointerEvent) => {
      if (
        (event.type !== "lostpointercapture" ||
          event.target === root.current) &&
        input.current!.release(event.pointerId)
      )
        syncPressed();
    };
    const movePointer = (event: globalThis.PointerEvent) => {
      if (!input.current!.canSlide(event.pointerId)) return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLButtonElement>("button.touch-button[data-control]");
      const control =
        target && root.current?.contains(target) && !target.disabled
          ? (target.dataset.control as Control)
          : null;
      if (input.current!.move(event.pointerId, control)) syncPressed();
    };
    const releaseKey = (event: globalThis.KeyboardEvent) => {
      const pointer = keyboardPointers.current.get(event.code);
      if (pointer === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      keyboardPointers.current.delete(event.code);
      if (input.current!.release(pointer)) syncPressed();
    };
    const releaseAllInputs = () => releaseAll();
    const releaseWhenHidden = () => {
      if (document.visibilityState === "hidden") releaseAllInputs();
    };

    // Window-level handlers also cover failed capture and releases outside the UI.
    window.addEventListener("pointerup", releasePointer, true);
    window.addEventListener("pointercancel", releasePointer, true);
    window.addEventListener("lostpointercapture", releasePointer, true);
    window.addEventListener("pointermove", movePointer, true);
    window.addEventListener("keyup", releaseKey, true);
    window.addEventListener("blur", releaseAllInputs);
    window.addEventListener("pagehide", releaseAllInputs);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      window.removeEventListener("pointerup", releasePointer, true);
      window.removeEventListener("pointercancel", releasePointer, true);
      window.removeEventListener("lostpointercapture", releasePointer, true);
      window.removeEventListener("pointermove", movePointer, true);
      window.removeEventListener("keyup", releaseKey, true);
      window.removeEventListener("blur", releaseAllInputs);
      window.removeEventListener("pagehide", releaseAllInputs);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      // Cleanup releases game inputs without scheduling React state during unmount.
      for (const pointer of input.current!.pointers()) {
        if (pointer < 0) continue;
        try {
          if (root.current?.hasPointerCapture(pointer))
            root.current.releasePointerCapture(pointer);
        } catch {
          // The browser may have implicitly released it already.
        }
      }
      input.current!.releaseAll();
      keyboardPointers.current.clear();
      for (const timer of tapTimers.current.values())
        window.clearTimeout(timer);
      tapTimers.current.clear();
    };
  }, []);

  useLayoutEffect(() => {
    releaseAll();
  }, [reset]);

  useLayoutEffect(() => {
    let changed = false;
    if (energy < 25)
      changed = input.current!.releaseControl("special") || changed;
    if (wins < 3 || energy < 75)
      changed = input.current!.releaseControl("super") || changed;
    if (changed) syncPressed();
  }, [energy, wins]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button.touch-button[data-control]",
    );
    if (
      !button ||
      !event.currentTarget.contains(button) ||
      button.disabled ||
      (event.pointerType !== "touch" && event.button !== 0)
    )
      return;

    event.preventDefault();
    if (
      input.current!.press(event.pointerId, button.dataset.control as Control)
    )
      syncPressed();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The window listeners above still release the pointer if capture fails.
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button.touch-button[data-control]",
    );
    if (!button || !event.currentTarget.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      button.disabled ||
      event.repeat ||
      keyboardPointers.current.has(event.code)
    )
      return;
    const pointer = nextVirtualPointer.current--;
    keyboardPointers.current.set(event.code, pointer);
    if (input.current!.press(pointer, button.dataset.control as Control))
      syncPressed();
  };

  const handleAccessibleClick = (
    event: MouseEvent<HTMLButtonElement>,
    control: Control,
  ) => {
    const nativeEvent =
      event.nativeEvent as unknown as globalThis.MouseEvent & {
        pointerType?: string;
      };
    // Pointer down already activated the game; detail 0 is keyboard or AT click.
    if (event.detail !== 0 || nativeEvent.pointerType) return;
    const pointer = nextVirtualPointer.current--;
    input.current!.press(pointer, control);
    syncPressed();
    const timer = window.setTimeout(() => {
      tapTimers.current.delete(pointer);
      if (input.current!.release(pointer)) syncPressed();
    }, 100);
    tapTimers.current.set(pointer, timer);
  };

  return (
    <div
      ref={root}
      className="touch-controls"
      role="group"
      aria-label="Controles táctiles"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <div className="touch-directions" role="group" aria-label="Movimiento">
        <TouchButton
          control="left"
          label="Mover a la izquierda"
          pressed={pressed.has("left")}
          onClick={handleAccessibleClick}
        >
          <ArrowLeft />
        </TouchButton>
        <TouchButton
          control="right"
          label="Mover a la derecha"
          pressed={pressed.has("right")}
          onClick={handleAccessibleClick}
        >
          <ArrowRight />
        </TouchButton>
        <TouchButton
          control="jump"
          label="Saltar"
          text="Saltar"
          pressed={pressed.has("jump")}
          onClick={handleAccessibleClick}
        >
          <ArrowUp />
        </TouchButton>
        <TouchButton
          control="down"
          label="Bajar de plataforma"
          text="Bajar"
          pressed={pressed.has("down")}
          onClick={handleAccessibleClick}
        >
          <ArrowDown />
        </TouchButton>
        <TouchButton
          control="dash"
          label="Esquivar"
          text="Esquiva"
          pressed={pressed.has("dash")}
          onClick={handleAccessibleClick}
        >
          <ChevronsRight />
        </TouchButton>
      </div>
      <div className="touch-actions" role="group" aria-label="Combate">
        <TouchButton
          control="block"
          label="Bloquear"
          text="Bloqueo"
          pressed={pressed.has("block")}
          onClick={handleAccessibleClick}
        >
          <Shield />
        </TouchButton>
        <TouchButton
          control="light"
          label="Golpe ligero"
          text="Golpe"
          pressed={pressed.has("light")}
          onClick={handleAccessibleClick}
        >
          <Swords />
        </TouchButton>
        <TouchButton
          control="heavy"
          label="Golpe fuerte"
          text="Fuerte"
          pressed={pressed.has("heavy")}
          onClick={handleAccessibleClick}
        >
          <Flame />
        </TouchButton>
        <TouchButton
          control="special"
          label="Ataque especial"
          text="Especial"
          disabled={energy < 25}
          reason={energy < 25 ? "Necesitas 25 de energía." : undefined}
          pressed={pressed.has("special")}
          onClick={handleAccessibleClick}
        >
          <Zap />
        </TouchButton>
        <TouchButton
          control="super"
          label="Definitiva"
          text="Súper"
          disabled={wins < 3 || energy < 75}
          reason={
            wins < 3
              ? "Gana 3 peleas con este personaje para desbloquearla."
              : energy < 75
                ? "Necesitas 75 de energía."
                : undefined
          }
          pressed={pressed.has("super")}
          onClick={handleAccessibleClick}
        >
          {wins < 3 ? <LockKeyhole /> : <Zap />}
        </TouchButton>
      </div>
    </div>
  );
}
