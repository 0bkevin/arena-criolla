import { fighterById, type FighterId, type StageId } from "../shared/content";
import { REACTION_CLIPS, type ReactionKind } from "./game/reactions";
import { CULTURE_SOUNDS } from "./game/culture-sounds";
import { presentationById } from "../shared/presentation";
import { WORLD } from "../shared/arena";
import { TECHNIQUES } from "../shared/techniques";
import { MUSIC_SECONDS } from "./game/arcade-music";
import { VICTORY_MUSIC_MS } from "./game/victory-types";
import { victoryById } from "./game/victory";
import { preparationWorker } from "./game/preparation-worker";
import { synthesizeScore, type ScoreRequest } from "./game/music-preparation";
import { finaleById, type FinaleState } from "../shared/finales";

type SoundKind =
  | "select"
  | "hit"
  | "block"
  | "jump"
  | "swing"
  | "land"
  | "step"
  | "dash"
  | "special"
  | "ringout"
  | "win"
  | "entrance"
  | "ready";
export interface SoundOptions {
  x?: number;
  impact?: "light" | "heavy" | "special" | "super";
  strength?: number;
}
let context: AudioContext | null = null;
let masterBus: GainNode | null = null;
let effectsBus: GainNode | null = null;
let reactionsBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let pageHidden = false;
let resumeAttempt: Promise<void> | null = null;
const prepareScore = preparationWorker(
  () =>
    new Worker(new URL("./game/music.worker.ts", import.meta.url), {
      type: "module",
    }),
  synthesizeScore,
);
const scores = new Map<string, AudioBuffer>();
const pendingScores = new Map<string, Promise<void>>();
let ambienceTicket = 0;

function scoreBuffer(request: ScoreRequest): AudioBuffer | undefined {
  const key = JSON.stringify(request);
  const cached = scores.get(key);
  if (cached) {
    scores.delete(key);
    scores.set(key, cached);
    return cached;
  }
  if (!context || pendingScores.has(key)) return undefined;
  const ctx = context;
  const save = ({ left, right }: ReturnType<typeof synthesizeScore>) => {
    const buffer = ctx.createBuffer(2, request.length, request.sampleRate);
    buffer.getChannelData(0).set(left);
    buffer.getChannelData(1).set(right);
    scores.set(key, buffer);
    // Playing sources own their buffers; eviction only affects future preparation.
    while (scores.size > 12) scores.delete(scores.keys().next().value!);
  };
  const result = prepareScore(request);
  if (result instanceof Promise) {
    pendingScores.set(
      key,
      result.then(save).finally(() => pendingScores.delete(key)),
    );
    return undefined;
  }
  save(result);
  return scores.get(key);
}

/** Prepare only the selected scores; playback always uses the current scene clock. */
export async function prepareMatchAudio(fighters: FighterId[]) {
  initAudio();
  if (!context || !enabled) return;
  const sampleRate = context.sampleRate;
  scoreBuffer({
    kind: "ambience",
    sampleRate,
    length: Math.round(sampleRate * MUSIC_SECONDS),
  });
  for (const fighter of new Set(fighters)) {
    const finale = finaleById(fighter);
    if (finale)
      scoreBuffer({
        kind: "finale",
        profile: {
          duration: finale.duration,
          sound: finale.sound,
          damageBeats: finale.damageBeats,
        },
        fighter,
        sampleRate,
        length: Math.ceil((sampleRate * finale.duration) / 60),
      });
  }
  for (const fighter of new Set<FighterId | "draw">([...fighters, "draw"]))
    scoreBuffer({
      kind: "victory",
      style: fighter === "draw" ? "strings" : victoryById(fighter).music,
      fighter,
      sampleRate,
      length: Math.ceil((sampleRate * VICTORY_MUSIC_MS) / 1000),
    });
  await Promise.all(pendingScores.values());
}
let victorySource: AudioBufferSourceNode | null = null;
let victoryGain: GainNode | null = null;
let finaleSource: AudioBufferSourceNode | null = null;
let finaleGain: GainNode | null = null;
let finaleKey = "";
const MUSIC_GAIN = 0.12;
let enabled = true;
let reactionsPaused = false;
const reactions = [0, 1].map(() => ({
  source: null as AudioBufferSourceNode | null,
  ticket: 0,
  lastAt: -Infinity,
  priority: 0,
  previous: "",
}));
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let ambienceStage: StageId | null = null;
let activeAmbienceStage: StageId | null = null;
let ambienceNodes: AudioNode[] = [];
let ambienceGain: GainNode | null = null;
let ambiencePaused = false;
let soundView = { left: WORLD.left, right: WORLD.right };

export function setSoundView(left: number, right: number) {
  if (Number.isFinite(left) && Number.isFinite(right) && right > left)
    soundView = { left, right };
}

export function stopReactions() {
  for (const reaction of reactions) {
    reaction.ticket++;
    reaction.source?.stop();
    reaction.source = null;
    reaction.lastAt = -Infinity;
    reaction.priority = 0;
  }
}
export function setReactionsPaused(paused: boolean) {
  if (reactionsPaused === paused) return;
  reactionsPaused = paused;
  if (paused) stopReactions();
}
export function setSound(value: boolean) {
  enabled = value;
  if (!value) {
    stopReactions();
    stopVictoryMusic();
    stopFinaleMusic();
  } else if (context || ambienceStage) {
    initAudio(true);
    if (ambienceStage) startAmbience(ambienceStage);
  }
  if (context) {
    effectsBus?.gain.setTargetAtTime(
      value ? 0.8 : 0,
      context.currentTime,
      0.02,
    );
    reactionsBus?.gain.setTargetAtTime(
      value ? 0.7 : 0,
      context.currentTime,
      0.02,
    );
    musicBus?.gain.setTargetAtTime(
      value ? MUSIC_GAIN : 0,
      context.currentTime,
      0.02,
    );
  }
}
export function initAudio(retryResume = false) {
  if (!enabled) return;
  try {
    if (!context) {
      context = new AudioContext();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      masterBus = context.createGain();
      masterBus.gain.value = pageHidden ? 0 : 0.85;
      limiter.connect(masterBus);
      masterBus.connect(context.destination);
      effectsBus = context.createGain();
      effectsBus.gain.value = 0.8;
      effectsBus.connect(limiter);
      reactionsBus = context.createGain();
      reactionsBus.gain.value = 0.7;
      reactionsBus.connect(limiter);
      musicBus = context.createGain();
      musicBus.gain.value = MUSIC_GAIN;
      musicBus.connect(limiter);
    }
    // Mobile browsers can leave a context interrupted after a call or app switch.
    // A blocked autoplay resume may remain pending: a fresh gesture must retry it.
    if (
      !pageHidden &&
      (context.state === "suspended" || context.state === "interrupted") &&
      (!resumeAttempt || retryResume)
    ) {
      const attempt = context
        .resume()
        .catch(() => {})
        .finally(() => {
          if (resumeAttempt === attempt) resumeAttempt = null;
        });
      resumeAttempt = attempt;
    }
  } catch {}
}

/** Keep activation inside native events, including touch release on mobile Chrome. */
export function listenForAudioActivation() {
  const activate = () => {
    if (!document.hidden) initAudio(true);
  };
  const visibility = (hidden = document.hidden) => {
    pageHidden = hidden;
    if (context) {
      masterBus?.gain.setTargetAtTime(
        hidden ? 0 : 0.85,
        context.currentTime,
        0.02,
      );
      if (!hidden) initAudio(true);
    }
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
export function stopAmbience() {
  ambienceTicket++;
  for (const node of ambienceNodes) {
    try {
      if ("stop" in node) (node as AudioBufferSourceNode).stop();
      node.disconnect();
    } catch {}
  }
  ambienceNodes = [];
  ambienceGain = null;
  activeAmbienceStage = null;
  ambienceStage = null;
  soundView = { left: WORLD.left, right: WORLD.right };
}

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
  const buffer = scoreBuffer({
    kind: "finale",
    profile: finaleById(scene.fighter)
      ? {
          duration: finaleById(scene.fighter)!.duration,
          sound: finaleById(scene.fighter)!.sound,
          damageBeats: finaleById(scene.fighter)!.damageBeats,
        }
      : undefined,
    fighter: scene.fighter,
    sampleRate: context.sampleRate,
    length: Math.ceil((context.sampleRate * scene.duration) / 60),
  });
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
  const buffer = scoreBuffer({
    kind: "victory",
    style: fighter === "draw" ? "strings" : victoryById(fighter).music,
    fighter,
    sampleRate: context.sampleRate,
    length: Math.ceil((context.sampleRate * VICTORY_MUSIC_MS) / 1000),
  });
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
export function setAmbiencePaused(paused: boolean) {
  if (ambiencePaused === paused) return;
  ambiencePaused = paused;
  if (context && ambienceGain)
    ambienceGain.gain.setTargetAtTime(
      paused ? 0 : 1,
      context.currentTime,
      0.06,
    );
}
export function startAmbience(stage: StageId) {
  ambienceStage = stage;
  if (!enabled) return;
  initAudio();
  if (!context || !musicBus || activeAmbienceStage === stage) return;
  stopAmbience();
  ambienceStage = stage;
  const request: ScoreRequest = {
    kind: "ambience",
    sampleRate: context.sampleRate,
    length: Math.round(context.sampleRate * MUSIC_SECONDS),
  };
  const musicBuffer = scoreBuffer(request);
  if (!musicBuffer) {
    const ticket = ambienceTicket;
    void pendingScores.get(JSON.stringify(request))?.then(() => {
      if (ticket === ambienceTicket && ambienceStage === stage && enabled)
        startAmbience(stage);
    });
    return;
  }
  activeAmbienceStage = stage;
  const source = context.createBufferSource();
  source.buffer = musicBuffer;
  source.loop = true;
  ambienceGain = context.createGain();
  ambienceGain.gain.value = ambiencePaused ? 0 : 1;
  source.connect(ambienceGain);
  ambienceGain.connect(musicBus);
  ambienceNodes = [source, ambienceGain];
  source.start();
}
const stereoPosition = (x = 540) =>
  Math.max(
    -0.8,
    Math.min(
      0.8,
      (x - (soundView.left + soundView.right) / 2) /
        ((soundView.right - soundView.left) / 2),
    ),
  );
function loadReaction(file: string) {
  if (!context) return Promise.resolve(null);
  if (!buffers.has(file)) {
    const ctx = context;
    buffers.set(
      file,
      fetch(file)
        .then((r) => {
          if (!r.ok) throw new Error("Audio no disponible");
          return r.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          buffers.delete(file);
          return null;
        }),
    );
  }
  return buffers.get(file)!;
}
export function preloadReactions() {
  if (!enabled || !context) return;
  for (const bank of Object.values(REACTION_CLIPS))
    for (const clips of Object.values(bank))
      for (const file of clips) void loadReaction(file);
}
export function playReaction(
  kind: ReactionKind,
  fighter: FighterId,
  options: SoundOptions & { player: 0 | 1 },
) {
  if (
    !enabled ||
    pageHidden ||
    reactionsPaused ||
    !context ||
    !reactionsBus ||
    context.state !== "running"
  )
    return;
  const reaction = reactions[options.player];
  const priority = kind === "hurt" ? 2 : 1;
  const now = performance.now();
  // Damage can interrupt effort. Never stack a fighter's cries or chatter every frame.
  if (
    priority <= reaction.priority &&
    now - reaction.lastAt < (kind === "hurt" ? 140 : 230)
  )
    return;
  if (reaction.source && priority < reaction.priority) return;
  const clips =
    REACTION_CLIPS[
      [
        "maite",
        "mcm",
        "llorona",
        "sayona",
        "lionza",
        "lila",
        "rummy",
        "chiqui",
        "norkys",
        "gabriela",
        "amanda",
        "lele",
      ].includes(fighter)
        ? "female"
        : "male"
    ][kind];
  const alternatives = clips.filter((file) => file !== reaction.previous);
  const file = alternatives[Math.floor(Math.random() * alternatives.length)];
  reaction.source?.stop();
  reaction.source = null;
  const ticket = ++reaction.ticket;
  reaction.lastAt = now;
  reaction.priority = priority;
  reaction.previous = file;
  void loadReaction(file).then((buffer) => {
    if (
      !buffer ||
      ticket !== reaction.ticket ||
      !enabled ||
      pageHidden ||
      reactionsPaused ||
      !context ||
      !reactionsBus ||
      context.state !== "running" ||
      performance.now() - now > 180
    )
      return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const pan = context.createStereoPanner();
    pan.pan.value = stereoPosition(options.x);
    const envelope = context.createGain();
    const heavy = options.impact === "heavy" || options.impact === "super";
    envelope.gain.value =
      kind === "jump"
        ? 0.46
        : kind === "attack"
          ? heavy
            ? 0.65
            : 0.52
          : heavy
            ? 0.78
            : 0.65;
    source.connect(envelope);
    envelope.connect(pan);
    pan.connect(reactionsBus);
    reaction.source = source;
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
      pan.disconnect();
      if (reaction.source === source) {
        reaction.source = null;
        reaction.priority = 0;
      }
    };
    // Let the impact's transient through before its short pain response.
    source.start(context.currentTime + (kind === "hurt" ? 0.035 : 0));
  });
}
function tone(
  frequency: number,
  end: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.12,
  delay = 0,
  destination: AudioNode | null = effectsBus,
) {
  if (!context || !destination) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, end),
    start + duration,
  );
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}
function noise(
  duration: number,
  frequency: number,
  volume: number,
  band: BiquadFilterType = "bandpass",
  delay = 0,
  destination: AudioNode | null = effectsBus,
) {
  if (!context || !destination) return;
  const start = context.currentTime + delay;
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = band;
  filter.frequency.setValueAtTime(frequency, start);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(90, frequency * 0.3),
    start + duration,
  );
  filter.Q.value = 0.8;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(volume, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
}
export function sound(
  kind: SoundKind,
  fighter?: FighterId,
  options: SoundOptions = {},
) {
  if (!enabled || pageHidden || !context || context.state !== "running") return;
  const weight = fighter ? fighterById(fighter).damage : 1;
  let spatial: AudioNode | null = effectsBus;
  if (
    [
      "hit",
      "block",
      "swing",
      "land",
      "step",
      "dash",
      "jump",
      "entrance",
    ].includes(kind) &&
    context &&
    effectsBus
  ) {
    const pan = context.createStereoPanner();
    pan.pan.value = stereoPosition(options.x);
    pan.connect(effectsBus);
    spatial = pan;
    setTimeout(() => pan.disconnect(), 700);
  }
  if (kind === "entrance" && fighter) {
    const style = presentationById(fighter).introStyle;
    if (style === "strum" || style === "bass" || style === "conduct") {
      const base = style === "bass" ? 145 : style === "conduct" ? 440 : 290;
      tone(base, base * 0.94, 0.22, "triangle", 0.055, 0, spatial);
      tone(base * 1.5, base * 1.46, 0.15, "sine", 0.025, 0.1, spatial);
    } else if (
      style === "spectral" ||
      style === "ritual" ||
      style === "stalk"
    ) {
      noise(0.32, 1400, 0.035, "bandpass", 0, spatial);
      tone(190, 255, 0.26, "sine", 0.025, 0, spatial);
    } else if (
      style === "phone" ||
      style === "card" ||
      style === "inspect" ||
      style === "broadcast"
    ) {
      tone(740, 740, 0.06, "sine", 0.04, 0, spatial);
      tone(990, 990, 0.09, "sine", 0.025, 0.09, spatial);
    } else {
      noise(0.13, 2500, 0.035, "bandpass", 0, spatial);
      tone(
        style === "hop" ? 540 : 330,
        460,
        0.11,
        "triangle",
        0.025,
        0.04,
        spatial,
      );
    }
  } else if (kind === "ready") {
    const final = (options.strength ?? 1) > 1;
    tone(
      final ? 740 : 510,
      final ? 1040 : 510,
      final ? 0.18 : 0.075,
      "triangle",
      final ? 0.055 : 0.035,
    );
  } else if (kind === "select") {
    tone(620, 920, 0.08, "sine", 0.055);
    tone(1240, 1320, 0.08, "sine", 0.025, 0.03);
  } else if (kind === "hit") {
    const heavy = options.impact === "heavy" || options.impact === "super";
    const power = Math.min(
      1.6,
      (options.strength ?? (heavy ? 1.3 : 0.85)) * weight,
    );
    // Blend the original low punch and short crack with the softer new release.
    tone(
      heavy ? 115 : 175,
      heavy ? 40 : 55,
      heavy ? 0.2 : 0.13,
      "triangle",
      0.21 * power,
      0,
      spatial,
    );
    tone(heavy ? 240 : 360, 85, 0.105, "sine", 0.075 * power, 0.006, spatial);
    noise(heavy ? 0.12 : 0.065, 1400, 0.15 * power, "bandpass", 0, spatial);
    noise(0.018, 3400, 0.045 * power, "highpass", 0, spatial);
    if (heavy) {
      noise(0.1, 400, 0.06 * power, "lowpass", 0.015, spatial);
      tone(80, 38, 0.18, "sine", 0.07 * power, 0.018, spatial);
    }
  } else if (kind === "block") {
    tone(760, 540, 0.11, "triangle", 0.1, 0, spatial);
    tone(1480, 1120, 0.07, "sine", 0.04, 0.012, spatial);
    noise(0.035, 2400, 0.05, "bandpass", 0, spatial);
  } else if (kind === "swing") {
    const heavy = options.impact === "heavy";
    noise(
      heavy ? 0.15 : 0.095,
      heavy ? 1700 : 2400,
      heavy ? 0.08 : 0.05,
      "bandpass",
      0,
      spatial,
    );
    tone(heavy ? 190 : 260, 100, 0.1, "sine", 0.025, 0, spatial);
  } else if (kind === "land") {
    tone(110, 42, 0.095, "sine", 0.065, 0, spatial);
    noise(0.05, 800, 0.04, "lowpass", 0, spatial);
  } else if (kind === "step") {
    tone(100, 70, 0.04, "sine", 0.018, 0, spatial);
    noise(0.025, 700, 0.015, "lowpass", 0, spatial);
  } else if (kind === "dash") {
    tone(180, 100, 0.1, "sine", 0.022, 0, spatial);
    noise(0.1, 1600, 0.055, "bandpass", 0, spatial);
  } else if (kind === "jump") {
    tone(210, 340, 0.11, "sine", 0.035, 0, spatial);
    noise(0.08, 1200, 0.04, "bandpass", 0, spatial);
  } else if (kind === "ringout") {
    tone(240, 72, 0.28, "triangle", 0.05);
    noise(0.16, 1100, 0.05, "bandpass");
  } else if (kind === "win") {
    [392, 494, 587, 784].forEach((f, i) =>
      tone(f, f, 0.36, "triangle", 0.08, i * 0.115),
    );
    tone(1174, 1568, 0.55, "sine", 0.035, 0.3);
  } else {
    const ability = fighter ? fighterById(fighter).ability : "broadcast";
    const cultureSound = CULTURE_SOUNDS[ability];
    if (cultureSound) {
      cultureSound.notes.forEach((frequency, index) =>
        tone(
          frequency,
          frequency * cultureSound.sweep,
          cultureSound.duration,
          cultureSound.wave,
          cultureSound.wave === "square" ? 0.025 : 0.055,
          index * cultureSound.spacing,
          spatial,
        ),
      );
      noise(0.16, cultureSound.noise, 0.05, cultureSound.filter, 0, spatial);
    } else if (ability === "whistle") {
      [880, 988, 1175, 1319].forEach((frequency, index) =>
        tone(
          frequency,
          frequency * 1.03,
          0.12,
          "sine",
          0.045,
          index * 0.075,
          spatial,
        ),
      );
      noise(0.2, 4600, 0.035, "bandpass", 0, spatial);
    } else if (ability === "undertow") {
      noise(0.42, 1150, 0.11, "lowpass", 0, spatial);
      [0, 0.09, 0.18].forEach((delay) =>
        tone(460, 180, 0.18, "sine", 0.04, delay, spatial),
      );
    } else if (ability === "haunt") {
      noise(0.24, 3600, 0.07, "highpass", 0, spatial);
      tone(740, 170, 0.3, "sine", 0.06, 0, spatial);
      tone(170, 740, 0.16, "sine", 0.04, 0.16, spatial);
    } else if (ability === "wildspirit") {
      [0, 0.1, 0.2, 0.3].forEach((delay) => {
        tone(125, 55, 0.1, "triangle", 0.1, delay, spatial);
        noise(0.09, 700, 0.06, "lowpass", delay, spatial);
      });
    } else if (ability === "verse") {
      [330, 440, 554, 660].forEach((frequency, index) =>
        tone(
          frequency,
          frequency * 0.99,
          0.19,
          "triangle",
          0.06,
          index * 0.055,
          spatial,
        ),
      );
    } else if (ability === "hellfire") {
      noise(0.45, 850, 0.13, "lowpass", 0, spatial);
      tone(170, 48, 0.4, "sawtooth", 0.045, 0, spatial);
      noise(0.19, 2800, 0.07, "bandpass", 0.15, spatial);
    } else if (ability === "elixir") {
      [1320, 1760, 2093].forEach((frequency, index) =>
        tone(
          frequency,
          frequency * 0.94,
          0.12,
          "sine",
          0.035,
          index * 0.04,
          spatial,
        ),
      );
      noise(0.1, 5800, 0.04, "highpass", 0.12, spatial);
    } else if (ability === "roots") {
      noise(0.33, 900, 0.095, "bandpass", 0, spatial);
      tone(160, 70, 0.26, "triangle", 0.075, 0, spatial);
    } else if (ability === "pounce") {
      noise(0.25, 2300, 0.1, "bandpass", 0, spatial);
      tone(140, 65, 0.24, "sawtooth", 0.04, 0, spatial);
      noise(0.14, 3200, 0.08, "highpass", 0.22, spatial);
    } else if (ability === "trickster") {
      tone(180, 850, 0.19, "triangle", 0.075, 0, spatial);
      tone(640, 270, 0.16, "sine", 0.06, 0.14, spatial);
      noise(0.12, 3000, 0.04, "bandpass", 0.1, spatial);
    } else if (ability === "broadcast") {
      [180, 240, 300].forEach((f, i) =>
        tone(f, f * 1.8, 0.36, "triangle", 0.09, i * 0.055),
      );
      noise(0.19, 950, 0.08);
      tone(880, 880, 0.07, "sine", 0.09, 0.26);
      noise(0.11, 6200, 0.07, "highpass", 0.32);
    } else if (ability === "courier") {
      // Layer the engines of the compact formation, all summoned on the same tick.
      const technique = TECHNIQUES.courier;
      Array.from(
        { length: technique.projectile?.count ?? 1 },
        (_, index) => index,
      ).forEach((index) => {
        const delay = technique.startup / 60 + index * 0.025;
        tone(85, 230, 0.2, "sawtooth", 0.035, delay, spatial);
        tone(170, 380, 0.16, "triangle", 0.04, delay, spatial);
        noise(0.15, 800, 0.035, "lowpass", delay, spatial);
      });
    } else if (ability === "installments") {
      [660, 880, 1100].forEach((frequency, index) =>
        tone(frequency, frequency, 0.09, "sine", 0.08, index / 6),
      );
      noise(0.11, 3800, 0.045, "highpass");
    } else if (ability === "spin") {
      tone(160, 800, 0.26, "triangle", 0.12);
      noise(0.29, 3800, 0.14);
      tone(940, 740, 0.17, "sine", 0.08, 0.23);
    } else if (ability === "command" || ability === "whirl") {
      tone(ability === "command" ? 90 : 150, 42, 0.36, "triangle", 0.19);
      noise(0.26, ability === "command" ? 750 : 2000, 0.15);
    } else if (ability === "cuatro" || ability === "salsa") {
      const notes =
        ability === "cuatro" ? [294, 370, 440, 587] : [392, 523, 659];
      notes.forEach((frequency, index) =>
        tone(
          frequency,
          frequency * 0.995,
          0.17,
          "triangle",
          0.075,
          index * 0.06,
        ),
      );
      noise(0.09, 4500, 0.09, "highpass");
    } else if (ability === "echo" || ability === "punchline") {
      [0, 0.27].forEach((delay, index) => {
        tone(index ? 190 : 310, 95, 0.17, "triangle", 0.095, delay);
        noise(0.12, ability === "echo" ? 2400 : 1400, 0.08, "bandpass", delay);
      });
    } else if (ability === "spotlight") {
      if (options.impact === "super") {
        // Original resonant pressure sweep; no sampled voice or recording.
        [180, 360, 720].forEach((frequency, index) =>
          tone(
            frequency,
            frequency * 0.55,
            0.72,
            "triangle",
            0.065 / (index + 1),
            index * 0.025,
            spatial,
          ),
        );
        noise(0.5, 1150, 0.12, "bandpass", 0, spatial);
        tone(110, 52, 0.42, "sine", 0.09, 0.03, spatial);
      } else {
        tone(570, 1800, 0.25, "sine", 0.07);
        tone(1350, 920, 0.26, "triangle", 0.055, 0.17);
        noise(0.07, 7200, 0.09, "highpass", 0.22);
      }
    } else if (ability === "roar") {
      [110, 165, 220].forEach((frequency) =>
        tone(frequency, 50, 0.42, "sawtooth", 0.035),
      );
      noise(0.35, 680, 0.11);
    } else if (ability === "static") {
      tone(630, 230, 0.25, "square", 0.035);
      noise(0.22, 5400, 0.09, "highpass");
      tone(240, 740, 0.18, "sine", 0.05, 0.4);
    } else {
      noise(0.32, 3000, 0.14);
      tone(350, 1100, 0.3, "triangle", 0.075);
      [0.02, 0.13, 0.24].forEach((delay) =>
        tone(125, 65, 0.075, "sine", 0.1, delay),
      );
    }
  }
}
