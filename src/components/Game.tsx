import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Expand,
  Heart,
  Pause,
  Play,
  SkipForward,
  Smartphone,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  fighterById,
  stageById,
  SUPER_CHARGE_SECONDS_LABEL,
} from "../../shared/content";
import { INTRO_COUNTDOWN_START, introActor } from "../../shared/presentation";
import {
  cpuInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../../shared/engine";
import { preloadAssets } from "../game/assets";
import { renderMatch, type Assets } from "../game/renderer";
import {
  applyControl,
  ControlSources,
  GamepadControls,
  KEY_MAP,
  makeInputs,
  type Control,
} from "../game/controls";
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
  syncVictoryMusic,
  stopVictoryMusic,
  syncFinaleMusic,
  stopFinaleMusic,
} from "../audio";
import { VICTORY_DURATION_MS } from "../game/victory";
import { Portrait } from "./Portrait";
import { VictoryScreen } from "./VictoryScreen";
import { VenezuelaStars } from "./CriolloArt";
import { TouchControls } from "./TouchControls";
import { SuperMeter } from "./SuperMeter";
import {
  enterLandscape,
  hasTouchInput,
  leaveLandscape,
  trackHybridGameChrome,
  trackPlayViewport,
} from "../game/mobile";
import { arenaCanvasSize } from "../game/viewport";
import { ARENA_VIEW } from "../../shared/arena";
import {
  advanceArenaCamera,
  cameraBounds,
  type ArenaCamera,
} from "../game/arena-camera";

export type GameMode = "practice" | "local" | "online";
interface Props {
  initial: MatchState;
  mode: GameMode;
  difficulty: "easy" | "normal" | "hard";
  remote?: MutableRefObject<MatchState | null>;
  localIndex?: number;
  onInput?: (input: Input) => void;
  onExit: () => void;
  onResult: (state: MatchState, index: number) => void;
  onRematch: () => void;
  rematchWaiting?: boolean;
  onHelp: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export function Game(props: Props) {
  const { initial, mode, difficulty, remote, localIndex = 0 } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const page = useRef<HTMLElement>(null);
  const orientationGate = useRef<HTMLDivElement>(null);
  const pauseOverlay = useRef<HTMLDivElement>(null);
  const resultOverlay = useRef<HTMLDivElement>(null);
  const victoryTitle = useRef<HTMLHeadingElement>(null);
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
  const [victorySkipped, setVictorySkipped] = useState(false);
  const victorySkippedRef = useRef(false);
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
    if (
      !device.touch &&
      touchControlsAvailable &&
      !paused &&
      view.phase === "playing" &&
      page.current
    )
      return trackHybridGameChrome(page.current);
  }, [device.touch, touchControlsAvailable, paused, view.phase]);
  useEffect(() => {
    if (device.touch && page.current) return trackPlayViewport(page.current);
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
  useEffect(() => {
    const overlay =
      activeOverlay === "orientation"
        ? orientationGate.current
        : activeOverlay === "pause"
          ? pauseOverlay.current
          : activeOverlay === "result"
            ? resultOverlay.current
            : null;
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
  const skipVictory = () => {
    if (view.phase !== "finished" || !assets || victorySkippedRef.current)
      return;
    victorySkippedRef.current = true;
    stopVictoryMusic();
    setVictorySkipped(true);
    setResultMounted(true);
  };
  useEffect(() => {
    let alive = true;
    void prepareMatchAudio(
      initial.players.map((player) => player.config.fighter),
    );
    void preloadAssets(
      initial.players.map((player) => player.config.fighter),
      [initial.stage],
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

  useEffect(() => {
    if (!assets || !canvas.current) return;
    const ctx = canvas.current.getContext("2d")!;
    let state = structuredClone(initial);
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let lastUI = 0;
    let lastSend = 0;
    let lastEffect = -1;
    let camera: ArenaCamera | undefined;
    let cameraWidth = ctx.canvas.width;
    let cameraHeight = ctx.canvas.height;
    let victoryElapsed = 0;
    let victoryStarted = false;
    let finaleComplete = false;
    let settledFrame:
      | {
          state: MatchState;
          width: number;
          height: number;
          reducedMotion: boolean;
        }
      | undefined;
    const playedIntroductions = new Set<number>();
    let lastCountdown = -1;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const specialAttacks = [-1, -1];
    const swungAttacks = [-1, -1];
    const groundedStates = initial.players.map((p) => p.grounded);
    const jumpCounts = initial.players.map((p) => p.jumps);
    const dashStates = initial.players.map((p) => p.dash > 0);
    const footsteps = initial.players.map((p) => ({
      tick: initial.tick,
      x: p.x,
    }));
    const positions = initial.players.map((p) => ({ x: p.x, y: p.y }));
    const animate = (now: number) => {
      const elapsed = Math.min(100, now - last);
      last = now;
      if (mode === "online" && remote?.current?.id === initial.id)
        state = remote.current;
      const finalStill =
        state.phase === "finished" &&
        victoryElapsed >= VICTORY_DURATION_MS &&
        (motionPreference.matches || state.shake <= 0.3);
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
        if (!victoryStarted) {
          victoryStarted = true;
          releaseInputs();
          stopReactions();
          pausedRef.current = false;
          setPaused(false);
        } else if (!quiet) {
          victoryElapsed = Math.min(
            VICTORY_DURATION_MS,
            victoryElapsed + elapsed,
          );
        }
        if (victorySkippedRef.current) {
          victoryElapsed = VICTORY_DURATION_MS;
        } else {
          syncVictoryMusic(
            typeof state.winner === "number"
              ? state.players[state.winner].config.fighter
              : "draw",
            victoryElapsed,
            quiet,
          );
        }
        if (victoryElapsed >= VICTORY_DURATION_MS && !finaleComplete) {
          finaleComplete = true;
          setResultMounted(true);
        }
      }
      if (
        state.phase === "intro" &&
        !pausedRef.current &&
        !blockedRef.current &&
        !dialogOpen
      ) {
        const actor = introActor(state.tick);
        if (actor !== null && !playedIntroductions.has(actor)) {
          playedIntroductions.add(actor);
          sound("entrance", state.players[actor].config.fighter, {
            x: state.players[actor].x,
          });
        } else if (actor === null) {
          const beat = Math.min(
            3,
            Math.floor((state.tick - INTRO_COUNTDOWN_START) / 40),
          );
          if (beat > lastCountdown) {
            sound("ready", undefined, { strength: beat === 3 ? 1.5 : 1 });
            lastCountdown = beat;
          }
        }
      }
      for (const effect of state.effects) {
        if (effect.id <= lastEffect) continue;
        const actor =
          effect.owner !== undefined
            ? state.players[effect.owner]
            : (state.players.find(
                (p) => fighterById(p.config.fighter).color === effect.color,
              ) ??
              state.players.reduce((a, b) =>
                Math.abs(a.x - effect.x) < Math.abs(b.x - effect.x) ? a : b,
              ));
        sound(
          effect.kind === "ringout"
            ? "ringout"
            : effect.kind === "special"
              ? "special"
              : effect.kind === "block"
                ? "block"
                : "hit",
          actor.config.fighter,
          { x: effect.x, impact: effect.impact, strength: effect.strength },
        );
        if (
          effect.owner !== undefined &&
          (effect.kind === "hit" || effect.kind === "ringout")
        ) {
          // Hit effects belong to the attacker; ringout effects belong to the victim.
          const victim = (
            effect.kind === "ringout" ? effect.owner : 1 - effect.owner
          ) as 0 | 1;
          const target = state.players[victim];
          playReaction("hurt", target.config.fighter, {
            player: victim,
            x: effect.x,
            impact: effect.kind === "ringout" ? "heavy" : effect.impact,
          });
        }
        lastEffect = effect.id;
      }
      state.players.forEach((p, i) => {
        const dash = p.dash > 0;
        if (!quiet && state.phase === "playing") {
          if (dash && !dashStates[i])
            sound("dash", p.config.fighter, { x: p.x });
          const step = footsteps[i];
          if (
            p.grounded &&
            !p.stun &&
            !p.attack &&
            !dash &&
            Math.abs(p.vx) > 1 &&
            state.tick - step.tick >= 16 &&
            Math.abs(p.x - step.x) >= 32
          ) {
            sound("step", p.config.fighter, { x: p.x });
            step.tick = state.tick;
            step.x = p.x;
          }
        }
        dashStates[i] = dash;
        if (p.grounded && !groundedStates[i] && state.phase === "playing")
          sound("land", p.config.fighter, { x: p.x });
        groundedStates[i] = p.grounded;
        if (
          (p.attack === "light" || p.attack === "heavy") &&
          p.attackTick < 4
        ) {
          const startedAt = state.tick - p.attackTick;
          if (startedAt > swungAttacks[i]) {
            swungAttacks[i] = startedAt;
            sound("swing", p.config.fighter, { x: p.x, impact: p.attack });
            playReaction("attack", p.config.fighter, {
              player: i as 0 | 1,
              x: p.x,
              impact: p.attack,
            });
          }
        }
        if (p.jumps > jumpCounts[i] && p.vy < 0) {
          sound("jump", p.config.fighter, { x: p.x });
          playReaction("jump", p.config.fighter, {
            player: i as 0 | 1,
            x: p.x,
          });
        }
        jumpCounts[i] = p.jumps;
        if (
          (p.attack === "special" || p.attack === "super") &&
          p.attackTick < 8
        ) {
          const startedAt = state.tick - p.attackTick;
          if (startedAt > specialAttacks[i]) {
            specialAttacks[i] = startedAt;
            playReaction("attack", p.config.fighter, {
              player: i as 0 | 1,
              x: p.x,
              impact: p.attack,
            });
          }
        }
      });
      const drawState =
        mode === "online"
          ? {
              ...state,
              players: state.players.map((p, i) => {
                const position = positions[i];
                const blend =
                  Math.abs(position.x - p.x) > 260 ||
                  Math.abs(position.y - p.y) > 260
                    ? 1
                    : 1 - Math.exp(-elapsed / 24);
                position.x += (p.x - position.x) * blend;
                position.y += (p.y - position.y) * blend;
                return { ...p, x: position.x, y: position.y };
              }) as MatchState["players"],
            }
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
        victoryElapsed,
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
    };
    document.addEventListener("visibilitychange", invalidateSettledFrame);
    ctx.canvas.addEventListener("contextrestored", invalidateSettledFrame);
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", invalidateSettledFrame);
      ctx.canvas.removeEventListener("contextrestored", invalidateSettledFrame);
      stopReactions();
      stopAmbience();
      stopVictoryMusic();
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
        stopVictoryMusic();
        stopFinaleMusic();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  const togglePause = () => {
    // Start remains available through ordinary pause/resume transitions.
    releaseInputs(true);
    pausedRef.current = !pausedRef.current;
    if (!pausedRef.current)
      gamepads.current.resume(inputs.current, mode === "local" ? 2 : 1);
    setPaused(pausedRef.current);
  };
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
  const winner =
    typeof view.winner === "number" ? view.players[view.winner] : null;
  const winnerDef = winner ? fighterById(winner.config.fighter) : null;
  const specialUnlockWins =
    fighterById(view.players[localIndex].config.fighter).specialUnlockWins ?? 0;
  const presenting = view.phase === "intro" ? introActor(view.tick) : null;
  const intro = view.phase === "intro";
  const cinematic = intro && presenting !== null;
  const celebrating = view.phase === "finished" && !resultReady;

  return (
    <main
      ref={page}
      className={`game-page page-width${intro ? " is-intro" : ""}${cinematic ? " is-cinematic" : ""}${device.touch ? " is-touch" : ""}${paused ? " is-paused" : ""}${celebrating ? " is-celebrating" : ""}${resultReady ? " is-finished" : ""}`}
      data-phase={view.phase}
      data-result-ready={resultReady}
      data-finale={view.finale?.fighter}
    >
      {celebrating && assets && !portraitBlocked && (
        <button className="victory-skip" onClick={skipVictory}>
          Saltar animación <SkipForward size={16} aria-hidden="true" />
        </button>
      )}
      {!intro && !resultReady && (
        <div
          className="game-topline"
          inert={resultMounted}
          style={resultMounted ? { visibility: "hidden" } : undefined}
        >
          <button
            className="text-button"
            aria-label="Volver a la selección"
            onClick={props.onExit}
          >
            <ArrowLeft size={16} />{" "}
            {device.touch ? "Selección" : "Volver a la selección"}
          </button>
          <span className="game-mode">
            <span className="live-dot" />
            {mode === "online"
              ? "MULTIJUGADOR EN LÍNEA"
              : mode === "local"
                ? "VERSUS LOCAL"
                : "COMBATE CONTRA LA CPU"}
          </span>
          <div className="game-tools">
            {props.onToggleSound && (
              <button
                className="icon-button"
                aria-label={
                  props.soundEnabled ? "Silenciar sonido" : "Activar sonido"
                }
                aria-pressed={props.soundEnabled}
                onClick={(event) => {
                  props.onToggleSound?.();
                  // Pointer users return straight to play; keyboard users keep
                  // the button focused for native Enter/Space activation.
                  if (
                    event.detail > 0 &&
                    !isGameQuiet() &&
                    introView.current.phase === "playing"
                  )
                    canvas.current?.focus({ preventScroll: true });
                }}
              >
                {props.soundEnabled ? (
                  <Volume2 size={19} />
                ) : (
                  <VolumeX size={19} />
                )}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Ver controles"
              onClick={openHelp}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Pantalla completa"
              onClick={requestLandscape}
            >
              <Expand size={18} />
            </button>
            <button
              className="icon-button"
              aria-label={paused ? "Continuar pelea" : "Pausar"}
              aria-pressed={paused}
              disabled={view.phase === "finished"}
              onClick={togglePause}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>
        </div>
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
          <div className="match-hud">
            {view.players.map((p, i) => {
              const def = fighterById(p.config.fighter);
              return (
                <div
                  key={i}
                  className={`player-hud player-${i}`}
                  style={
                    { "--fighter-color": def.color } as React.CSSProperties
                  }
                >
                  <div className="hud-label">
                    <span className="player-number">P{i + 1}</span>
                    <strong>{p.config.name}</strong>
                    <span className="hud-character">{def.shortName}</span>
                  </div>
                  <div className="health-track">
                    <div style={{ width: `${p.hp}%` }} />
                    <span>{Math.ceil(p.hp)}</span>
                  </div>
                  <div className="hud-bottom">
                    <div className="stock-hearts">
                      {[0, 1].map((stock) => (
                        <Heart
                          size={13}
                          key={stock}
                          className={stock < p.stocks ? "alive" : ""}
                          fill={stock < p.stocks ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    <SuperMeter player={p} tick={view.tick} />
                    <Zap size={12} />
                    <span>{Math.floor(p.energy)}%</span>
                  </div>
                </div>
              );
            })}
            <div className="match-clock">
              <strong
                className={
                  view.remaining > 99 * 60 ? "match-clock-minutes" : undefined
                }
              >
                {view.remaining > 99 * 60
                  ? "2 min"
                  : Math.ceil(view.remaining / 60)
                      .toString()
                      .padStart(2, "0")}
              </strong>
            </div>
          </div>
        )}
        {!cinematic && view.phase !== "finished" && (
          <span className="arena-location">{stage.location}</span>
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
        {assets &&
          view.phase === "intro" &&
          !paused &&
          (cinematic ? (
            <div className="cinematic-overlay">
              {view.players.map((player, side) => {
                const def = fighterById(player.config.fighter);
                return (
                  <div
                    key={side}
                    className={`cinematic-name cinematic-name-${side}${presenting === side ? " is-presenting" : ""}`}
                  >
                    <strong>{def.name}</strong>
                  </div>
                );
              })}
              <button
                className="skip-entrances"
                aria-label="Saltar presentaciones"
                aria-keyshortcuts="Space"
                onClick={skipPresentations}
              >
                Saltar <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="countdown-overlay">
              <strong>
                {view.tick - INTRO_COUNTDOWN_START < 120
                  ? Math.max(
                      1,
                      3 - Math.floor((view.tick - INTRO_COUNTDOWN_START) / 40),
                    )
                  : "¡DALE!"}
              </strong>
            </div>
          ))}
        {paused && view.phase !== "finished" && (
          <div
            ref={pauseOverlay}
            className="game-overlay"
            role="dialog"
            aria-modal={activeOverlay === "pause"}
            aria-hidden={activeOverlay !== "pause"}
            aria-labelledby="pause-title"
          >
            <div className="pause-card">
              <h2 id="pause-title">
                {mode === "online" ? "La pelea sigue" : "Pausa"}
              </h2>
              {mode === "online" && (
                <p>El combate continúa mientras estás en el menú.</p>
              )}
              <button className="primary-button" onClick={togglePause}>
                <Play size={18} /> Continuar
              </button>
              <div className="pause-tools">
                {props.onToggleSound && (
                  <button
                    className="secondary-button"
                    aria-label={
                      props.soundEnabled ? "Silenciar sonido" : "Activar sonido"
                    }
                    aria-pressed={props.soundEnabled}
                    onClick={props.onToggleSound}
                  >
                    {props.soundEnabled ? (
                      <Volume2 size={18} />
                    ) : (
                      <VolumeX size={18} />
                    )}
                    Sonido
                  </button>
                )}
                <button
                  className="secondary-button"
                  aria-label="Ver controles"
                  onClick={openHelp}
                >
                  <CircleHelp size={18} /> Controles
                </button>
                <button
                  className="secondary-button"
                  aria-label="Pantalla completa"
                  onClick={requestLandscape}
                >
                  <Expand size={18} /> Pantalla completa
                </button>
              </div>
              <button className="secondary-button" onClick={props.onExit}>
                Salir del combate
              </button>
            </div>
          </div>
        )}
        {celebrating && (
          <div
            className="victory-announcement"
            data-winner={view.winner ?? "draw"}
            style={resultMounted ? { visibility: "hidden" } : undefined}
            role="status"
            aria-live="polite"
          >
            <h2 ref={victoryTitle}>
              {winnerDef && <span>{winnerDef.shortName} </span>}
              <strong>{winnerDef ? "ganó." : "tablas"}</strong>
            </h2>
            <VenezuelaStars className="victory-announcement-stars" />
          </div>
        )}
        {view.phase === "finished" && resultMounted && assets && (
          <VictoryScreen
            state={view}
            mode={mode}
            localIndex={localIndex}
            active={activeOverlay === "result"}
            overlayRef={resultOverlay}
            sourceCanvas={canvas}
            sourceTitle={victoryTitle}
            assets={assets}
            onReady={finishResultTransition}
            skipTransition={victorySkipped}
            rematchWaiting={props.rematchWaiting}
            onRematch={props.onRematch}
            onExit={props.onExit}
          />
        )}
      </div>
      {!intro && (
        <>
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
          {!paused && view.phase === "playing" && (
            <div className="game-controls-bar">
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> Mover <kbd>W</kbd> Saltar
              </span>
              <span>
                <kbd>J</kbd> Ligero <kbd>K</kbd> Fuerte <kbd>L</kbd> Especial
                {view.players[localIndex].config.wins < specialUnlockWins &&
                  ` (${specialUnlockWins} victorias)`}
              </span>
              <span>
                <kbd>U</kbd> Bloquear <kbd>⇧</kbd> Esquivar <kbd>I</kbd>{" "}
                Definitiva (
                {view.players[localIndex].superUsed
                  ? "usada"
                  : `mantén ${SUPER_CHARGE_SECONDS_LABEL} s`}
                )
              </span>
              <button className="text-button" onClick={openHelp}>
                Todos los controles <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
      {portraitBlocked && (
        <div
          ref={orientationGate}
          className="orientation-gate"
          role="dialog"
          aria-modal="true"
          aria-label="Jugar en horizontal"
        >
          <div className="orientation-card">
            <Smartphone size={48} aria-hidden="true" />
            <h2>Gira tu teléfono</h2>
            <p>
              {mode === "online"
                ? "Tu rival sigue en la arena. Gira el teléfono para volver al pique."
                : "La arena se juega en horizontal. Tu pelea te espera."}
            </p>
            <button className="primary-button" onClick={requestLandscape}>
              <Expand size={18} /> Jugar en horizontal
            </button>
            <button className="text-button" onClick={props.onExit}>
              Volver a la selección
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
