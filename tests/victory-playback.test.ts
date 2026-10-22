import test from "node:test";
import assert from "node:assert/strict";
import { startVictoryMusic, setSound } from "../src/audio";
import { VICTORY_MUSIC_MS } from "../src/game/victory-types";

test("the result cue survives a stopped arena clock, respects mute, focus and visibility, and cleans up", () => {
  const sources: { offset: number; stopped: boolean }[] = [];
  class AudioNode {
    gain = { value: 0, setTargetAtTime() {} };
    threshold = { value: 0 };
    knee = { value: 0 };
    ratio = { value: 0 };
    attack = { value: 0 };
    release = { value: 0 };
    buffer: unknown;
    offset = 0;
    stopped = false;
    connect() {}
    disconnect() {}
    start(_when: number, offset = 0) {
      this.offset = offset;
    }
    stop() {
      this.stopped = true;
    }
  }
  class Context {
    sampleRate = 8000;
    currentTime = 0;
    state = "running";
    destination = new AudioNode();
    createGain() {
      return new AudioNode();
    }
    createDynamicsCompressor() {
      return new AudioNode();
    }
    createBufferSource() {
      const node = new AudioNode();
      sources.push(node);
      return node;
    }
    createBuffer(channels: number, length: number) {
      const buffers = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return { getChannelData: (channel: number) => buffers[channel] };
    }
  }
  let now = 0;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    querySelector: () => null,
  });
  const window = new EventTarget();
  const globals = {
    AudioContext: Context,
    performance: { now: () => now },
    document,
    window,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const originals = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const advance = (time: number) => {
    now = time;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(now));
  };
  let stop: (() => void) | undefined;
  try {
    stop = startVictoryMusic("zavarce");
    assert.equal(sources.length, 1);
    assert.equal(sources[0].offset, 0);
    advance(500);
    assert.equal(sources.length, 1, "frames do not layer another fanfare");
    window.dispatchEvent(new Event("blur"));
    assert.ok(
      sources.at(-1)!.stopped,
      "window blur stops result audio immediately",
    );
    advance(600);
    assert.equal(sources.length, 1, "an unfocused visible window stays quiet");
    window.dispatchEvent(new Event("focus"));
    advance(800);
    assert.equal(
      sources.at(-1)!.offset,
      0.8,
      "focus resumes at the current result clock",
    );
    setSound(false);
    assert.ok(sources.at(-1)!.stopped);
    advance(1500);
    assert.equal(sources.length, 2);
    setSound(true);
    advance(2000);
    assert.equal(
      sources.at(-1)!.offset,
      2,
      "unmuting resumes the result clock",
    );
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    assert.ok(sources.at(-1)!.stopped, "hiding stops audio immediately");
    advance(2600);
    assert.equal(sources.length, 3);
    document.hidden = false;
    advance(3000);
    assert.equal(sources.at(-1)!.offset, 3);
    advance(VICTORY_MUSIC_MS);
    assert.ok(sources.at(-1)!.stopped);
    assert.equal(frames.size, 0, "the completed cue releases its frame loop");
    stop();
    stop = startVictoryMusic("zavarce");
    assert.equal(sources.at(-1)!.offset, 0, "a rematch gets a fresh opening");
    stop();
    assert.equal(frames.size, 0);
    assert.ok(sources.every((source) => source.stopped));
    advance(now + 500);
    window.dispatchEvent(new Event("focus"));
    assert.equal(frames.size, 0, "unmount cannot restart a cue");
  } finally {
    stop?.();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
