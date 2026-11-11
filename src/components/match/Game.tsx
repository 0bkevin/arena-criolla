import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { fighterById, stageById } from "../../../shared/roster/roster";
import {
  INTRO_COUNTDOWN_START,
  introActor,
} from "../../../shared/engine/intro";
import {
  cpuInput,
  stepMatch,
  type Input,
  type MatchState,
  type PlayerIndex,
} from "../../../shared/engine/engine";
import { preloadAssets } from "../../game/assets/assets";
import { renderMatch, type Assets } from "../../game/render/renderer";
import {
  applyControl,
  ControlSources,
  GamepadControls,
  makeInputs,
  type Control,
} from "../../game/input/controls";
import {
  initAudio,
  prepareMatchAudio,
  playReaction,
  preloadReactions,
  sound,
  stopReactions,
  setReactionsPaused,
  startAmbience,
  stopAmbience,
  setAmbiencePaused,
  setSoundView,
  syncFinaleMusic,
  stopFinaleMusic,
} from "../../game/audio/audio";
import { KNOCKOUT_HOLD_MS } from "../../game/match/knockout";
import { createMatchCues } from "../../game/match/match-cues";
import { smoothRemotePlayers } from "../../game/match/remote-smoothing";
import { VictoryScreen } from "./VictoryScreen";
import { GameToolbar } from "./GameToolbar";
import { IntroOverlay } from "./IntroOverlay";
import { MatchHud } from "./MatchHud";
import { OrientationGate } from "./OrientationGate";
import { PauseMenu } from "./PauseMenu";
import { useMatchKeyboard } from "./useMatchKeyboard";
import { useOverlayFocus } from "./useOverlayFocus";
import { TouchControls } from "./TouchControls";
import { DesktopControlsBar } from "./DesktopControls";
import {
  enterLandscape,
  hasTouchInput,
  leaveLandscape,
  trackHybridGameChrome,
  trackPlayViewport,
} from "../../game/viewport/mobile";
import { arenaCanvasSize } from "../../game/viewport/viewport";
import { ARENA_VIEW } from "../../../shared/engine/arena";
import {
  advanceArenaCamera,
  cameraBounds,
  type ArenaCamera,
} from "../../game/viewport/arena-camera";

export type GameMode = "practice" | "local" | "online";
interface Props {
  initial: MatchState;
  mode: GameMode;
  difficulty: "easy" | "normal" | "hard";
  remote?: MutableRefObject<MatchState | null>;
  localIndex?: PlayerIndex;
  onInput?: (input: Input) => void;
  onExit: () => void;
  onResult: (state: MatchState, index: PlayerIndex) => void;
  onRematch: () => void;
  rematchWaiting?: boolean | undefined;
  onHelp: () => void;
  soundEnabled?: boolean | undefined;
  onToggleSound?: (() => void) | undefined;
}

export function Game(props: Props) {
  const { initial, mode, difficulty, remote, localIndex = 0 } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const page = useRef<HTMLElement>(null);
  const orientationGate = useRef<HTMLDivElement>(null);
  const pauseOverlay = useRef<HTMLDivElement>(null);
  const resultOverlay = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const inputs = useRef(makeInputs());
  const sources = useRef<[ControlSources, ControlSources]>([
    new ControlSources(inputs.current[0]),
    new ControlSources(inputs.current[1]),
  ]);
  const gamepads = useRef(new GamepadControls(sources.current));
  const focusedRef = useRef(true);
  const keys = useRef(new Set<string>());
  const [touchReset, setTouchReset] = useState(0);
  const [device, setDevice] = useState(() => ({
    touch: hasTouchInput(),
    portrait: innerHeight > innerWidth,
  }));
  const [resultReady, setResultReady] = useState(false);
  const [resultMounted, setResultMounted] = useState(false);
  const finishResultTransition = useCallback(() => setResultReady(true), []);
  const touchControlsAvailable = device.touch || navigator.maxTouchPoints > 0;
  const portraitBlocked = device.touch && device.portrait && !resultMounted;
  const blockedRef = useRef(portraitBlocked);
  blockedRef.current = portraitBlocked;
  const callbacks = useRef(props);
  callbacks.current = props;
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [assetError, setAssetError] = useState("");
  const [view, setView] = useState(initial);
  const [fullscreenError, setFullscreenError] = useState("");
  useLayoutEffect(() => {
    if (!device.touch && !paused && view.phase !== "finished" && page.current)
      return trackHybridGameChrome(page.current);
    return undefined;
  }, [device.touch, touchControlsAvailable, paused, view.phase]);
  useEffect(() => {
    if (device.touch && page.current) return trackPlayViewport(page.current);
    return undefined;
  }, [device.touch]);
  useEffect(() => {
    const element = canvas.current,
      container = wrapper.current;
    if (!element || !container) return;
    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const size = arenaCanvasSize(bounds.width, bounds.height, device.touch);
      if (element.width !== size.width) element.width = size.width;
      if (element.height !== size.height) element.height = size.height;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [device.touch]);
  useEffect(() => {
    if (!fullscreenError) return;
    const timer = setTimeout(() => setFullscreenError(""), 2500);
    return () => clearTimeout(timer);
  }, [fullscreenError]);
  const resultSent = useRef(false);
  const introView = useRef(initial);
  introView.current = view;
  const isGameQuiet = () =>
    pausedRef.current ||
    blockedRef.current ||
    !focusedRef.current ||
    Boolean(document.querySelector("dialog[open]")) ||
    document.hidden;
  const syncAmbiencePause = (phase = introView.current.phase) =>
    setAmbiencePaused(
      isGameQuiet() ||
        phase === "finished" ||
        Boolean(introView.current.finale),
    );
  const releaseInputs = (menuAvailable = false) => {
    gamepads.current.suspend(inputs.current, { menu: menuAvailable });
    sources.current.forEach((source) => source.clear());
    keys.current.clear();
    setTouchReset((value) => value + 1);
    if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
  };
  const openHelp = () => {
    releaseInputs();
    // The modal returns focus here, restoring P2's Enter dodge on close.
    if (!pausedRef.current && !blockedRef.current)
      canvas.current?.focus({ preventScroll: true });
    callbacks.current.onHelp();
  };
  useEffect(() => {
    if (view.finale) releaseInputs();
  }, [view.finale?.startedTick]);
  const requestLandscape = () => {
    releaseInputs();
    const root = document.getElementById("root");
    if (root)
      void enterLandscape(root).then((result) => {
        if (!result.fullscreen)
          setFullscreenError(
            "Puedes seguir jugando en horizontal sin pantalla completa.",
          );
      });
  };
  useEffect(() => {
    const update = () =>
      setDevice({ touch: hasTouchInput(), portrait: innerHeight > innerWidth });
    const coarse = matchMedia("(pointer: coarse)");
    const orientation = () => {
      releaseInputs();
      update();
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", orientation);
    screen.orientation?.addEventListener("change", orientation);
    coarse.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", orientation);
      screen.orientation?.removeEventListener("change", orientation);
      coarse.removeEventListener("change", update);
      queueMicrotask(() => {
        if (!document.querySelector(".game-page")) leaveLandscape();
      });
    };
  }, []);
  useEffect(() => {
    releaseInputs();
  }, [portraitBlocked]);
  const activeOverlay = portraitBlocked
    ? "orientation"
    : paused && view.phase !== "finished"
      ? "pause"
      : resultReady
        ? "result"
        : null;
  useOverlayFocus(
    activeOverlay,
    {
      orientation: orientationGate,
      pause: pauseOverlay,
      result: resultOverlay,
    },
    canvas,
  );
  const skipPresentations = () => {
    if (
      introView.current.phase !== "intro" ||
      introView.current.tick >= INTRO_COUNTDOWN_START ||
      pausedRef.current
    )
      return;
    applyControl(inputs.current[0], "dash", true);
    if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
  };
  useEffect(() => {
    let alive = true;
    void prepareMatchAudio(
      initial.players.map((player) => player.config.fighter),
    );
    void preloadAssets(
      initial.players.map((player) => player.config.fighter),
      [initial.stage],
      { deferFinales: true },
    )
      .then((value) => {
        if (alive) setAssets(value);
      })
      .catch(() => {
        if (alive)
          setAssetError(
            "No se pudieron cargar los personajes. Vuelve a intentar.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  const togglePause = () => {
    // Start remains available through ordinary pause/resume transitions.
    releaseInputs(true);
    pausedRef.current = !pausedRef.current;
    if (!pausedRef.current)
      gamepads.current.resume(inputs.current, mode === "local" ? 2 : 1);
    setPaused(pausedRef.current);
  };
  useMatchKeyboard({
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
  });

  useEffect(() => {
    if (!assets || !canvas.current) return;
    const ctx = canvas.current.getContext("2d")!;
    let state = structuredClone(initial);
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let lastUI = 0;
    let lastSend = 0;
    let camera: ArenaCamera | undefined;
    let cameraWidth = ctx.canvas.width;
    let cameraHeight = ctx.canvas.height;
    let knockoutElapsed = 0;
    let knockoutStarted = false;
    let knockoutLast = last;
    let knockoutQuiet = isGameQuiet();
    const advanceKnockoutClock = (now: number, quiet: boolean) => {
      if (knockoutStarted && !knockoutQuiet)
        knockoutElapsed = Math.min(
          KNOCKOUT_HOLD_MS,
          knockoutElapsed + Math.max(0, now - knockoutLast),
        );
      knockoutLast = now;
      knockoutQuiet = quiet;
    };
    const syncKnockoutPause = () => {
      const quiet = isGameQuiet();
      if (quiet !== knockoutQuiet)
        advanceKnockoutClock(performance.now(), quiet);
    };
    let resultShown = false;
    let settledFrame:
      | {
          state: MatchState;
          width: number;
          height: number;
          reducedMotion: boolean;
        }
      | undefined;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const cues = createMatchCues(initial, { sound, playReaction });
    const positions = initial.players.map((p) => ({ x: p.x, y: p.y }));
    const animate = (now: number) => {
      const elapsed = Math.min(100, now - last);
      last = now;
      if (mode === "online" && remote?.current?.id === initial.id)
        state = remote.current;
      const finalStill =
        state.phase === "finished" && knockoutElapsed >= KNOCKOUT_HOLD_MS;
      if (
        finalStill &&
        settledFrame?.state === state &&
        settledFrame.width === ctx.canvas.width &&
        settledFrame.height === ctx.canvas.height &&
        settledFrame.reducedMotion === motionPreference.matches
      ) {
        raf = requestAnimationFrame(animate);
        return;
      }
      const dialogOpen = Boolean(document.querySelector("dialog[open]"));
      const quiet = isGameQuiet();
      setReactionsPaused(quiet || Boolean(state.finale));
      if (dialogOpen) sources.current.forEach((source) => source.clear());
      const menuAvailable =
        focusedRef.current &&
        !document.hidden &&
        !blockedRef.current &&
        !dialogOpen &&
        state.phase !== "finished";
      const pausePressed = gamepads.current.update(
        inputs.current,
        mode === "local" ? 2 : 1,
        { gameplay: menuAvailable && !pausedRef.current, menu: menuAvailable },
      );
      if (menuAvailable && pausePressed) togglePause();
      if (mode === "online") {
        if (state.phase !== "finished" && now - lastSend > 45) {
          callbacks.current.onInput?.(inputs.current[0]);
          lastSend = now;
        }
      } else if (!pausedRef.current && !blockedRef.current && !dialogOpen) {
        accumulator += elapsed;
        while (accumulator >= 1000 / 60) {
          if (mode === "practice")
            inputs.current[1] = cpuInput(state, inputs.current[1], difficulty);
          stepMatch(state, inputs.current);
          accumulator -= 1000 / 60;
        }
      }
      syncAmbiencePause(state.phase);
      setAmbiencePaused(
        quiet || state.phase === "finished" || Boolean(state.finale),
      );
      syncFinaleMusic(
        state.finale ?? state.fieldFinales?.[0],
        quiet || state.phase === "finished",
      );
      if (state.phase === "finished") {
        if (!knockoutStarted) {
          knockoutStarted = true;
          releaseInputs();
          stopReactions();
          pausedRef.current = false;
          setPaused(false);
          knockoutLast = performance.now();
          knockoutQuiet = isGameQuiet();
        } else advanceKnockoutClock(performance.now(), quiet);
        if (knockoutElapsed >= KNOCKOUT_HOLD_MS && !resultShown) {
          resultShown = true;
          setResultMounted(true);
        }
      }
      cues.update(state, {
        quiet,
        introAudible: !pausedRef.current && !blockedRef.current && !dialogOpen,
      });
      const drawState =
        mode === "online"
          ? smoothRemotePlayers(state, positions, elapsed)
          : state;
      camera =
        (quiet || Boolean(state.finale)) &&
        camera &&
        cameraWidth === ctx.canvas.width &&
        cameraHeight === ctx.canvas.height
          ? camera
          : advanceArenaCamera(
              camera,
              drawState,
              ctx.canvas.width,
              ctx.canvas.height,
              elapsed,
              motionPreference.matches,
            );
      cameraWidth = ctx.canvas.width;
      cameraHeight = ctx.canvas.height;
      const audioView = cameraBounds(
        camera,
        ctx.canvas.width,
        ctx.canvas.height,
      );
      setSoundView(audioView.x, audioView.x + audioView.width);
      renderMatch(
        ctx,
        drawState,
        assets,
        now,
        motionPreference.matches,
        camera,
        knockoutElapsed,
      );
      settledFrame = finalStill
        ? {
            state,
            width: ctx.canvas.width,
            height: ctx.canvas.height,
            reducedMotion: motionPreference.matches,
          }
        : undefined;
      if (
        now - lastUI > 80 ||
        (state.phase === "finished" && !resultSent.current)
      ) {
        setView(structuredClone(state));
        lastUI = now;
      }
      if (state.phase === "finished" && !resultSent.current) {
        resultSent.current = true;
        callbacks.current.onResult(
          structuredClone(state),
          mode === "online" ? localIndex : 0,
        );
      }
      raf = requestAnimationFrame(animate);
    };
    initAudio();
    startAmbience(initial.stage);
    preloadReactions();
    const invalidateSettledFrame = () => {
      settledFrame = undefined;
      syncKnockoutPause();
    };
    // Dialogs and orientation gates can open and close between rendered frames.
    const knockoutPauseObserver = new MutationObserver(syncKnockoutPause);
    knockoutPauseObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
    document.addEventListener("visibilitychange", invalidateSettledFrame);
    window.addEventListener("blur", syncKnockoutPause);
    window.addEventListener("focus", syncKnockoutPause);
    ctx.canvas.addEventListener("contextrestored", invalidateSettledFrame);
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      knockoutPauseObserver.disconnect();
      document.removeEventListener("visibilitychange", invalidateSettledFrame);
      window.removeEventListener("blur", syncKnockoutPause);
      window.removeEventListener("focus", syncKnockoutPause);
      ctx.canvas.removeEventListener("contextrestored", invalidateSettledFrame);
      stopReactions();
      stopAmbience();
      stopFinaleMusic();
    };
  }, [assets, initial.id, mode, difficulty, remote, localIndex]);
  useEffect(() => {
    syncAmbiencePause(view.phase);
    if (paused || portraitBlocked) {
      setReactionsPaused(true);
      stopFinaleMusic();
    }
  }, [paused, portraitBlocked, view.phase]);
  useEffect(() => {
    const visibility = () => {
      syncAmbiencePause();
      if (document.hidden) {
        stopFinaleMusic();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  const touchPress = (pointer: number, control: Control) => {
    if (
      pausedRef.current ||
      blockedRef.current ||
      !focusedRef.current ||
      view.phase !== "playing" ||
      document.querySelector("dialog[open]")
    )
      return;
    initAudio();
    sources.current[0].press(`touch:${pointer}`, control);
    if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
  };
  const touchRelease = (pointer: number) => {
    sources.current[0].release(`touch:${pointer}`);
    if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
  };
  const stage = stageById(view.stage);
  const specialUnlockWins =
    fighterById(view.players[localIndex].config.fighter).specialUnlockWins ?? 0;
  const presenting = view.phase === "intro" ? introActor(view.tick) : null;
  const intro = view.phase === "intro";
  const cinematic = intro && presenting !== null;

  return (
    <main
      ref={page}
      className={`game-page page-width${intro ? " is-intro" : ""}${cinematic ? " is-cinematic" : ""}${device.touch ? " is-touch" : ""}${paused ? " is-paused" : ""}${resultReady ? " is-finished" : ""}`}
      data-phase={view.phase}
      data-result-ready={resultReady}
      data-finale={view.finale?.fighter}
    >
      {!intro && !resultReady && (
        <GameToolbar
          mode={mode}
          touch={device.touch}
          resultMounted={resultMounted}
          paused={paused}
          finished={view.phase === "finished"}
          soundEnabled={props.soundEnabled}
          onToggleSound={
            props.onToggleSound &&
            ((event) => {
              props.onToggleSound?.();
              // Pointer users return straight to play; keyboard users keep
              // the button focused for native Enter/Space activation.
              if (
                event.detail > 0 &&
                !isGameQuiet() &&
                introView.current.phase === "playing"
              )
                canvas.current?.focus({ preventScroll: true });
            })
          }
          onHelp={openHelp}
          onLandscape={requestLandscape}
          onPause={togglePause}
          onExit={props.onExit}
        />
      )}
      {!intro && fullscreenError && (
        <p className="inline-message" role="status">
          {fullscreenError}
        </p>
      )}
      <div
        className={`arena-wrap${cinematic ? " cinematic-active" : ""}`}
        ref={wrapper}
      >
        <canvas
          ref={canvas}
          tabIndex={-1}
          className="arena-canvas"
          width={ARENA_VIEW.width}
          height={ARENA_VIEW.height}
          aria-label={`Combate entre ${view.players[0].config.name} y ${view.players[1].config.name} en ${stage.location}`}
        />
        {!cinematic && view.phase !== "finished" && (
          <MatchHud view={view} location={stage.location} />
        )}
        {!assets && (
          <div className="game-overlay loading-overlay">
            <span className="spinner" />
            <h2>{assetError || "Preparando la pelea…"}</h2>
            {assetError && (
              <button className="primary-button" onClick={props.onExit}>
                Volver
              </button>
            )}
          </div>
        )}
        {assets && view.phase === "intro" && !paused && (
          <IntroOverlay
            view={view}
            presenting={presenting}
            touch={device.touch}
            onSkip={skipPresentations}
          />
        )}
        {paused && view.phase !== "finished" && (
          <PauseMenu
            ref={pauseOverlay}
            active={activeOverlay === "pause"}
            online={mode === "online"}
            soundEnabled={props.soundEnabled}
            onToggleSound={props.onToggleSound}
            onResume={togglePause}
            onHelp={openHelp}
            onLandscape={requestLandscape}
            onExit={props.onExit}
          />
        )}
        {view.phase === "finished" && resultMounted && assets && (
          <VictoryScreen
            state={view}
            mode={mode}
            localIndex={localIndex}
            active={activeOverlay === "result"}
            overlayRef={resultOverlay}
            onReady={finishResultTransition}
            rematchWaiting={props.rematchWaiting}
            onRematch={props.onRematch}
            onExit={props.onExit}
          />
        )}
      </div>
      {touchControlsAvailable && !paused && view.phase === "playing" && (
        <TouchControls
          onPress={touchPress}
          onRelease={touchRelease}
          reset={touchReset}
          energy={view.players[localIndex].energy}
          superUsed={view.players[localIndex].superUsed}
          superChargeTicks={view.players[localIndex].superChargeTicks}
          wins={view.players[localIndex].config.wins}
          specialUnlockWins={specialUnlockWins}
        />
      )}
      {!paused && (view.phase === "playing" || (intro && !device.touch)) && (
        <DesktopControlsBar
          local={mode === "local"}
          players={
            mode === "online" ? [view.players[localIndex]] : view.players
          }
          onHelp={openHelp}
        />
      )}
      {portraitBlocked && (
        <OrientationGate
          ref={orientationGate}
          online={mode === "online"}
          onLandscape={requestLandscape}
          onExit={props.onExit}
        />
      )}
    </main>
  );
}
