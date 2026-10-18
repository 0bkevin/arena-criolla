import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import atlas from "../shared/courier-assets.json";

test("Yummy rider animation ships with transparent, isolated frames and a stable wheel baseline", async () => {
  const { data, info } = await sharp(atlas.runtime)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, atlas.cellWidth * atlas.columns);
  assert.equal(info.height, atlas.cellHeight * 2);
  assert.equal(atlas.frames.length, 4);
  const bottoms: number[] = [];
  for (const frame of atlas.frames) {
    let visible = 0,
      bottom = -1;
    for (let y = 0; y < frame.height; y++)
      for (let x = 0; x < frame.width; x++) {
        const alpha = data[((frame.y + y) * info.width + frame.x + x) * 4 + 3];
        if (x < 4 || y < 4 || x >= frame.width - 4 || y >= frame.height - 4)
          assert.equal(alpha, 0, "sprite must not bleed into its neighbour");
        if (alpha > 24) {
          visible++;
          bottom = y;
        }
      }
    assert.ok(
      visible > 20000,
      "each cell contains a complete rider and motorcycle",
    );
    assert.ok(
      visible < frame.width * frame.height * 0.8,
      "transparent gutters surround each frame",
    );
    assert.ok(
      Math.abs(bottom - atlas.baseline) < 4,
      "tires remain on the shared baseline",
    );
    bottoms.push(bottom);
  }
  assert.ok(Math.max(...bottoms) - Math.min(...bottoms) <= 2);
});
