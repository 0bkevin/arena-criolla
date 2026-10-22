import test from "node:test";
import assert from "node:assert/strict";
import { MUSIC_SECONDS, writeArcadeMusic } from "../src/game/arcade-music";
import { writeVictoryMusic } from "../src/game/victory-music";
import { VICTORY_MUSIC_MS } from "../src/game/victory-types";
import type { FinaleState } from "../shared/finales";

test("original arcade music stays quiet, finite and continuous at the loop seam", () => {
  for (const rate of [22050, 48000]) {
    const channels = [
      new Float32Array(Math.round(rate * MUSIC_SECONDS)),
      new Float32Array(Math.round(rate * MUSIC_SECONDS)),
    ];
    writeArcadeMusic(channels[0], channels[1], rate);
    for (const samples of channels) {
      let peak = 0,
        squareSum = 0,
        maxStep = 0;
      for (let i = 0; i < samples.length; i++) {
        assert.ok(Number.isFinite(samples[i]));
        peak = Math.max(peak, Math.abs(samples[i]));
        squareSum += samples[i] ** 2;
        maxStep = Math.max(
          maxStep,
          Math.abs(
            samples[i] - samples[(i + samples.length - 1) % samples.length],
          ),
        );
      }
      const rms = Math.sqrt(squareSum / samples.length);
      assert.ok(peak < 0.5 && peak > 0.04, `peak=${peak}`);
      assert.ok(rms > 0.005 && rms < 0.08, `rms=${rms}`);
      assert.ok(maxStep < 0.06, `discontinuity=${maxStep}`);
      assert.ok(
        Math.abs(samples[0] - samples.at(-1)!) < 0.005,
        "loop must not click",
      );
    }
    assert.notDeepEqual(
      channels[0],
      channels[1],
      "cuatro strings have a gentle stereo spread",
    );
  }
});

test("music mute, pause, stage changes and cleanup never stack background loops", async () => {
  class Param {
    value = 0;
    setTargetAtTime(value: number) {
      this.value = value;
    }
    setValueAtTime(value: number) {
      this.value = value;
    }
    exponentialRampToValueAtTime(value: number) {
      this.value = value;
    }
  }
  class Node {
    gain = new Param();
    pan = new Param();
    frequency = new Param();
    Q = new Param();
    threshold = new Param();
    knee = new Param();
    ratio = new Param();
    attack = new Param();
    release = new Param();
    buffer: unknown;
    loop = false;
    started = false;
    stopped = false;
    destination: Node | undefined;
    offset = 0;
    connect(node: Node) {
      this.destination = node;
    }
    disconnect() {
      this.destination = undefined;
    }
    start(_when = 0, offset = 0) {
      this.started = true;
      this.offset = offset;
    }
    stop() {
      this.stopped = true;
    }
  }
  const sources: Node[] = [];
  const gains: Node[] = [];
  const pans: Node[] = [];
  class Context {
    currentTime = 0;
    state = "running";
    sampleRate = 8000;
    destination = new Node();
    createDynamicsCompressor() {
      return new Node();
    }
    createGain() {
      const node = new Node();
      gains.push(node);
      return node;
    }
    createBufferSource() {
      const node = new Node();
      sources.push(node);
      return node;
    }
    createBuffer(channels: number, length: number) {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return { getChannelData: (channel: number) => data[channel] };
    }
    createOscillator() {
      return new Node();
    }
    createBiquadFilter() {
      return new Node();
    }
    createStereoPanner() {
      const node = new Node();
      pans.push(node);
      return node;
    }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: Context,
  });
  const audio = await import("../src/audio");
  try {
    audio.startAmbience("caracas");
    const first = sources[0];
    const envelope = first.destination!;
    const musicBus = envelope.destination!;
    assert.equal(first.loop, true);
    assert.equal(first.started, true);
    audio.startAmbience("caracas");
    assert.equal(sources.length, 1);
    audio.setAmbiencePaused(true);
    assert.equal(envelope.gain.value, 0);
    audio.setSound(false);
    assert.equal(musicBus.gain.value, 0);
    audio.setSound(true);
    assert.ok(musicBus.gain.value > 0);
    assert.equal(envelope.gain.value, 0, "unmuting must respect pause");
    assert.equal(sources.length, 1);
    audio.setAmbiencePaused(false);
    assert.equal(envelope.gain.value, 1);
    audio.startAmbience("merida");
    assert.equal(first.stopped, true);
    assert.equal(first.destination, undefined);
    assert.equal(sources.length, 2);
    audio.stopAmbience();
    audio.stopAmbience();
    assert.ok(sources.every((source) => source.stopped));
    audio.setSound(false);
    audio.startAmbience("coro");
    assert.equal(sources.length, 2, "muted startup must stay silent");
    audio.setSound(true);
    assert.equal(
      sources.length,
      3,
      "enabling sound starts the requested stage once",
    );
    audio.stopAmbience();
    audio.setSound(false);
    audio.setSound(true);
    assert.equal(
      sources.length,
      3,
      "leaving the fight clears its pending music",
    );
    audio.setSoundView(0, 1100);
    audio.sound("step", "zavarce", { x: 550 });
    assert.equal(
      pans.at(-1)!.pan.value,
      0,
      "sound at the camera center stays centered",
    );
    audio.setSoundView(400, 1500);
    audio.sound("step", "zavarce", { x: 550 });
    assert.ok(
      pans.at(-1)!.pan.value < -0.5,
      "panning follows the camera, not the fixed arena center",
    );
    const beforeVictory = sources.length;
    audio.syncVictoryMusic("oscar", 0, false);
    const fanfare = sources.at(-1)!;
    assert.equal(sources.length, beforeVictory + 1);
    assert.equal(fanfare.loop, false);
    assert.equal(fanfare.offset, 0);
    audio.syncVictoryMusic("oscar", 500, false);
    assert.equal(
      sources.length,
      beforeVictory + 1,
      "render frames never stack fanfares",
    );
    audio.syncVictoryMusic("oscar", 1000, true);
    assert.equal(fanfare.stopped, true);
    assert.equal(fanfare.destination, undefined);
    audio.syncVictoryMusic("oscar", 1100, false);
    assert.equal(sources.at(-1)!.offset, 1.1, "resume at the visual clock");
    audio.setSound(false);
    assert.equal(sources.at(-1)!.stopped, true);
    audio.syncVictoryMusic("oscar", 1200, false);
    assert.equal(
      sources.length,
      beforeVictory + 2,
      "muted finale stays silent",
    );
    audio.setSound(true);
    audio.syncVictoryMusic("oscar", 1300, false);
    assert.equal(
      sources.at(-1)!.offset,
      1.3,
      "unmute never replays the opening",
    );
    audio.syncVictoryMusic("oscar", VICTORY_MUSIC_MS, false);
    assert.equal(sources.at(-1)!.stopped, true);
    audio.syncVictoryMusic("oscar", VICTORY_MUSIC_MS + 1000, false);
    assert.equal(
      sources.length,
      beforeVictory + 3,
      "the result cue finishes without looping",
    );
    audio.syncVictoryMusic("ali", 0, false);
    assert.equal(
      sources.at(-1)!.offset,
      0,
      "next match starts a fresh fanfare",
    );
    assert.notEqual(sources.at(-1)!.buffer, fanfare.buffer);
    audio.stopVictoryMusic();
    audio.stopVictoryMusic();
    assert.equal(sources.at(-1)!.stopped, true);
    const scene: FinaleState = {
      owner: 0,
      target: 1,
      fighter: "capriles",
      startedTick: 500,
      tick: 30,
      duration: 180,
      x: 0,
      y: 0,
      direction: 1,
      damage: 30,
      initialHp: 100,
    };
    audio.syncFinaleMusic(scene, false);
    const coffee = sources.at(-1)!;
    const beforeFinale = sources.length;
    assert.equal(
      coffee.offset,
      0.5,
      "capture resumes from the simulation clock",
    );
    audio.syncFinaleMusic({ ...scene, tick: 50 }, false);
    assert.equal(
      sources.length,
      beforeFinale,
      "render frames never stack finale themes",
    );
    audio.syncFinaleMusic(scene, true);
    assert.equal(coffee.stopped, true);
    audio.syncFinaleMusic({ ...scene, tick: 78 }, false);
    assert.equal(
      sources.at(-1)!.offset,
      1.3,
      "resume skips notes from the pause",
    );
    audio.setSound(false);
    assert.equal(sources.at(-1)!.stopped, true);
    audio.syncFinaleMusic({ ...scene, tick: 90 }, false);
    assert.equal(
      sources.length,
      beforeFinale + 1,
      "muting cannot queue another theme",
    );
    audio.setSound(true);
    audio.syncFinaleMusic(
      {
        ...scene,
        fighter: "nacho",
        startedTick: 501,
        tick: 120,
        duration: 360,
      },
      false,
    );
    const dance = sources.at(-1)!;
    assert.equal(dance.offset, 2);
    assert.equal(
      dance.destination!.gain.value,
      0.8,
      "Nacho's audio stays quiet",
    );
    assert.equal(
      sources.length,
      beforeFinale + 2,
      "Nacho plays audio without depending on a video player",
    );
    audio.syncFinaleMusic(
      {
        ...scene,
        fighter: "nacho",
        startedTick: 501,
        tick: 121,
        duration: 360,
      },
      false,
    );
    assert.equal(
      sources.at(-1),
      dance,
      "render frames do not stack the dance audio",
    );
    audio.syncFinaleMusic(
      {
        ...scene,
        fighter: "nacho",
        startedTick: 501,
        tick: 121,
        duration: 360,
      },
      true,
    );
    assert.equal(dance.stopped, true);
    audio.syncFinaleMusic(
      {
        ...scene,
        fighter: "nacho",
        startedTick: 501,
        tick: 270,
        duration: 360,
      },
      false,
    );
    assert.equal(sources.at(-1)!.offset, 4.5, "audio resumes with the dancers");
    audio.syncFinaleMusic(undefined, false);
    assert.equal(sources.at(-1)!.stopped, true);
    assert.equal(sources.at(-1)!.destination, undefined);
  } finally {
    audio.stopAmbience();
    audio.stopVictoryMusic();
    audio.stopFinaleMusic();
    if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});
