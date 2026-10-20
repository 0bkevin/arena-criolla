import type { Control } from "./controls";

// Spatial tolerance, not a timer: keep small gap jitter from re-firing attacks.
// Never enlarge initial targets or delay entry into another button. This is a
// product tuning value in CSS pixels, not a platform-prescribed threshold.
const RELEASE_SLOP = 6;
const BUTTON = "button.touch-button[data-control]";
const GROUP = ".touch-directions, .touch-actions";

function available(button: HTMLButtonElement) {
  return !button.disabled && button.getAttribute("aria-disabled") !== "true";
}

/** Resolve the current hit before considering retention of the previous target. */
export function touchControlAtPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number,
  current: Control | null,
): Control | null {
  const hit = root.ownerDocument.elementFromPoint(clientX, clientY);
  // Covers outside the viewport, leaving the pad, and obscuring overlays.
  if (!hit || !root.contains(hit)) return null;
  const button = hit.closest<HTMLButtonElement>(BUTTON);
  if (button)
    return available(button) ? (button.dataset.control as Control) : null;

  if (!current) return null;
  const previous = root.querySelector<HTMLButtonElement>(
    `${BUTTON}[data-control="${current}"]`,
  );
  if (
    !previous ||
    !available(previous) ||
    hit.closest(GROUP) !== previous.closest(GROUP)
  )
    return null;

  // Read live geometry so browser bars, zoom, and responsive layout cannot leave
  // stale hit areas. Only the currently owned button gets this gap tolerance.
  const rect = previous.getBoundingClientRect();
  return clientX >= rect.left - RELEASE_SLOP &&
    clientX <= rect.right + RELEASE_SLOP &&
    clientY >= rect.top - RELEASE_SLOP &&
    clientY <= rect.bottom + RELEASE_SLOP
    ? current
    : null;
}
