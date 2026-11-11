import assert from "node:assert/strict";
import test from "node:test";
import { fighterById } from "../shared/roster/roster";
import atlas from "../src/game/assets/manifests/sprite-geometry.json";
import { loadImage, preloadAssets } from "../src/game/assets/assets";

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
      value = value.split("?")[0];
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
