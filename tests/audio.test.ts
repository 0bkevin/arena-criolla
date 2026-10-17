import test from "node:test";
import assert from "node:assert/strict";
import { MUSIC_SECONDS, writeArcadeMusic } from "../src/game/arcade-music";

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
    connect(node: Node) {
      this.destination = node;
    }
    disconnect() {
      this.destination = undefined;
    }
    start() {
      this.started = true;
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
  } finally {
    audio.stopAmbience();
    if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});
