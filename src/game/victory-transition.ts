import { VICTORY_TRANSITION_MS } from "./victory-types";

/** Reveal the result as one screen, directly over the knockout. */
export function playVictoryTransition(
  screen: HTMLElement,
  onComplete: () => void,
) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false;
  let completed = false;
  const animation = screen.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: reduced.matches ? 100 : VICTORY_TRANSITION_MS,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "both",
  });
  const complete = () => {
    if (disposed || completed) return;
    completed = true;
    animation.cancel();
    onComplete();
  };
  void animation.finished.then(complete, complete);

  const settle = () => {
    if (completed) return;
    animation.finish();
    complete();
  };
  window.addEventListener("resize", settle);
  reduced.addEventListener("change", settle);
  return () => {
    disposed = true;
    window.removeEventListener("resize", settle);
    reduced.removeEventListener("change", settle);
    animation.cancel();
  };
}
