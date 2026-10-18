export function hasTouchInput() {
  return (
    matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints > 0 &&
      Math.min(screen.width, screen.height) <= 600)
  );
}

/** Keep the arena and its controls inside the area not covered by browser UI. */
export function trackPlayViewport(element: HTMLElement) {
  const viewport = window.visualViewport;
  const update = () => {
    element.style.setProperty(
      "--play-viewport-width",
      `${viewport?.width ?? window.innerWidth}px`,
    );
    element.style.setProperty(
      "--play-viewport-height",
      `${viewport?.height ?? window.innerHeight}px`,
    );
    element.style.setProperty(
      "--play-viewport-left",
      `${viewport?.offsetLeft ?? 0}px`,
    );
    element.style.setProperty(
      "--play-viewport-top",
      `${viewport?.offsetTop ?? 0}px`,
    );
  };
  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  document.addEventListener("fullscreenchange", update);
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
    document.removeEventListener("fullscreenchange", update);
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    for (const name of ["width", "height", "left", "top"])
      element.style.removeProperty(`--play-viewport-${name}`);
  };
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
