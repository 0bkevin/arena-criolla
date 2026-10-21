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
import {
  SUPER_ENERGY_COST,
  SUPER_CHARGE_TICKS,
  SUPER_CHARGE_SECONDS_LABEL,
} from "../../shared/content";
import type { Control } from "../game/controls";
import { TouchInputState } from "../game/touch-input";
import { touchControlAtPoint } from "../game/touch-target";

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
      aria-disabled={disabled || undefined}
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
  superUsed,
  superChargeTicks = 0,
  wins,
  specialUnlockWins = 0,
}: {
  onPress: (pointer: number, control: Control) => void;
  onRelease: (pointer: number) => void;
  reset: number;
  energy: number;
  superUsed: boolean;
  superChargeTicks?: number;
  wins: number;
  specialUnlockWins?: number;
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
  const accessibleSuper = useRef<{
    pointer: number;
    started: boolean;
    frame: number;
  } | null>(null);
  const nextVirtualPointer = useRef(-1);

  const syncPressed = () => setPressed(input.current!.pressedControls());

  const releaseAccessibleSuper = () => {
    const hold = accessibleSuper.current;
    if (!hold) return false;
    accessibleSuper.current = null;
    window.cancelAnimationFrame(hold.frame);
    return input.current!.release(hold.pointer);
  };

  const releaseAll = () => {
    releaseAccessibleSuper();
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
      if (!input.current!.hasPointer(event.pointerId)) return;
      // Chorded mouse/pen releases arrive as moves until the last button lifts.
      // Only the primary button/contact owns this gesture.
      if (event.pointerType !== "touch" && (event.buttons & 1) === 0) {
        releasePointer(event);
        return;
      }
      const control = root.current
        ? touchControlAtPoint(
            root.current,
            event.clientX,
            event.clientY,
            input.current!.controlFor(event.pointerId),
          )
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
    window.addEventListener("orientationchange", releaseAllInputs);
    screen.orientation?.addEventListener("change", releaseAllInputs);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      window.removeEventListener("pointerup", releasePointer, true);
      window.removeEventListener("pointercancel", releasePointer, true);
      window.removeEventListener("lostpointercapture", releasePointer, true);
      window.removeEventListener("pointermove", movePointer, true);
      window.removeEventListener("keyup", releaseKey, true);
      window.removeEventListener("blur", releaseAllInputs);
      window.removeEventListener("pagehide", releaseAllInputs);
      window.removeEventListener("orientationchange", releaseAllInputs);
      screen.orientation?.removeEventListener("change", releaseAllInputs);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      // Cleanup releases game inputs without scheduling React state during unmount.
      releaseAccessibleSuper();
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
    if (wins < specialUnlockWins || energy < 25)
      changed = input.current!.releaseControl("special") || changed;
    if (superUsed || energy < SUPER_ENERGY_COST)
      changed = input.current!.releaseControl("super") || changed;
    const hold = accessibleSuper.current;
    if (hold) {
      if (superChargeTicks > 0) {
        hold.started = true;
        window.cancelAnimationFrame(hold.frame);
      }
      if (
        superUsed ||
        energy < SUPER_ENERGY_COST ||
        (hold.started && superChargeTicks === 0)
      )
        changed = releaseAccessibleSuper() || changed;
    }
    if (changed) syncPressed();
  }, [energy, superUsed, superChargeTicks, wins, specialUnlockWins]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const button = target.closest<HTMLButtonElement>(
      "button.touch-button[data-control]",
    );
    if (
      !target.closest(".touch-directions, .touch-actions") ||
      !event.currentTarget.contains(target) ||
      (event.pointerType !== "touch" && event.button !== 0)
    )
      return;

    event.preventDefault();
    // Keep tracking a gesture that starts in a gap or on an unavailable attack.
    // aria-disabled preserves pointer delivery when energy changes mid-gesture.
    const control =
      button?.getAttribute("aria-disabled") !== "true"
        ? ((button?.dataset.control as Control | undefined) ?? null)
        : null;
    if (input.current!.press(event.pointerId, control)) syncPressed();
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
      button.getAttribute("aria-disabled") === "true" ||
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
    if (event.currentTarget.getAttribute("aria-disabled") === "true") return;
    const nativeEvent =
      event.nativeEvent as unknown as globalThis.MouseEvent & {
        pointerType?: string;
      };
    // Pointer down already activated the game; detail 0 is keyboard or AT click.
    if (event.detail !== 0 || nativeEvent.pointerType) return;
    if (control === "super" && accessibleSuper.current) {
      if (releaseAccessibleSuper()) syncPressed();
      return;
    }
    const pointer = nextVirtualPointer.current--;
    input.current!.press(pointer, control);
    syncPressed();
    if (control === "super") {
      // Follow simulation progress instead of expiring a valid charge in wall time.
      const hold = { pointer, started: false, frame: 0 };
      accessibleSuper.current = hold;
      let elapsed = 0;
      let last = performance.now();
      const releaseIfRejected = (now: number) => {
        if (accessibleSuper.current !== hold || hold.started) return;
        // Match the game's elapsed-time cap so a stalled frame cannot expire this.
        elapsed += Math.min(100, Math.max(0, now - last));
        last = now;
        if (elapsed >= 2000) {
          if (releaseAccessibleSuper()) syncPressed();
        } else hold.frame = window.requestAnimationFrame(releaseIfRejected);
      };
      hold.frame = window.requestAnimationFrame(releaseIfRejected);
      return;
    }
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
          disabled={wins < specialUnlockWins || energy < 25}
          reason={
            wins < specialUnlockWins
              ? `Gana ${specialUnlockWins} peleas con este personaje para desbloquearlo.`
              : energy < 25
                ? "Necesitas 25 de energía."
                : "Toca directamente para activar. No se activa al deslizar."
          }
          pressed={pressed.has("special")}
          onClick={handleAccessibleClick}
        >
          {wins < specialUnlockWins ? <LockKeyhole /> : <Zap />}
        </TouchButton>
        <TouchButton
          control="super"
          label="Definitiva"
          text={
            superUsed
              ? "Usada"
              : superChargeTicks > 0
                ? `${Math.floor((superChargeTicks / SUPER_CHARGE_TICKS) * 100)}%`
                : "Cargar"
          }
          disabled={superUsed || energy < SUPER_ENERGY_COST}
          reason={
            superUsed
              ? "Ya usaste la definitiva en esta pelea. Solo se puede usar una vez."
              : energy < SUPER_ENERGY_COST
                ? `Necesitas ${SUPER_ENERGY_COST} de energía. Un uso por pelea.`
                : `Mantén pulsado ${SUPER_CHARGE_SECONDS_LABEL} segundos para cargar. Un golpe interrumpe la carga y cuesta 15 de energía. Un uso por pelea. No se activa al deslizar.`
          }
          pressed={pressed.has("super")}
          onClick={handleAccessibleClick}
        >
          <Zap />
        </TouchButton>
      </div>
    </div>
  );
}
