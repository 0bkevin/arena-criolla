// Real Web Audio rendering through the production App's activation listeners.
// Visibility changes are synthesized; this does not emulate a mobile OS.
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { App } from "../../src/App";
import * as audio from "../../src/audio";
import { setPreference } from "../../src/storage";
import { REACTION_CLIPS } from "../../src/game/reactions";
import "../../src/styles.css";
import "../../src/lobby.css";
import "../../src/arcade-theme.css";
import "../../src/mobile-game.css";
import "../../src/ui-accessibility.css";

const NativeContext = window.AudioContext;
const contexts: MonitoredContext[] = [];
class MonitoredContext extends NativeContext {
  gains: GainNode[] = [];
  sources: AudioBufferSourceNode[] = [];
  resumeCalls = 0;
  constructor() {
    super();
    contexts.push(this);
  }
  createGain() {
    const node = super.createGain();
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const source = super.createBufferSource();
    this.sources.push(source);
    return source;
  }
  resume() {
    this.resumeCalls++;
    return super.resume();
  }
}

let root: Root | undefined;
let analyser: AnalyserNode;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

export function mount() {
  setPreference("sound", true);
  window.AudioContext = MonitoredContext;
  root = createRoot(document.getElementById("fixture")!);
  flushSync(() =>
    root!.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
  // Deliberately attempt startup outside a gesture, like an online match arriving.
  audio.initAudio();
  const ctx = contexts[0];
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.gains[0].connect(analyser);
  audio.startAmbience("caracas");
}

export function state() {
  const ctx = contexts[0];
  return {
    state: ctx.state,
    currentTime: ctx.currentTime,
    contexts: contexts.length,
    resumeCalls: ctx.resumeCalls,
    loops: ctx.sources.filter((source) => source.loop).length,
  };
}

async function peak(duration = 180) {
  const data = new Float32Array(analyser.fftSize);
  let value = 0;
  const until = performance.now() + duration;
  do {
    analyser.getFloatTimeDomainData(data);
    for (const sample of data) value = Math.max(value, Math.abs(sample));
    await delay(10);
  } while (performance.now() < until);
  return value;
}

/** Run after a native click anywhere in the App unlocks its blocked context. */
export async function run() {
  const results: { scenario: string; peak?: number }[] = [];
  const ctx = contexts[0];
  const until = performance.now() + 5000;
  while (state().loops === 0 && performance.now() < until) await delay(30);
  check(ctx.state === "running", "a native App interaction must unlock audio");
  const audible = await peak();
  check(audible > 0.00001, `background music is silent: ${audible}`);
  results.push({
    scenario: "native interaction unlocks actual music output",
    peak: audible,
  });

  audio.setSound(false);
  await delay(350);
  const muted = await peak();
  check(muted < 0.000001, `mute still produces audio: ${muted}`);
  audio.setSound(true);
  await delay(100);
  check((await peak()) > 0.00001, "unmuting must restore actual output");
  results.push({
    scenario: "mute and unmute control the rendered audio",
    peak: muted,
  });

  const oldHidden = Object.getOwnPropertyDescriptor(document, "hidden");
  try {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await delay(350);
    check((await peak()) < 0.000001, "hidden pages must be silent");
    await ctx.suspend();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await delay(150);
    check(
      ctx.state === "running",
      "foreground must resume the actual audio context",
    );
    check(
      (await peak()) > 0.00001,
      "music must be audible after foreground recovery",
    );
    results.push({ scenario: "hidden silence and foreground recovery" });
  } finally {
    if (oldHidden) Object.defineProperty(document, "hidden", oldHidden);
    else Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  }

  audio.stopAmbience();
  await delay(100);
  const measuring = peak(250);
  audio.sound("hit", "zavarce", { x: 550, impact: "heavy" });
  const effect = await measuring;
  check(
    effect > 0.001,
    `combat effects must render audible samples: ${effect}`,
  );
  results.push({
    scenario: "combat effects render through the master graph",
    peak: effect,
  });
  audio.preloadReactions();
  const files = Object.values(REACTION_CLIPS).flatMap((bank) =>
    Object.values(bank).flat(),
  );
  await Promise.all(
    files.map(async (file) => {
      const response = await fetch(file);
      check(response.ok, `reaction asset is unavailable: ${file}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      check(buffer.duration > 0, `reaction asset cannot be decoded: ${file}`);
    }),
  );
  await delay(350);
  audio.setReactionsPaused(false);
  const reactionOutput = peak(400);
  audio.playReaction("hurt", "zavarce", { player: 0, x: 400 });
  audio.playReaction("hurt", "maite", { player: 1, x: 700 });
  const reactionPeak = await reactionOutput;
  check(reactionPeak > 0.001, `fighter reactions must render: ${reactionPeak}`);
  results.push({
    scenario: `all ${files.length} reaction assets decode and fighter reactions render`,
    peak: reactionPeak,
  });
  check(contexts.length === 1, "recovery must reuse a single audio context");
  check(state().loops === 1, "recovery must not create duplicate music loops");
  return { results, state: state(), userAgent: navigator.userAgent };
}

export function unmount() {
  if (root) flushSync(() => root!.unmount());
  root = undefined;
  audio.stopAmbience();
  audio.stopReactions();
  audio.stopFinaleMusic();
  audio.stopVictoryMusic();
  window.AudioContext = NativeContext;
}
