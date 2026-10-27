import test from "node:test";
import assert from "node:assert/strict";

test("mobile audio activation and foreground recovery", async (t) => {
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
    frequency = new Param();
    threshold = new Param();
    knee = new Param();
    ratio = new Param();
    attack = new Param();
    release = new Param();
    stopped = false;
    buffer: unknown;
    loop = false;
    connect() {}
    disconnect() {}
    start() {}
    stop() {
      this.stopped = true;
    }
  }
  let resumes = 0;
  let oscillators = 0;
  let allowed = false;
  let rejected = false;
  let created = 0;
  const waiting: (() => void)[] = [];
  const gains: Node[] = [];
  const sources: Node[] = [];
  let instance: Context;
  class Context extends EventTarget {
    state = "suspended";
    currentTime = 0;
    sampleRate = 8000;
    destination = new Node();
    constructor() {
      super();
      instance = this;
      created++;
    }
    createDynamicsCompressor() {
      return new Node();
    }
    createGain() {
      const node = new Node();
      gains.push(node);
      return node;
    }
    createOscillator() {
      oscillators++;
      return new Node();
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
    resume() {
      resumes++;
      if (rejected) return Promise.reject(new Error("Playback blocked"));
      if (!allowed)
        return new Promise<void>((resolve) => waiting.push(resolve));
      this.state = "running";
      waiting.splice(0).forEach((resolve) => resolve());
      return Promise.resolve();
    }
  }
  class Page extends EventTarget {
    hidden = false;
  }
  const page = new Page();
  const win = new EventTarget();
  const globals = { AudioContext: Context, document: page, window: win };
  const previous = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  let cleanup: (() => void) | undefined;
  try {
    const audio = await import("../src/audio");
    await t.test(
      "touch release retries a pending autoplay resume",
      async () => {
        cleanup = audio.listenForAudioActivation();
        assert.equal(
          created,
          0,
          "mounting must not create an autoplay context",
        );
        audio.initAudio();
        assert.equal(resumes, 1);
        for (let i = 0; i < 30; i++) audio.initAudio();
        assert.equal(
          resumes,
          1,
          "render frames must not pile up resume requests",
        );
        win.dispatchEvent(new Event("pointerdown"));
        assert.equal(
          instance!.state,
          "suspended",
          "touch start is blocked in this scenario",
        );
        const beforeRelease = resumes;
        allowed = true;
        win.dispatchEvent(new Event("pointerup"));
        await settle();
        assert.equal(
          resumes,
          beforeRelease + 1,
          "touch release must retry inside its event",
        );
        audio.sound("select");
        assert.ok(
          oscillators > 0,
          "playback must work after the first touch release",
        );
        assert.equal(created, 1, "unlocking reuses the existing context");
      },
    );
    await t.test(
      "touchend, accessible clicks and keyboard activation recover playback",
      async () => {
        for (const event of ["touchend", "click", "keydown"]) {
          instance!.state = "suspended";
          const before = resumes;
          win.dispatchEvent(new Event(event));
          await settle();
          assert.equal(resumes, before + 1, event);
          assert.equal(instance!.state, "running", event);
        }
      },
    );
    await t.test(
      "mobile audio resumes after a browser interruption",
      async () => {
        instance!.state = "interrupted";
        const before = resumes;
        audio.initAudio();
        await settle();
        assert.equal(
          resumes,
          before + 1,
          "an interrupted mobile context must be resumed",
        );
        const beforeSound = oscillators;
        audio.sound("select");
        assert.ok(
          oscillators > beforeSound,
          "sound must play again after returning to the game",
        );
      },
    );
    await t.test(
      "hidden pages stay silent and recover without stacking music",
      async () => {
        audio.startAmbience("caracas");
        assert.equal(sources.length, 1);
        audio.syncVictoryMusic("oscar", 0, false);
        const victory = sources.at(-1)!;
        page.hidden = true;
        instance!.state = "suspended";
        page.dispatchEvent(new Event("visibilitychange"));
        assert.equal(
          gains[0].gain.value,
          0,
          "the complete audio graph must be quiet",
        );
        assert.equal(
          victory.stopped,
          true,
          "hidden result cues must not resume stale notes",
        );
        const before = resumes;
        const beforeSound = oscillators;
        audio.initAudio();
        win.dispatchEvent(new Event("pointerup"));
        audio.sound("select");
        audio.syncVictoryMusic("oscar", 100, false);
        assert.equal(resumes, before, "hidden pages must not try to resume");
        assert.equal(oscillators, beforeSound);
        assert.equal(sources.at(-1), victory, "hidden cues must not restart");
        page.hidden = false;
        page.dispatchEvent(new Event("visibilitychange"));
        await settle();
        assert.equal(instance!.state, "running");
        assert.ok(gains[0].gain.value > 0, "foreground restores the master gain");
        audio.startAmbience("caracas");
        assert.equal(
          sources.length,
          2,
          "foreground recovery keeps a single background loop",
        );
        audio.stopAmbience();
      },
    );
    await t.test(
      "focus and page restoration retry suspended playback",
      async () => {
        for (const event of ["focus", "pageshow"]) {
          instance!.state = "suspended";
          win.dispatchEvent(new Event(event));
          await settle();
          assert.equal(instance!.state, "running", event);
        }
        win.dispatchEvent(new Event("pagehide"));
        assert.equal(
          gains[0].gain.value,
          0,
          "pagehide can precede document.hidden",
        );
        win.dispatchEvent(new Event("pageshow"));
        assert.ok(gains[0].gain.value > 0, "foreground restores the master gain");
      },
    );
    await t.test(
      "foreground recovery retries an earlier pending resume",
      async () => {
        allowed = false;
        instance!.state = "suspended";
        audio.initAudio();
        page.hidden = true;
        page.dispatchEvent(new Event("visibilitychange"));
        allowed = true;
        page.hidden = false;
        page.dispatchEvent(new Event("visibilitychange"));
        await settle();
        assert.equal(
          instance!.state,
          "running",
          "an earlier blocked request must not prevent foreground recovery",
        );
      },
    );
    await t.test(
      "muting during a pending resume still allows immediate unmute",
      async () => {
        allowed = false;
        instance!.state = "suspended";
        audio.initAudio();
        audio.setSound(false);
        const before = resumes;
        win.dispatchEvent(new Event("click"));
        assert.equal(
          resumes,
          before,
          "muted gestures must not activate playback",
        );
        // The capture listener runs while still muted; the button then enables sound.
        allowed = true;
        audio.setSound(true);
        await settle();
        assert.equal(
          instance!.state,
          "running",
          "the unmute action must retry a blocked resume",
        );
      },
    );
    await t.test(
      "a rejected resume can be retried on the next gesture",
      async () => {
        instance!.state = "suspended";
        rejected = true;
        audio.initAudio();
        await settle();
        rejected = false;
        win.dispatchEvent(new Event("touchend"));
        await settle();
        assert.equal(instance!.state, "running");
      },
    );
    await t.test(
      "StrictMode remount and unmount remove activation listeners",
      async () => {
        cleanup!();
        cleanup = audio.listenForAudioActivation();
        instance!.state = "suspended";
        allowed = false;
        const before = resumes;
        win.dispatchEvent(new Event("pointerup"));
        assert.equal(
          resumes,
          before + 1,
          "remount must leave only one listener",
        );
        cleanup();
        cleanup = undefined;
        const after = resumes;
        for (const event of [
          "pointerdown",
          "pointerup",
          "touchend",
          "click",
          "keydown",
          "focus",
          "pageshow",
          "pagehide",
        ])
          win.dispatchEvent(new Event(event));
        page.dispatchEvent(new Event("visibilitychange"));
        assert.equal(resumes, after, "unmount must remove every listener");
        assert.ok(
          gains[0].gain.value > 0,
          "unmounted pagehide must not mute the app",
        );
      },
    );
  } finally {
    cleanup?.();
    waiting.splice(0).forEach((resolve) => resolve());
    await settle();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
