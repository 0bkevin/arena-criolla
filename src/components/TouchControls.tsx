import { useEffect, useRef, useState, type ReactNode } from "react";
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

interface ButtonProps {
  control: Control;
  label: string;
  text?: string;
  children: ReactNode;
  onPress: (pointer: number, control: Control) => void;
  onRelease: (pointer: number) => void;
  reset: number;
  disabled?: boolean;
  reason?: string;
}
function TouchButton({
  control,
  label,
  text,
  children,
  onPress,
  onRelease,
  reset,
  disabled,
  reason,
}: ButtonProps) {
  const node = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Set<number>());
  const callbacks = useRef({ onPress, onRelease });
  callbacks.current = { onPress, onRelease };
  const [pressed, setPressed] = useState(false);
  const release = (id: number) => {
    if (!pointers.current.delete(id)) return;
    callbacks.current.onRelease(id);
    if (node.current?.hasPointerCapture(id))
      node.current.releasePointerCapture(id);
    setPressed(pointers.current.size > 0);
  };
  useEffect(() => {
    for (const id of [...pointers.current]) release(id);
    setPressed(false);
  }, [reset, disabled]);
  useEffect(
    () => () => {
      for (const id of pointers.current) callbacks.current.onRelease(id);
      pointers.current.clear();
    },
    [],
  );
  return (
    <button
      ref={node}
      type="button"
      className={`touch-button touch-${control}${pressed ? " is-pressed" : ""}`}
      data-control={control}
      aria-label={label}
      aria-description={reason}
      disabled={disabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (disabled || (event.pointerType === "mouse" && event.button !== 0))
          return;
        event.preventDefault();
        if (pointers.current.has(event.pointerId)) return;
        pointers.current.add(event.pointerId);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        callbacks.current.onPress(event.pointerId, control);
        setPressed(true);
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
      onLostPointerCapture={(event) => release(event.pointerId)}
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
  onPress: ButtonProps["onPress"];
  onRelease: ButtonProps["onRelease"];
  reset: number;
  energy: number;
  wins: number;
}) {
  const common = { onPress, onRelease, reset };
  return (
    <div
      className="touch-controls"
      aria-label="Controles táctiles"
    >
      <div className="touch-directions" role="group" aria-label="Movimiento">
        <TouchButton {...common} control="left" label="Mover a la izquierda">
          <ArrowLeft />
        </TouchButton>
        <TouchButton {...common} control="right" label="Mover a la derecha">
          <ArrowRight />
        </TouchButton>
        <TouchButton {...common} control="jump" label="Saltar" text="Saltar">
          <ArrowUp />
        </TouchButton>
        <TouchButton
          {...common}
          control="down"
          label="Bajar de plataforma"
          text="Bajar"
        >
          <ArrowDown />
        </TouchButton>
        <TouchButton {...common} control="dash" label="Esquivar" text="Esquiva">
          <ChevronsRight />
        </TouchButton>
      </div>
      <div className="touch-actions" role="group" aria-label="Combate">
        <TouchButton
          {...common}
          control="block"
          label="Bloquear"
          text="Bloqueo"
        >
          <Shield />
        </TouchButton>
        <TouchButton
          {...common}
          control="light"
          label="Golpe ligero"
          text="Golpe"
        >
          <Swords />
        </TouchButton>
        <TouchButton
          {...common}
          control="heavy"
          label="Golpe fuerte"
          text="Fuerte"
        >
          <Flame />
        </TouchButton>
        <TouchButton
          {...common}
          control="special"
          label="Ataque especial"
          text="Especial"
          disabled={energy < 25}
          reason={energy < 25 ? "Necesitas 25 de energía." : undefined}
        >
          <Zap />
        </TouchButton>
        <TouchButton
          {...common}
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
        >
          {wins < 3 ? <LockKeyhole /> : <Zap />}
        </TouchButton>
      </div>
    </div>
  );
}
