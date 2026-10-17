export function hasTouchInput() {
  return (
    matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints > 0 &&
      Math.min(screen.width, screen.height) <= 600)
  );
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};
let lockedByGame = false;
let fullscreenOwner: HTMLElement | null = null;
let wanted = false;
let requestVersion = 0;

/** Call directly from a tap; denied fullscreen/orientation must never block play. */
export async function enterLandscape(element: HTMLElement) {
  const version = ++requestVersion;
  wanted = true;
  let fullscreen = Boolean(document.fullscreenElement);
  try {
    if (!fullscreen && element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: "hide" });
      fullscreen = true;
      if (version === requestVersion) fullscreenOwner = element;
    }
    if (version !== requestVersion) {
      if (!wanted && document.fullscreenElement === element)
        await document.exitFullscreen().catch(() => {});
      return { fullscreen: false, locked: false };
    }
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (hasTouchInput() && orientation?.lock) {
      try {
        await orientation.lock("landscape");
        if (version !== requestVersion && !wanted) orientation.unlock();
        else lockedByGame = true;
      } catch {
        // Safari and some embedded browsers require the player to rotate manually.
      }
    }
  } catch {
    // The landscape layout also works without the Fullscreen API.
  }
  return { fullscreen, locked: lockedByGame };
}

export function leaveLandscape() {
  requestVersion++;
  wanted = false;
  try {
    if (lockedByGame) screen.orientation?.unlock();
  } catch {}
  lockedByGame = false;
  if (fullscreenOwner && document.fullscreenElement === fullscreenOwner)
    void document.exitFullscreen().catch(() => {});
  fullscreenOwner = null;
}

export function beginMobilePlay() {
  const root = document.getElementById("root");
  if (root && hasTouchInput()) {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    void enterLandscape(root);
  }
}
