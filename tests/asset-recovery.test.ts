import assert from "node:assert/strict";
import test from "node:test";
import { makeDefinition } from "../server/creator/pipeline";
import attackArt from "../shared/attack-assets.json";
import { registerCommunityCharacter } from "../shared/community";
import { fighterById } from "../shared/content";
import atlas from "../shared/sprite-geometry.json";
import { loadImage, preloadAssets } from "../src/game/assets";
import { deterministicCreatorProvider } from "./fixtures/creator-provider";

function browserFixture(
  options: {
    fail?: (url: string, attempt: number) => boolean;
    canonicalGeometry?: boolean;
  } = {},
) {
  const descriptors = new Map(
    ["Image", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  let attempts = 0;
  const requests = new Map<string, number>();
  class FixtureImage {
    width = 8;
    height = 4;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      attempts++;
      const attempt = (requests.get(value) ?? 0) + 1;
      requests.set(value, attempt);
      if (options.canonicalGeometry) {
        const checked = atlas.sprites
          .flatMap((entry) => entry.files)
          .find((file) => file.file === `public${value}` && file.passed);
        if (checked) {
          this.width = checked.width;
          this.height = checked.height;
        }
      }
      const fail = options.fail ? options.fail(value, attempt) : attempts === 1;
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
          putImageData() {},
          getImageData: (
            _x: number,
            _y: number,
            width: number,
            height: number,
          ) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
        }),
      }),
    },
  });
  return {
    attempts: () => attempts,
    requests: (url: string) => requests.get(url) ?? 0,
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

test("a built-in fight survives a failed finale decoration and retries it without reloading its fighter or stage", async () => {
  const fighter = fighterById("melanio");
  const decoration = attackArt.melanio.file;
  const decorationUrl = `/assets/${decoration}.webp`;
  const spriteUrl = `/assets/${fighter.sprite}.webp`;
  const stageUrl = "/assets/caracas.webp";
  const browser = browserFixture({
    canonicalGeometry: true,
    fail: (url, attempt) => url === decorationUrl && attempt === 1,
  });
  try {
    const fallback = await preloadAssets([fighter.id], ["caracas"]);
    assert.equal(fallback.sprites[fighter.id].frames.length, 8);
    assert.ok(fallback.stages.caracas);
    assert.equal(fallback.finaleProps[decoration], undefined);
    assert.equal(browser.requests(decorationUrl), 1);

    const recovered = await preloadAssets([fighter.id], ["caracas"]);
    assert.ok(recovered.finaleProps[decoration]);
    assert.equal(recovered.sprites[fighter.id], fallback.sprites[fighter.id]);
    assert.equal(recovered.stages.caracas, fallback.stages.caracas);
    assert.equal(browser.requests(decorationUrl), 2);
    assert.equal(browser.requests(spriteUrl), 1);
    assert.equal(browser.requests(stageUrl), 1);

    const cached = await preloadAssets([fighter.id], ["caracas"]);
    assert.equal(
      cached.finaleProps[decoration],
      recovered.finaleProps[decoration],
    );
    assert.equal(browser.requests(decorationUrl), 2);
  } finally {
    browser.restore();
  }
});

test("mandatory built-in fighter and stage failures still reject, then recover on a later fight", async () => {
  for (const [id, stage, failedLayer] of [
    ["javier", "guaira", "fighter"],
    ["capriles", "valencia", "stage"],
  ] as const) {
    const fighter = fighterById(id);
    const failedAsset = failedLayer === "fighter" ? fighter.sprite : stage;
    const failedUrl = `/assets/${failedAsset}.webp`;
    const browser = browserFixture({
      canonicalGeometry: true,
      fail: (url, attempt) => url === failedUrl && attempt === 1,
    });
    try {
      await assert.rejects(preloadAssets([id], [stage]), (error) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          `No se pudo cargar el asset ${failedAsset}.`,
        );
        return true;
      });
      const recovered = await preloadAssets([id], [stage]);
      assert.equal(recovered.sprites[id].frames.length, 8);
      assert.ok(recovered.stages[stage]);
      assert.equal(browser.requests(failedUrl), 2, `${failedLayer} can retry`);
    } finally {
      browser.restore();
    }
  }
});
