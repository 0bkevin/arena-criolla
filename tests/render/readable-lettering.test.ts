import test from "node:test";
import assert from "node:assert/strict";
import { unmirrorLettering } from "../../src/game/assets/readable-text";
import readableText from "../../src/game/assets/manifests/readable-text.json";

function context(determinant: number) {
  const draws: number[][] = [];
  const ctx = {
    getTransform: () => ({ a: determinant, b: 0, c: 0, d: 1 }),
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage: (...args: unknown[]) => draws.push(args.slice(1) as number[]),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, draws };
}

// Iñaki's idle frame on the combat atlas, holding the "rial" print.
const sheet = { src: "/assets/inaki-v5.webp?v=abc" } as HTMLImageElement;
const source = { x: 78, y: 59, width: 354, height: 421 };
const destination = { x: -177, y: -421, width: 354, height: 421 };
const texture = { image: sheet, x: source.x, y: source.y };

test("shirt lettering is redrawn the right way round only when mirrored", () => {
  const mirrored = context(-1);
  unmirrorLettering(mirrored.ctx, sheet, source, texture, destination);
  const [print] = readableText["inaki-v5"];
  assert.deepEqual(
    mirrored.draws,
    [[print.x, print.y, print.width, print.height]].map(
      ([x, y, width, height]) => [
        x,
        y,
        width,
        height,
        -width / 2,
        destination.y + (y - source.y),
        width,
        height,
      ],
    ),
  );

  const facingRight = context(1);
  unmirrorLettering(facingRight.ctx, sheet, source, texture, destination);
  assert.equal(facingRight.draws.length, 0);
});

test("sheets without lettering are never patched", () => {
  const mirrored = context(-1);
  unmirrorLettering(
    mirrored.ctx,
    { src: "/assets/renny-v3.webp" } as HTMLImageElement,
    source,
    texture,
    destination,
  );
  assert.equal(mirrored.draws.length, 0);
});
