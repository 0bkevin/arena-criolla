import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import atlas from "../shared/sprite-assets.json";
import { isolateFramePixels } from "../src/game/sprite-isolation";

test("Pedro kick and running crops exclude neighboring opaque shoe fragments", async () => {
  const file = atlas.vallenilla;
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
      count(before) > c.pixels,
      "Fixture reproduces overlapping pose pixels",
    );
    assert.equal(
      count(after),
      c.pixels,
      "Every main silhouette pixel remains and foreign pixels are removed",
    );
  }
});
