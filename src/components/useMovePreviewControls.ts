import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { GuideMove } from "../game/move-demo";
import {
  MovePreviewGamepads,
  MovePreviewInput,
} from "../game/move-preview-input";

export function useMovePreviewControls(
  content: RefObject<HTMLDivElement | null>,
  onMove: (move: GuideMove) => void,
  onGamepadConnection: (connected: boolean) => void,
) {
  const keyboard = useRef(new MovePreviewInput());
  const gamepads = useRef(new MovePreviewGamepads());
  const reset = useCallback(() => {
    keyboard.current.reset();
    gamepads.current.reset();
  }, []);

  useEffect(() => {
    let focused = document.hasFocus();
    let running = false;
    let disposed = false;
    let raf = 0;
    let connected = false;
    const dialog = () => content.current?.closest("dialog");
    const suspend = () => {
      running = false;
      gamepads.current.suspend();
      reset();
    };
    const blur = () => {
      focused = false;
      suspend();
    };
    const focus = () => {
      focused = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const modal = dialog();
      if (
        !modal?.open ||
        !focused ||
        document.hidden ||
        !(event.target instanceof Node) ||
        !modal.contains(event.target)
      )
        return;
      if (event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.keyCode === 229 ||
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        )
      ) {
        reset();
        return;
      }
      const move = keyboard.current.press(event.code, performance.now());
      if (move) {
        event.preventDefault();
        onMove(move);
      }
    };
    const poll = (now: number) => {
      if (disposed) return;
      const modal = dialog();
      if (
        modal?.open &&
        focused &&
        !document.hidden &&
        modal.contains(document.activeElement)
      ) {
        try {
          if (!running) {
            gamepads.current.resume();
            running = true;
          } else gamepads.current.poll(now).forEach(onMove);
          const next = gamepads.current.connected;
          if (next !== connected) {
            connected = next;
            onGamepadConnection(next);
          }
        } catch {
          suspend();
          if (connected) {
            connected = false;
            onGamepadConnection(false);
          }
        }
      } else if (running) suspend();
      raf = requestAnimationFrame(poll);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", suspend);
    raf = requestAnimationFrame(poll);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", suspend);
      suspend();
    };
  }, [content, onMove, onGamepadConnection, reset]);

  return reset;
}
