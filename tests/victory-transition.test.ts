import test from "node:test";
import assert from "node:assert/strict";
import { playVictoryTransition } from "../src/game/victory-transition";

function fixture(reducedMotion = false) {
  const events = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: reducedMotion });
  let resolve!: () => void;
  let reject!: () => void;
  const animation = {
    cancelled: false,
    finished: new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    }),
    finish: () => resolve(),
    cancel() {
      this.cancelled = true;
      reject();
    },
  };
  let frames: Keyframe[] = [];
  let duration = 0;
  const screen = {
    animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      frames = keyframes;
      duration = Number(options.duration);
      return animation;
    },
  } as unknown as HTMLElement;
  const globals = { window: events, matchMedia: () => reduced };
  const originals = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  let completions = 0;
  const clean = playVictoryTransition(screen, () => completions++);
  return {
    animation,
    frames,
    duration,
    events,
    reduced,
    clean,
    completions: () => completions,
    restore() {
      clean();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test("the final result fades in together without moving the winner from another scene", async () => {
  const f = fixture();
  try {
    assert.ok(
      f.frames.every((frame) => !frame.transform),
      "no movement",
    );
    assert.equal(f.frames.at(-1)?.opacity, 1);
    assert.ok(f.duration > 0 && f.duration <= 200);
    assert.equal(f.completions(), 0);
    f.animation.finish();
    await Promise.resolve();
    assert.equal(f.completions(), 1);
    assert.ok(f.animation.cancelled);
  } finally {
    f.restore();
  }
});

test("reduced motion retains a short fade and makes the result ready", async () => {
  const f = fixture(true);
  try {
    assert.ok(f.duration <= 100);
    assert.ok(f.frames.every((frame) => !frame.transform));
    f.animation.finish();
    await Promise.resolve();
    assert.equal(f.completions(), 1);
  } finally {
    f.restore();
  }
});

test("unmount cancels the transition without activating a discarded result", async () => {
  const f = fixture();
  try {
    f.clean();
    f.events.dispatchEvent(new Event("resize"));
    f.reduced.dispatchEvent(new Event("change"));
    await Promise.resolve();
    assert.equal(f.completions(), 0);
    assert.ok(f.animation.cancelled);
  } finally {
    f.restore();
  }
});

test("resizing or changing motion preference settles the result exactly once", async () => {
  for (const trigger of ["resize", "motion"]) {
    const f = fixture();
    try {
      if (trigger === "resize") f.events.dispatchEvent(new Event("resize"));
      else f.reduced.dispatchEvent(new Event("change"));
      f.events.dispatchEvent(new Event("resize"));
      f.reduced.dispatchEvent(new Event("change"));
      await Promise.resolve();
      assert.equal(f.completions(), 1);
      assert.ok(f.animation.cancelled);
    } finally {
      f.restore();
    }
  }
});
