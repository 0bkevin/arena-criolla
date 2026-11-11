import { useEffect, type RefObject } from "react";

export type GameOverlay = "orientation" | "pause" | "result";

/**
 * `overlays` must hold stable refs: the effect reruns only when the active
 * overlay changes, not when a new `overlays` object is passed.
 *
 * Move focus into the active overlay, keep Tab inside it, and on close return
 * focus to where it was, or to the arena so gameplay keys keep working.
 */
export function useOverlayFocus(
  activeOverlay: GameOverlay | null,
  overlays: Record<GameOverlay, RefObject<HTMLDivElement | null>>,
  canvas: RefObject<HTMLCanvasElement | null>,
) {
  useEffect(() => {
    const overlay = activeOverlay ? overlays[activeOverlay].current : null;
    if (!overlay) return;
    const previous = document.activeElement;
    overlay.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || document.querySelector("dialog[open]")) return;
      const buttons = [
        ...overlay.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ];
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (
        !overlay.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    window.addEventListener("keydown", containFocus, true);
    return () => {
      window.removeEventListener("keydown", containFocus, true);
      // Resuming play must restore gameplay keys, including P2's Enter dodge.
      if (activeOverlay === "pause" && canvas.current?.isConnected)
        canvas.current.focus({ preventScroll: true });
      else if (
        previous instanceof HTMLElement &&
        previous !== document.body &&
        previous.isConnected
      )
        previous.focus({ preventScroll: true });
      else canvas.current?.focus({ preventScroll: true });
    };
  }, [activeOverlay]);
}
