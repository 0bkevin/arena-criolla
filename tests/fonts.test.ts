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

test("font selection settles before text is revealed or any faces are registered", async () => {
  const browser = fontBrowser();
  try {
    let rendered = false;
    const startup = loadInterfaceFonts().then(() => (rendered = true));
    assert.equal(browser.faces.length, 5);
    for (const face of browser.faces.slice(0, -1)) face.finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(rendered, false);
    assert.equal(browser.registered.length, 0);

    browser.faces.at(-1)!.finish();
    await startup;
    assert.equal(rendered, true);
    assert.deepEqual(browser.registered, browser.faces);
  } finally {
    browser.restore();
  }
});

for (const failedFile of ["barlow-800.ttf", "dm-sans-700.ttf"]) {
  test(`a failed ${failedFile} preserves the other successfully loaded variants`, async () => {
    const browser = fontBrowser();
    try {
      const startup = loadInterfaceFonts();
      for (const face of browser.faces) {
        if (face.source.includes(failedFile)) face.fail();
        else face.finish();
      }
      await startup;
      assert.deepEqual(
        browser.registered,
        browser.faces.filter((face) => face.status === "loaded"),
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
    const startup = loadInterfaceFonts();
    const upright = browser.faces.find((face) =>
      face.source.includes("barlow-800.ttf"),
    )!;
    for (const face of browser.faces) {
      if (face !== upright) face.finish();
    }
    t.mock.timers.tick(3000);
    await startup;
    const selected = browser.faces.filter((face) => face !== upright);
    assert.deepEqual(browser.registered, selected);

    upright.finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(browser.registered, selected);
  } finally {
    browser.restore();
  }
});

test("a stalled download cannot block startup or swap fonts after the deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = fontBrowser();
  try {
    const startup = loadInterfaceFonts();
    for (const face of browser.faces) {
      if (face.family === "Pixelify Sans") face.finish();
    }
    t.mock.timers.tick(3000);
    await startup;
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
    await loadInterfaceFonts();
    assert.equal(browser.faces.length, 0);
  } finally {
    browser.restore();
  }
});
