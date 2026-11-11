import { body } from "./actors";
import { damage, line, ring, text } from "./primitives";
import type { Scene } from "./scene";

export function drawIconScene(scene: Scene) {
  const { actor, rival, tick, pulse, profile } = scene;
  body(scene, actor, 325, 516, 297, 1, "perform");
  body(scene, rival, 770, 516, 291, -1, pulse ? "recoil" : "stand");
  for (let n = 0; n < 3; n++) {
    const x = 570 + n * 80,
      y = 315 + Math.sin(tick / 24 + n) * 18 * scene.motion,
      color =
        actor === "bolivar"
          ? ["#ffe180", "#7db8ed", "#ee9392"][n]
          : profile.accent;
    drawIconGlyph(scene, n, x, y, color);
  }

  damage(scene, 205);
}
/** One of three repeated motifs for the canonical icons' finale. */
function drawIconGlyph(
  scene: Scene,
  n: number,
  x: number,
  y: number,
  color: string,
) {
  const { ctx, actor, pulse } = scene;
  if (actor === "lorenzo") {
    line(ctx, [x - 24, y, x + 24, y, x, y - 30, x, y + 30], color, 6);
    line(
      ctx,
      [x - 17, y - 20, x + 17, y + 20, x - 17, y + 20, x + 17, y - 20],
      color,
      3,
    );
  } else if (actor === "carolina" || actor === "bolivar") {
    line(
      ctx,
      [410, y + n * 24, x - 60, y - 55, x, y + 40, 840, y - 30],
      color,
      7,
    );
  } else if (actor === "dayana") {
    line(
      ctx,
      [
        x - 32,
        y + 20,
        x - 37,
        y - 20,
        x - 12,
        y,
        x,
        y - 36,
        x + 12,
        y,
        x + 37,
        y - 20,
        x + 32,
        y + 20,
        x - 32,
        y + 20,
      ],
      color,
      5,
    );
  } else if (actor === "edgar") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 31, y - 25, 62, 50);
    line(
      ctx,
      [
        x - 31,
        y - 12,
        x + 31,
        y - 12,
        x - 31,
        y - 25,
        x - 12,
        y - 12,
        x + 5,
        y - 25,
        x + 23,
        y - 12,
      ],
      color,
      3,
    );
    text(ctx, String(n + 1), x, y + 14, 20, color);
  } else {
    ring(scene, x, y, 22 + pulse * 20 + n * 6, color, 0.8);
    line(
      ctx,
      [370, 360, 405, 360, 405, 405, 370, 405, 370, 360, 386, 360, 386, 435],
      color,
      5,
    );
  }
}
