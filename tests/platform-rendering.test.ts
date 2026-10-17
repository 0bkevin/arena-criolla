import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, platformsAtTick } from "../shared/content";
import { drawStage } from "../src/game/stage-renderer";

test("every visible platform lip follows the collision surface throughout motion and reversals", () => {
  const rectangles: { x: number; y: number; width: number; height: number }[] =
    [];
  const context = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "fillRect")
          return (x: number, y: number, width: number, height: number) =>
            rectangles.push({ x, y, width, height });
        if (key === "createLinearGradient")
          return () => ({ addColorStop() {} });
        return () => {};
      },
      set() {
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  for (const stage of STAGES) {
    const period = stage.platforms.find((p) => p.motion)?.motion?.period ?? 1;
    for (let sample = 0; sample <= 16; sample++) {
      const tick = Math.round((sample * period) / 16);
      rectangles.length = 0;
      drawStage(
        context,
        stage,
        { naturalWidth: 1080, naturalHeight: 640 } as HTMLImageElement,
        tick,
      );
      for (const [index, platform] of platformsAtTick(
        stage.id,
        tick,
      ).entries()) {
        const lip = rectangles.find(
          (r) =>
            r.width === platform.width &&
            r.height === 4 &&
            Math.abs(r.x - platform.x) <= 1 &&
            Math.abs(r.y - platform.y) <= 1,
        );
        assert.ok(
          lip,
          `${stage.id}:${index} tick ${tick}: visible lip diverged from physics`,
        );
        assert.ok(
          Math.abs(lip.y - platform.y) <= 1,
          "pixel rounding stays within one world pixel",
        );
      }
    }
  }
});
