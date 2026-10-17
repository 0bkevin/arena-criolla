import test from "node:test";
import assert from "node:assert/strict";
import {
  enterLandscape,
  hasTouchInput,
  leaveLandscape,
} from "../src/game/mobile";

function browser(
  options: {
    denyFullscreen?: boolean;
    noFullscreen?: boolean;
    noLock?: boolean;
    denyLock?: boolean;
    defer?: boolean;
  } = {},
) {
  const saved = new Map(
    ["document", "screen", "matchMedia"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const points = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
  const calls: string[] = [];
  let resolveFullscreen: (() => void) | undefined;
  const doc = {
    fullscreenElement: null as HTMLElement | null,
    exitFullscreen: async () => {
      calls.push("exit");
      doc.fullscreenElement = null;
    },
  };
  const element = {
    requestFullscreen: options.noFullscreen
      ? undefined
      : async () => {
          calls.push("fullscreen");
          if (options.denyFullscreen) throw new Error("Fullscreen denied");
          if (options.defer)
            await new Promise<void>((resolve) => {
              resolveFullscreen = resolve;
            });
          doc.fullscreenElement = element as unknown as HTMLElement;
        },
  } as unknown as HTMLElement;
  const orientation = {
    lock: options.noLock
      ? undefined
      : async (type: string) => {
          calls.push(type);
          if (options.denyLock) throw new Error("Unsupported orientation");
        },
    unlock: () => calls.push("unlock"),
  };
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: 5,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: doc,
  });
  Object.defineProperty(globalThis, "screen", {
    configurable: true,
    value: { orientation },
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true }),
  });
  return {
    calls,
    element,
    doc,
    resolve: () => resolveFullscreen?.(),
    restore: () => {
      leaveLandscape();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      if (points) Object.defineProperty(navigator, "maxTouchPoints", points);
      else Reflect.deleteProperty(navigator, "maxTouchPoints");
    },
  };
}

test("hybrid desktops keep the keyboard layout; a touch phone still uses the mobile layout", () => {
  const b = browser();
  try {
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false }),
    });
    Object.defineProperty(globalThis, "screen", {
      configurable: true,
      value: { width: 1920, height: 1080 },
    });
    assert.equal(hasTouchInput(), false);
    Object.defineProperty(globalThis, "screen", {
      configurable: true,
      value: { width: 844, height: 390 },
    });
    assert.equal(hasTouchInput(), true);
  } finally {
    b.restore();
  }
});

test("mobile enters fullscreen before locking landscape and restores both on exit", async () => {
  const b = browser();
  try {
    assert.deepEqual(await enterLandscape(b.element), {
      fullscreen: true,
      locked: true,
    });
    assert.deepEqual(b.calls, ["fullscreen", "landscape"]);
    leaveLandscape();
    assert.deepEqual(b.calls, ["fullscreen", "landscape", "unlock", "exit"]);
    assert.equal(b.doc.fullscreenElement, null);
  } finally {
    b.restore();
  }
});
test("denied fullscreen remains a playable fallback instead of rejecting", async () => {
  const b = browser({ denyFullscreen: true });
  try {
    assert.deepEqual(await enterLandscape(b.element), {
      fullscreen: false,
      locked: false,
    });
    assert.deepEqual(b.calls, ["fullscreen"]);
  } finally {
    b.restore();
  }
});
test("unsupported orientation preserves fullscreen and permits manual rotation", async () => {
  const b = browser({ denyLock: true });
  try {
    assert.deepEqual(await enterLandscape(b.element), {
      fullscreen: true,
      locked: false,
    });
    leaveLandscape();
    assert.deepEqual(b.calls, ["fullscreen", "landscape", "exit"]);
  } finally {
    b.restore();
  }
});
test("missing fullscreen and orientation APIs do not prevent play", async () => {
  const b = browser({ noFullscreen: true, noLock: true });
  try {
    assert.deepEqual(await enterLandscape(b.element), {
      fullscreen: false,
      locked: false,
    });
    assert.deepEqual(b.calls, []);
  } finally {
    b.restore();
  }
});
test("an existing fullscreen session is not closed by game cleanup", async () => {
  const b = browser({ noLock: true });
  try {
    const existing = {} as HTMLElement;
    b.doc.fullscreenElement = existing;
    await enterLandscape(b.element);
    leaveLandscape();
    assert.equal(b.doc.fullscreenElement, existing);
    assert.deepEqual(b.calls, []);
  } finally {
    b.restore();
  }
});
test("leaving during a pending fullscreen request cleans up the late result without locking", async () => {
  const b = browser({ defer: true });
  try {
    const pending = enterLandscape(b.element);
    leaveLandscape();
    b.resolve();
    assert.deepEqual(await pending, { fullscreen: false, locked: false });
    assert.equal(b.doc.fullscreenElement, null);
    assert.deepEqual(b.calls, ["fullscreen", "exit"]);
  } finally {
    b.restore();
  }
});
