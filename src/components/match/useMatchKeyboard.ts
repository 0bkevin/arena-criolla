import { useEffect, type RefObject } from "react";
import type { Input, MatchState } from "../../../shared/engine/engine";
import { INTRO_COUNTDOWN_START } from "../../../shared/engine/intro";
import { KEY_MAP, type ControlSources } from "../../game/input/controls";
import type { GameMode } from "./Game";

interface Options {
  mode: GameMode;
  inputs: RefObject<[Input, Input]>;
  sources: RefObject<[ControlSources, ControlSources]>;
  keys: RefObject<Set<string>>;
  focusedRef: RefObject<boolean>;
  blockedRef: RefObject<boolean>;
  pausedRef: RefObject<boolean>;
  introView: RefObject<MatchState>;
  callbacks: RefObject<{ onInput?: ((input: Input) => void) | undefined }>;
  setPaused: (paused: boolean) => void;
  releaseInputs: () => void;
  togglePause: () => void;
  skipPresentations: () => void;
}

/**
 * Keyboard play: map held keys to each player's controls, keep browser
 * shortcuts, editable fields and dialogs out of the game, toggle pause on
 * Escape and skip entrances on Space. Losing focus or visibility releases
 * every key and pauses offline matches.
 */
export function useMatchKeyboard({
  mode,
  inputs,
  sources,
  keys,
  focusedRef,
  blockedRef,
  pausedRef,
  introView,
  callbacks,
  setPaused,
  releaseInputs,
  togglePause,
  skipPresentations,
}: Options) {
  useEffect(() => {
    const release = releaseInputs;
    const handler = (event: KeyboardEvent, down: boolean) => {
      // Always release an accepted key, even if modifiers/focus changed since
      // keydown. Browser shortcuts and editable controls only suppress presses.
      if (!down) {
        if (!keys.current.delete(event.code)) return;
        const [index] = KEY_MAP[event.code];
        sources.current[index].release(`key:${event.code}`);
        if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
        return;
      }
      if (
        !focusedRef.current ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.keyCode === 229
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches("input, textarea, select") ||
          event.target.isContentEditable)
      )
        return;
      if (document.querySelector("dialog[open]")) return;
      const nativeActivation =
        (event.code === "Enter" || event.code === "Space") &&
        event.target instanceof HTMLElement &&
        event.target.closest("button, a[href], summary, [role='button']");
      // Holding a gameplay key across an overlay must not activate its newly
      // focused button. Check before the paused/finished/orientation guards.
      if (event.repeat && nativeActivation) {
        event.preventDefault();
        return;
      }
      if (blockedRef.current) return;
      if (introView.current.phase === "finished") return;
      if (event.code === "Escape" && !event.repeat) {
        togglePause();
        return;
      }
      if (pausedRef.current) return;
      if (nativeActivation) return;
      if (
        event.code === "Space" &&
        !event.repeat &&
        introView.current.phase === "intro" &&
        introView.current.tick < INTRO_COUNTDOWN_START
      ) {
        event.preventDefault();
        skipPresentations();
        return;
      }
      const mapping = KEY_MAP[event.code];
      if (!mapping || (mapping[0] === 1 && mode !== "local")) return;
      event.preventDefault();
      if (event.repeat || keys.current.has(event.code)) return;
      keys.current.add(event.code);
      const [index, control] = mapping;
      sources.current[index].press(`key:${event.code}`, control);
      if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
    };
    const keyDown = (event: KeyboardEvent) => handler(event, true);
    const keyUp = (event: KeyboardEvent) => handler(event, false);
    const blur = () => {
      focusedRef.current = false;
      release();
      if (mode !== "online" && introView.current.phase !== "finished") {
        pausedRef.current = true;
        setPaused(true);
      }
    };
    const focus = () => {
      focusedRef.current = !document.hidden;
    };
    const hidden = () => {
      if (document.hidden) blur();
      else focusedRef.current = document.hasFocus();
    };
    focusedRef.current = document.hasFocus();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    window.addEventListener("pagehide", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      release();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [mode]);
}
