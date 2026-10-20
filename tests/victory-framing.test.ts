import test from "node:test";
import assert from "node:assert/strict";
import atlas from "../shared/sprite-geometry.json";
import { FIGHTERS } from "../shared/content";
import { presentationById } from "../shared/presentation";
import { victoryById } from "../src/game/victory";
import { victoryBodyHeight } from "../src/game/victory-framing";

test("every winner's painted poses fit beside the title, with room for its victory motion", () => {
  for (const fighter of FIGHTERS) {
    const file = atlas.sprites.find((sprite) => sprite.id === fighter.id)!
      .files[0];
    const cellWidth = file.width / 4;
    const cellHeight = file.height / 2;
    const neutral = file.components[0];
    const sprite = {
      cellWidth,
      baseline: neutral.maxY + 1,
      bodyHeight: neutral.maxY - neutral.minY,
      frames: file.components.map((frame, index) => ({
        x: frame.minX,
        y: frame.minY,
        width: frame.maxX - frame.minX + 1,
        height: frame.maxY - frame.minY + 1,
        slotX: (index % 4) * cellWidth,
        slotY: Math.floor(index / 4) * cellHeight,
      })),
    };
    const frames = [
      0,
      victoryById(fighter.id).frame,
      presentationById(fighter.id).battleFrame,
    ];
    for (const [width, height] of [
      [1440, 800],
      [1731, 800],
      [1420, 800],
      [1000, 800],
    ]) {
      const requested =
        Math.min(height, width / 1.45) *
        0.61 *
        ((fighter.displayHeight ?? 177) / 177);
      const size = victoryBodyHeight(sprite, requested, width, height, frames);
      assert.ok(
        Number.isFinite(size) && size > 0 && size <= requested,
        fighter.id,
      );
      for (const index of frames) {
        const frame = sprite.frames[index];
        const left =
          (cellWidth / 2 - frame.x + frame.slotX) / sprite.bodyHeight;
        const right = frame.width / sprite.bodyHeight - left;
        const top =
          (sprite.baseline - frame.y + frame.slotY) / sprite.bodyHeight;
        // Include the sideways step/gesture and upward jump, on either side.
        assert.ok(
          (Math.max(left, right) + 0.18) * size <= width * 0.18 + 1e-6,
          `${fighter.id}: crosses into the title`,
        );
        assert.ok(
          height * 0.88 - (top + 0.24) * size >= height * 0.1 - 1e-6,
          `${fighter.id}: clips at the top`,
        );
      }
    }
  }
});
