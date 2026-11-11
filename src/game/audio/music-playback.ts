import type { FighterId } from "../../../shared/roster/roster";
import { VICTORY_MUSIC_MS } from "../match/victory-types";
import type { FinaleState } from "../../../shared/engine/finales/finales";
import {
  context,
  enabled,
  initAudio,
  musicBus,
  pageHidden,
} from "./audio-context";
import { finaleRequest, scoreBuffer, victoryRequest } from "./score-buffers";

let victorySource: AudioBufferSourceNode | null = null;
let victoryGain: GainNode | null = null;
let finaleSource: AudioBufferSourceNode | null = null;
let finaleGain: GainNode | null = null;
let finaleKey = "";

export function stopVictoryMusic() {
  if (victorySource) {
    victorySource.stop();
    victorySource.disconnect();
    victorySource = null;
  }
  victoryGain?.disconnect();
  victoryGain = null;
}

export function stopFinaleMusic() {
  if (finaleSource) {
    finaleSource.stop();
    finaleSource.disconnect();
    finaleSource = null;
  }
  finaleGain?.disconnect();
  finaleGain = null;
  finaleKey = "";
}

/** The simulation clock is authoritative, including reconnects and unmuting. */
export function syncFinaleMusic(
  scene:
    | Pick<
        FinaleState,
        "fighter" | "owner" | "startedTick" | "tick" | "duration"
      >
    | undefined,
  paused: boolean,
) {
  if (
    !scene ||
    paused ||
    pageHidden ||
    !enabled ||
    scene.tick >= scene.duration
  ) {
    stopFinaleMusic();
    return;
  }
  const key = `${scene.fighter}:${scene.owner}:${scene.startedTick}`;
  if (finaleSource && finaleKey === key) return;
  stopFinaleMusic();
  initAudio();
  if (!context || !musicBus || context.state !== "running") return;
  const buffer = scoreBuffer(
    finaleRequest(scene.fighter, context.sampleRate, scene.duration),
  );
  if (!buffer) return;
  finaleKey = key;
  finaleSource = context.createBufferSource();
  finaleSource.buffer = buffer;
  finaleGain = context.createGain();
  finaleGain.gain.value = scene.fighter === "nacho" ? 0.8 : 2.4;
  finaleSource.connect(finaleGain);
  finaleGain.connect(musicBus);
  finaleSource.start(0, Math.max(0, scene.tick / 60));
}

/** Resume from the cinematic clock after mute, a dialog or a hidden tab. */
export function syncVictoryMusic(
  fighter: FighterId | "draw",
  elapsedMs: number,
  paused: boolean,
) {
  if (paused || pageHidden || !enabled || elapsedMs >= VICTORY_MUSIC_MS) {
    stopVictoryMusic();
    return;
  }
  if (victorySource) return;
  initAudio();
  if (!context || !musicBus || context.state !== "running") return;
  const buffer = scoreBuffer(victoryRequest(fighter, context.sampleRate));
  if (!buffer) return;
  victorySource = context.createBufferSource();
  victorySource.buffer = buffer;
  victoryGain = context.createGain();
  victoryGain.gain.value = 1.9;
  victorySource.connect(victoryGain);
  victoryGain.connect(musicBus);
  victorySource.start(0, Math.max(0, elapsedMs / 1000));
}

/** Start with the winner screen, independently of the arena's stopped clock. */
export function startVictoryMusic(fighter: FighterId | "draw") {
  const started = performance.now();
  let frame = 0;
  let disposed = false;
  let focused = document.hasFocus?.() ?? true;
  const update = () => {
    if (disposed) return;
    const elapsed = performance.now() - started;
    syncVictoryMusic(
      fighter,
      elapsed,
      document.hidden ||
        !focused ||
        Boolean(document.querySelector("dialog[open]")),
    );
    if (elapsed < VICTORY_MUSIC_MS) frame = requestAnimationFrame(update);
  };
  const hide = () => {
    focused = document.hasFocus?.() ?? focused;
    if (document.hidden || !focused) stopVictoryMusic();
  };
  const blur = () => {
    focused = false;
    stopVictoryMusic();
  };
  const focus = () => {
    focused = !document.hidden;
  };
  document.addEventListener("visibilitychange", hide);
  if (typeof window !== "undefined") {
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
  }
  update();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", hide);
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    }
    stopVictoryMusic();
  };
}
