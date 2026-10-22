import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { preloadAssets } from "../src/game/assets";
import { demoRivalFor, simulateMoveDemo } from "../src/game/move-demo";
import { preloadMovePreviewAssets } from "../src/game/move-preview-assets";
import { renderMatch, type Assets } from "../src/game/renderer";
import { browserFixture } from "./helpers/asset-browser";

function sourceImages(assets: Assets) {
  return new Set(
    [
      ...Object.values(assets.sprites).flatMap((sprite) => [
        sprite.image,
        ...(sprite.frameTextures ?? []),
      ]),
      ...Object.values(assets.stages),
      ...Object.values(assets.finaleProps),
      assets.courier,
    ].filter(Boolean),
  );
}

test("all 330 complete preview sequences retain every image used by the full combat renderer", async () => {
  const browser = browserFixture();
  const sized = new Set<HTMLImageElement>();
  const used = new Set<CanvasImageSource>();
  const properties: Record<string | symbol, unknown> = {
    canvas: { width: 960, height: 600 },
    globalAlpha: 1,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 20 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    drawImage: (image: CanvasImageSource) => {
      if ("src" in image) used.add(image);
    },
  };
  const context = new Proxy(properties, {
    get: (target, key) => target[key] ?? (() => {}),
  }) as unknown as CanvasRenderingContext2D;
  const createElement = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const canvas = createElement(tag) as HTMLCanvasElement;
    const original = canvas.getContext("2d")!;
    const offscreenProperties: Record<string | symbol, unknown> = {
      ...properties,
      getImageData: original.getImageData,
      canvas,
    };
    const offscreen = new Proxy(offscreenProperties, {
      get: (target, key) => target[key] ?? (() => {}),
    }) as unknown as CanvasRenderingContext2D;
    Object.assign(canvas, { getContext: () => offscreen });
    return canvas;
  }) as typeof document.createElement;
  try {
    for (const fighter of BUILT_IN_FIGHTERS) {
      const full = await preloadAssets(
        [fighter.id, demoRivalFor(fighter.id)],
        ["caracas"],
      );
      // Real intrinsic dimensions allow every artwork preflight to succeed;
      // tiny placeholder images would conceal missing late-frame dependencies.
      for (const image of sourceImages(full)) {
        if (!image || !("src" in image) || sized.has(image)) continue;
        const metadata = await sharp(`public${image.src}`).metadata();
        Object.assign(image, {
          width: metadata.width,
          height: metadata.height,
          complete: true,
        });
        sized.add(image);
      }
      for (const move of [
        "light",
        "heavy",
        "special",
        "final",
        "combo1",
        "combo2",
      ] as const) {
        const preview = await preloadMovePreviewAssets(fighter.id, move);
        const available = sourceImages(preview);
        used.clear();
        const frames = simulateMoveDemo(fighter.id, move);
        for (const reducedMotion of [false, true])
          for (const [frame, state] of frames.entries())
            renderMatch(
              context,
              state,
              full,
              (frame * 1000) / 60,
              reducedMotion,
              { x: 600, zoom: 1 },
            );
        for (const image of used)
          assert.ok(
            available.has(image as HTMLImageElement),
            `${fighter.id}/${move}: missing ${"src" in image ? image.src : "isolated frame"}`,
          );
      }
    }
  } finally {
    browser.restore();
  }
});
