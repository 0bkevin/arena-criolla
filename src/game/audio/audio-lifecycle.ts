import {
  context,
  fadeBuses,
  initAudio,
  setPageHidden,
  setSoundEnabled,
} from "./audio-context";
import { ambienceStage, startAmbience } from "./ambience";
import { stopFinaleMusic, stopVictoryMusic } from "./music-playback";
import { stopReactions } from "./reaction-playback";

export function setSound(value: boolean) {
  setSoundEnabled(value);
  if (!value) {
    stopReactions();
    stopVictoryMusic();
    stopFinaleMusic();
  } else if (context || ambienceStage) {
    initAudio(true);
    if (ambienceStage) startAmbience(ambienceStage);
  }
  fadeBuses(value);
}

/** Keep activation inside native events, including touch release on mobile Chrome. */
export function listenForAudioActivation() {
  const activate = () => {
    if (!document.hidden) initAudio(true);
  };
  const visibility = (hidden = document.hidden) => {
    setPageHidden(hidden);
    if (hidden) {
      stopReactions();
      stopFinaleMusic();
      stopVictoryMusic();
    }
  };
  const updateVisibility = () => visibility();
  const hide = () => visibility(true);
  // Touch pointerdown is not an activation event in every browser. The release
  // listeners also cover controls that prevent the compatibility click.
  const gestures = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
  for (const event of gestures)
    window.addEventListener(event, activate, { capture: true, passive: true });
  document.addEventListener("visibilitychange", updateVisibility);
  window.addEventListener("focus", updateVisibility);
  window.addEventListener("pageshow", updateVisibility);
  window.addEventListener("pagehide", hide);
  visibility();
  return () => {
    for (const event of gestures)
      window.removeEventListener(event, activate, { capture: true });
    document.removeEventListener("visibilitychange", updateVisibility);
    window.removeEventListener("focus", updateVisibility);
    window.removeEventListener("pageshow", updateVisibility);
    window.removeEventListener("pagehide", hide);
  };
}
