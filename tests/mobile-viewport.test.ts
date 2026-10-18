import test from "node:test";
import assert from "node:assert/strict";
import { trackPlayViewport } from "../src/game/mobile";

function browser(visual = true) {
  const saved = ["window", "document"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const viewport = Object.assign(new EventTarget(), {
    width: 720,
    height: 269,
    offsetLeft: 0,
    offsetTop: 0,
  });
  const win = Object.assign(new EventTarget(), {
    innerWidth: 720,
    innerHeight: 325,
    visualViewport: visual ? viewport : null,
  });
  const doc = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: win,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: doc,
  });
  const styles = new Map<string, string>();
  const element = {
    style: {
      setProperty: (name: string, value: string) => styles.set(name, value),
      removeProperty: (name: string) => styles.delete(name),
    },
  } as unknown as HTMLElement;
  const stop = trackPlayViewport(element);
  return {
    win,
    doc,
    viewport,
    value: (name: string) => styles.get(`--play-viewport-${name}`),
    styles,
    stop,
    restore() {
      stop();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test("browser chrome keeps the arena bottom inside the visible viewport", () => {
  const b = browser();
  try {
    assert.equal(b.value("height"), "269px");
    assert.equal(b.value("width"), "720px");
    b.viewport.height = 325;
    b.viewport.dispatchEvent(new Event("resize"));
    assert.equal(b.value("height"), "325px");
    b.viewport.height = 269;
    b.viewport.dispatchEvent(new Event("resize"));
    assert.equal(b.value("height"), "269px");
  } finally {
    b.restore();
  }
});

test("rotation, viewport scrolling and fullscreen changes update the play area", () => {
  const b = browser();
  try {
    b.viewport.width = 325;
    b.viewport.height = 664;
    b.win.dispatchEvent(new Event("orientationchange"));
    assert.equal(b.value("width"), "325px");
    assert.equal(b.value("height"), "664px");
    b.viewport.offsetLeft = 12;
    b.viewport.offsetTop = 56;
    b.viewport.dispatchEvent(new Event("scroll"));
    assert.equal(b.value("left"), "12px");
    assert.equal(b.value("top"), "56px");
    b.viewport.width = 720;
    b.viewport.height = 325;
    b.doc.dispatchEvent(new Event("fullscreenchange"));
    assert.equal(b.value("width"), "720px");
    assert.equal(b.value("height"), "325px");
  } finally {
    b.restore();
  }
});

test("browsers without VisualViewport follow window size and clean up on exit", () => {
  const b = browser(false);
  try {
    assert.equal(b.value("height"), "325px");
    assert.equal(b.value("top"), "0px");
    b.win.innerHeight = 269;
    b.win.dispatchEvent(new Event("resize"));
    assert.equal(b.value("height"), "269px");
    b.stop();
    b.win.dispatchEvent(new Event("resize"));
    b.win.dispatchEvent(new Event("orientationchange"));
    b.doc.dispatchEvent(new Event("fullscreenchange"));
    assert.equal(b.styles.size, 0);
  } finally {
    b.restore();
  }
});

test("leaving a touch match stops later visual viewport updates", () => {
  const b = browser();
  try {
    b.stop();
    b.viewport.height = 100;
    b.viewport.dispatchEvent(new Event("resize"));
    b.viewport.dispatchEvent(new Event("scroll"));
    assert.equal(b.styles.size, 0);
  } finally {
    b.restore();
  }
});
