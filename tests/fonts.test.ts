import test from "node:test";
import assert from "node:assert/strict";
import { loadInterfaceFonts } from "../src/fonts";

function fontBrowser() {
  const originals = ["FontFace", "document"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const faces: DeferredFace[] = [];
  const registered: DeferredFace[] = [];
  class DeferredFace {
    status: FontFaceLoadStatus = "unloaded";
    private resolve!: (face: DeferredFace) => void;
    private reject!: (error: Error) => void;
    private loaded = new Promise<DeferredFace>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    constructor(
      readonly family: string,
      readonly source: string,
      readonly descriptors: FontFaceDescriptors,
    ) {
      faces.push(this);
    }
    get style() {
      return this.descriptors.style ?? "normal";
    }
    load() {
      this.status = "loading";
      return this.loaded;
    }
    finish() {
      this.status = "loaded";
      this.resolve(this);
    }
    fail() {
      this.status = "error";
      this.reject(new Error("Font download failed"));
    }
  }
  Object.defineProperty(globalThis, "FontFace", {
    configurable: true,
    value: DeferredFace,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { fonts: { add: (face: DeferredFace) => registered.push(face) } },
  });
  return {
    faces,
    registered,
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

function isEntranceFont(face: { source: string }) {
  return (
    face.source.includes("barlow-800-italic.woff2") ||
    face.source.includes("dm-sans-400.woff2")
  );
}

test("entrance fonts become ready without waiting for the remaining interface fonts", async () => {
  const browser = fontBrowser();
  try {
    let rendered = false;
    const loading = loadInterfaceFonts();
    const startup = loading.ready.then(() => (rendered = true));
    assert.equal(browser.faces.length, 5);
    assert.ok(browser.faces.every((face) => face.status === "loading"));
    const critical = browser.faces.filter(isEntranceFont);
    critical[0].finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(rendered, false);
    assert.equal(browser.registered.length, 0);

    critical[1].finish();
    assert.deepEqual(await loading.entranceReady, { displayReady: true });
    assert.equal(rendered, false);
    assert.deepEqual(browser.registered, critical);

    for (const face of browser.faces.filter((face) => !isEntranceFont(face))) {
      face.finish();
    }
    await startup;
    assert.equal(rendered, true);
    assert.deepEqual(browser.registered, critical);
    loading.activateInterface();
    loading.activateInterface();
    assert.deepEqual(new Set(browser.registered), new Set(browser.faces));
    assert.equal(browser.registered.length, 5);
  } finally {
    browser.restore();
  }
});

test("early interface activation waits for both groups and registers each face once", async () => {
  const browser = fontBrowser();
  try {
    const loading = loadInterfaceFonts();
    loading.activateInterface();
    loading.activateInterface();
    for (const face of browser.faces.filter((face) => !isEntranceFont(face))) {
      face.finish();
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(browser.registered.length, 0);

    for (const face of browser.faces.filter(isEntranceFont)) face.finish();
    await loading.ready;
    loading.activateInterface();
    assert.deepEqual(new Set(browser.registered), new Set(browser.faces));
    assert.equal(browser.registered.length, 5);
  } finally {
    browser.restore();
  }
});

// One entrance-critical face and one deferred interface face.
for (const failedFile of ["barlow-800-italic.woff2", "dm-sans-700.woff2"]) {
  test(`a failed ${failedFile} preserves the other successfully loaded variants`, async () => {
    const browser = fontBrowser();
    try {
      const loading = loadInterfaceFonts();
      for (const face of browser.faces) {
        if (face.source.includes(failedFile)) face.fail();
        else face.finish();
      }
      await loading.ready;
      assert.deepEqual(await loading.entranceReady, {
        displayReady: failedFile !== "barlow-800-italic.woff2",
      });
      loading.activateInterface();
      assert.deepEqual(
        new Set(browser.registered),
        new Set(browser.faces.filter((face) => face.status === "loaded")),
      );
    } finally {
      browser.restore();
    }
  });
}

test("a stalled upright face preserves loaded italic text and never swaps in later", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = fontBrowser();
  try {
    const loading = loadInterfaceFonts();
    const upright = browser.faces.find((face) =>
      face.source.includes("barlow-800.woff2"),
    )!;
    for (const face of browser.faces) {
      if (face !== upright) face.finish();
    }
    await loading.entranceReady;
    assert.ok(
      browser.registered.some((face) => face.descriptors.style === "italic"),
    );
    t.mock.timers.tick(3000);
    await loading.ready;
    loading.activateInterface();
    const selected = browser.faces.filter((face) => face !== upright);
    assert.deepEqual(new Set(browser.registered), new Set(selected));

    upright.finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(new Set(browser.registered), new Set(selected));
  } finally {
    browser.restore();
  }
});

test("a stalled entrance face cannot delay the intro beyond 1200ms or swap in later", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = fontBrowser();
  try {
    let entranceReady = false;
    const loading = loadInterfaceFonts();
    void loading.entranceReady.then(() => (entranceReady = true));
    const stalled = browser.faces.find((face) =>
      face.source.includes("barlow-800-italic.woff2"),
    )!;
    for (const face of browser.faces) {
      if (face !== stalled) face.finish();
    }
    t.mock.timers.tick(1199);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(entranceReady, false);

    t.mock.timers.tick(1);
    assert.deepEqual(await loading.entranceReady, { displayReady: false });
    await loading.ready;
    assert.equal(entranceReady, true);
    assert.deepEqual(
      browser.registered,
      browser.faces.filter((face) => isEntranceFont(face) && face !== stalled),
    );
    loading.activateInterface();
    const selected = [...browser.registered];
    assert.deepEqual(
      new Set(selected),
      new Set(browser.faces.filter((face) => face !== stalled)),
    );

    stalled.finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(browser.registered, selected);
  } finally {
    browser.restore();
  }
});

test("stalled downloads cannot block app startup beyond 3000ms or swap fonts after their deadlines", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = fontBrowser();
  try {
    const loading = loadInterfaceFonts();
    for (const face of browser.faces) {
      if (face.family === "Pixelify Sans") face.finish();
    }
    t.mock.timers.tick(3000);
    await loading.ready;
    assert.equal(browser.registered.length, 0);
    loading.activateInterface();
    const initialFonts = [...browser.registered];
    assert.deepEqual(
      initialFonts.map((face) => face.family),
      ["Pixelify Sans"],
    );

    for (const face of browser.faces) {
      if (face.source.includes("barlow-800-italic")) face.fail();
      else if (face.status !== "loaded") face.finish();
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(browser.registered, initialFonts);
  } finally {
    browser.restore();
  }
});

test("browsers without the font loading API can still start", async () => {
  const browser = fontBrowser();
  try {
    Reflect.deleteProperty(globalThis, "FontFace");
    const loading = loadInterfaceFonts();
    assert.deepEqual(await loading.entranceReady, { displayReady: false });
    await loading.ready;
    loading.activateInterface();
    assert.equal(browser.faces.length, 0);
  } finally {
    browser.restore();
  }
});
