import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Expand,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { fighterById, stageById } from "../../shared/content";
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
} from "../audio";
import { victoryById, VICTORY_DURATION_MS } from "../game/victory";
import { Portrait } from "./Portrait";
import { TouchControls } from "./TouchControls";
import { enterLandscape, hasTouchInput, leaveLandscape } from "../game/mobile";
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
  const orientationGate = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const inputs = useRef(makeInputs());
  const sources = useRef<[ControlSources, ControlSources]>([
    new ControlSources(inputs.current[0]),
    new ControlSources(inputs.current[1]),
  ]);
  const keys = useRef(new Set<string>());
  const [touchReset, setTouchReset] = useState(0);
  const [device, setDevice] = useState(() => ({
    touch: hasTouchInput(),
    portrait: innerHeight > innerWidth,
  }));
  const touchControlsAvailable = device.touch || navigator.maxTouchPoints > 0;
  const portraitBlocked = device.touch && device.portrait;
  const blockedRef = useRef(portraitBlocked);
  blockedRef.current = portraitBlocked;
  const callbacks = useRef(props);
  callbacks.current = props;
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [assetError, setAssetError] = useState("");
  const [view, setView] = useState(initial);
  const [resultReady, setResultReady] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
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
    Boolean(document.querySelector("dialog[open]")) ||
    document.hidden;
  const syncAmbiencePause = (phase = introView.current.phase) =>
    setAmbiencePaused(isGameQuiet() || phase === "finished");
  const releaseInputs = () => {
    sources.current.forEach((source) => source.clear());
    keys.current.clear();
    setTouchReset((value) => value + 1);
    if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
  };
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
  useEffect(() => {
    if (!portraitBlocked) return;
    const previous = document.activeElement;
    orientationGate.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [portraitBlocked]);
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
      if (
        event.target instanceof HTMLElement &&
        event.target.matches("input, textarea, select")
      )
        return;
      if (down && document.querySelector("dialog[open]")) return;
      if (down && blockedRef.current) return;
      if (introView.current.phase === "finished") return;
      if (event.code === "Escape" && down && !event.repeat) {
        setPaused((value) => {
          pausedRef.current = !value;
          return !value;
        });
        release();
        return;
      }
      if ((pausedRef.current || blockedRef.current) && down) return;
      if (
        event.code === "Space" &&
        down &&
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
      if (down && (event.repeat || keys.current.has(event.code))) return;
      if (down) keys.current.add(event.code);
      else keys.current.delete(event.code);
      const [index, control] = mapping;
      if (down) sources.current[index].press(`key:${event.code}`, control);
      else sources.current[index].release(`key:${event.code}`);
      if (mode === "online") callbacks.current.onInput?.(inputs.current[0]);
    };
    const keyDown = (event: KeyboardEvent) => handler(event, true);
    const keyUp = (event: KeyboardEvent) => handler(event, false);
    const blur = () => {
      release();
      if (mode !== "online" && introView.current.phase !== "finished") {
        pausedRef.current = true;
        setPaused(true);
      }
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      release();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
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
    let victoryElapsed = 0;
    let victoryStarted = false;
    let finaleComplete = false;
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
    const gamepads = new GamepadControls(sources.current);
    const positions = initial.players.map((p) => ({ x: p.x, y: p.y }));
    const animate = (now: number) => {
      const elapsed = Math.min(100, now - last);
      last = now;
      const dialogOpen = Boolean(document.querySelector("dialog[open]"));
      const quiet = isGameQuiet();
      setReactionsPaused(pausedRef.current || blockedRef.current || dialogOpen);
      if (dialogOpen) sources.current.forEach((source) => source.clear());
      if (!quiet && state.phase !== "finished")
        gamepads.update(inputs.current, mode === "local" ? 2 : 1);
      if (mode === "online") {
        if (remote?.current?.id === initial.id) state = remote.current;
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
        syncVictoryMusic(
          typeof state.winner === "number"
            ? state.players[state.winner].config.fighter
            : "draw",
          victoryElapsed,
          quiet,
        );
        if (victoryElapsed >= VICTORY_DURATION_MS && !finaleComplete) {
          finaleComplete = true;
          setResultReady(true);
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
        quiet && camera
          ? camera
          : advanceArenaCamera(
              camera,
              drawState,
              ctx.canvas.width,
              ctx.canvas.height,
              elapsed,
              motionPreference.matches,
            );
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
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      stopReactions();
      stopAmbience();
      stopVictoryMusic();
    };
  }, [assets, initial.id, mode, difficulty, remote, localIndex]);
  useEffect(() => {
    syncAmbiencePause(view.phase);
    if (paused || portraitBlocked) setReactionsPaused(true);
  }, [paused, portraitBlocked, view.phase]);
  useEffect(() => {
    const visibility = () => {
      syncAmbiencePause();
      if (document.hidden) stopVictoryMusic();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  const togglePause = () => {
    releaseInputs();
    pausedRef.current = !paused;
    setPaused(!paused);
  };
  const touchPress = (pointer: number, control: Control) => {
    if (
      pausedRef.current ||
      blockedRef.current ||
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
  const localWinner = view.winner === localIndex;
  const presenting = view.phase === "intro" ? introActor(view.tick) : null;
  const intro = view.phase === "intro";
  const cinematic = intro && presenting !== null;
  const celebrating = view.phase === "finished" && !resultReady;

  return (
    <main
      className={`game-page page-width${intro ? " is-intro" : ""}${cinematic ? " is-cinematic" : ""}${device.touch ? " is-touch" : ""}${paused ? " is-paused" : ""}${celebrating ? " is-celebrating" : ""}${resultReady ? " is-finished" : ""}`}
      data-phase={view.phase}
      data-result-ready={resultReady}
    >
      {!intro && (
        <div className="game-topline">
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
                onClick={props.onToggleSound}
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
              onClick={() => {
                releaseInputs();
                props.onHelp();
              }}
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
          className="arena-canvas"
          width={ARENA_VIEW.width}
          height={ARENA_VIEW.height}
          aria-label={`Combate entre ${view.players[0].config.name} y ${view.players[1].config.name} en ${stage.name}`}
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
                    <div className="energy-track">
                      <div style={{ width: `${p.energy}%` }} />
                    </div>
                    <Zap size={12} />
                    <span>{Math.floor(p.energy)}%</span>
                  </div>
                </div>
              );
            })}
            <div className="match-clock">
              <strong>
                {Math.ceil(view.remaining / 60)
                  .toString()
                  .padStart(2, "0")}
              </strong>
              <span>2 VIDAS</span>
            </div>
          </div>
        )}
        {!cinematic && view.phase !== "finished" && (
          <span className="arena-location">
            {stage.location} <span> / </span> {stage.name}
          </span>
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
          <div className="game-overlay">
            <div className="pause-card">
              <span className="eyebrow">UN RESPIRO</span>
              <h2>{mode === "online" ? "La pelea sigue" : "Pausa, pana."}</h2>
              <p>
                {mode === "online"
                  ? "En línea el combate continúa. Vuelve antes de que tu rival aproveche."
                  : "Recarga el ánimo y vuelve a la arena."}
              </p>
              <button className="primary-button" onClick={togglePause}>
                <Play size={18} /> Continuar
              </button>
              <button className="secondary-button" onClick={props.onExit}>
                Salir del combate
              </button>
            </div>
          </div>
        )}
        {celebrating && (
          <div
            className="victory-announcement"
            role="status"
            aria-live="polite"
          >
            <span className="eyebrow">
              <Trophy size={16} aria-hidden="true" />
              {winnerDef ? "¡VICTORIA!" : "¡EMPATE!"}
            </span>
            <strong>{winnerDef?.name ?? "Quedaron tablas"}</strong>
            <span className="victory-signature">
              {winnerDef
                ? victoryById(winnerDef.id).name
                : "Una pausa antes de la revancha"}
            </span>
          </div>
        )}
        {view.phase === "finished" && resultReady && (
          <div className="game-overlay result-overlay">
            <div className="result-card">
              <div className="result-art">
                {winnerDef && <Portrait fighter={winnerDef.id} />}
              </div>
              <div className="result-info">
                <span className="eyebrow">
                  <Trophy size={14} />
                  {view.winner === "draw"
                    ? "QUEDARON TABLAS"
                    : mode === "local"
                      ? "TENEMOS GANADOR"
                      : localWinner
                        ? "LA VICTORIA ES TUYA"
                        : "ESTA SE LA LLEVÓ TU RIVAL"}
                </span>
                <h2>{winner ? `${winner.config.name} gana.` : "¡Empate!"}</h2>
                <p>
                  {winnerDef
                    ? `${winnerDef.name} se lleva la arena. ¿Vamos con la revancha?`
                    : "Nadie cedió. Esto merece otra ronda."}
                </p>
                <div className="result-stats">
                  <div>
                    <strong>{view.players[localIndex].hits}</strong>
                    <span>Golpes conectados</span>
                  </div>
                  <div>
                    <strong>{view.players[localIndex].peakCombo}</strong>
                    <span>Mejor racha</span>
                  </div>
                </div>
                {winner &&
                  (mode === "local" || localWinner) &&
                  (winner.config.wins === 0 || winner.config.wins === 2) && (
                    <div className="unlock-toast">
                      <Zap size={16} />
                      <span>
                        {winner.config.wins === 0
                          ? "Nuevo combo desbloqueado"
                          : "Definitiva desbloqueada"}{" "}
                        para {winnerDef?.shortName}
                      </span>
                    </div>
                  )}
                <button
                  className="primary-button"
                  disabled={props.rematchWaiting}
                  onClick={props.onRematch}
                >
                  <RotateCcw size={17} />
                  {props.rematchWaiting ? "Esperando a tu pana…" : "¡Revancha!"}
                </button>
                <button className="text-button" onClick={props.onExit}>
                  Volver a la selección <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
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
              wins={view.players[localIndex].config.wins}
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
              </span>
              <span>
                <kbd>U</kbd> Bloquear <kbd>⇧</kbd> Esquivar <kbd>I</kbd>{" "}
                Definitiva
              </span>
              <button
                className="text-button"
                onClick={() => {
                  releaseInputs();
                  props.onHelp();
                }}
              >
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
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button",
              ),
            ];
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
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
