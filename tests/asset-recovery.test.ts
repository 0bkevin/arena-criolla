import test from "node:test";
import assert from "node:assert/strict";
import { loadImage, preloadAssets } from "../src/game/assets";
import { makeDefinition } from "../server/creator/pipeline";
import { registerCommunityCharacter } from "../shared/community";
import { deterministicCreatorProvider } from "./fixtures/creator-provider";

function browserFixture() {
  const descriptors = new Map(
    ["Image", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  let attempts = 0;
  class FixtureImage {
    width = 8;
    height = 4;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      const fail = ++attempts === 1;
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: FixtureImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray(16) }),
        }),
      }),
    },
  });
  return {
    attempts: () => attempts,
    restore: () => {
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

test("a transient image failure can be retried while successful loads remain cached", async () => {
  const browser = browserFixture();
  try {
    const first = loadImage("qa-transient-image");
    assert.equal(loadImage("qa-transient-image"), first);
    await assert.rejects(first, /No se pudo cargar/);
    const recovered = await loadImage("qa-transient-image");
    assert.equal(browser.attempts(), 2);
    assert.equal(await loadImage("qa-transient-image"), recovered);
    assert.equal(browser.attempts(), 2);
  } finally {
    browser.restore();
  }
});

test("the real fighter preload retries both sprite and image layers after a failed atlas load", async () => {
  const input = {
    name: "Recuperación QA",
    description: "Personaje de prueba para recuperar un atlas.",
    style: "agile" as const,
    color: "#6084b8",
  };
  const design = await deterministicCreatorProvider().design(input, []);
  const character = makeDefinition(
    "custom_" + "e".repeat(32),
    input,
    design,
    {
      width: 8,
      height: 4,
      cellWidth: 2,
      cellHeight: 2,
      baseline: 2,
      bodyHeight: 2,
      frames: Array.from({ length: 8 }, (_, i) => ({
        x: (i % 4) * 2,
        y: Math.floor(i / 4) * 2,
        width: 2,
        height: 2,
        slotX: (i % 4) * 2,
        slotY: Math.floor(i / 4) * 2,
      })),
    },
    "QA",
  );
  registerCommunityCharacter(character, false);
  const browser = browserFixture();
  try {
    await assert.rejects(
      preloadAssets([character.id], []),
      /No se pudo cargar/,
    );
    const recovered = await preloadAssets([character.id], []);
    assert.equal(recovered.sprites[character.id].frames.length, 8);
    assert.equal(browser.attempts(), 2);
  } finally {
    browser.restore();
  }
});
