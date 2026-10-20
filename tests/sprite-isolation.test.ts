import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import atlas from "../shared/sprite-geometry.json";
import { isolateFramePixels } from "../src/game/sprite-isolation";

test("Pedro kick and running crops exclude neighboring opaque shoe fragments", async () => {
  const sprite = atlas.sprites.find((s) => s.id === "vallenilla")!;
  const file = sprite.files.find(
    (f) => f.file === "public/assets/vallenilla-v5.webp",
  )!;
  const expectedOpaquePixels: Record<number, number> = { 2: 57115, 6: 54921 };
  for (const index of [2, 6]) {
    const c = file.components[index],
      width = c.maxX - c.minX + 1,
      height = c.maxY - c.minY + 1;
    const { data } = await sharp(file.file)
      .extract({ left: c.minX, top: c.minY, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const before = new Uint8ClampedArray(data),
      after = isolateFramePixels(before, width, height);
    const count = (pixels: Uint8ClampedArray) => {
      let n = 0;
      for (let p = 3; p < pixels.length; p += 4) if (pixels[p] >= 40) n++;
      return n;
    };
    assert.ok(
      count(before) > expectedOpaquePixels[index],
      "Fixture reproduces overlapping pose pixels",
    );
    assert.equal(
      count(after),
      expectedOpaquePixels[index],
      "Every main silhouette pixel remains and foreign pixels are removed",
    );
  }
});
