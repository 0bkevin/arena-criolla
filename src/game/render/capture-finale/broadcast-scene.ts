import { body } from "./actors";
import { bubble, chair, damage, line, prop, text } from "./primitives";
import type { Scene } from "./scene";

export function drawBroadcastScene(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  if (actor === "chataing") {
    chair(scene, 341, 402, 1);
    chair(scene, 744, 402, -1);
    body(scene, actor, 341, 516, 291, 1, "talk");
    body(scene, rival, 744, 516, 291, -1, "seat");
    prop(scene, 543, 389, 366, 240);
    ctx.fillStyle = "#2f4256";
    ctx.fillRect(386, 385, 310, 27);
    line(ctx, [412, 410, 402, 518], "#778c9e", 8);
    line(ctx, [670, 410, 683, 518], "#778c9e", 8);
    for (let n = 0; n < 18; n++) {
      ctx.fillStyle = n % 3 ? "#8ee6bd" : "#e7d283";
      ctx.fillRect(
        412 + n * 15,
        436 - Math.abs(Math.sin(n + tick / 10)) * 40,
        9,
        Math.abs(Math.sin(n + tick / 10)) * 40 + 3,
      );
    }
    bubble(
      scene,
      tick < 90 ? "Una última pregunta…" : "Bueno, dos más y terminamos",
      538,
      186,
      277,
    );
  } else if (actor === "sarcos") {
    ctx.fillStyle = "#71501f";
    ctx.fillRect(678, 419, 179, 96);
    text(ctx, "GANADOR", 768, 482, 29);
    body(scene, actor, 295, 515, 303, 1, "perform");
    body(scene, rival, 767, 424, 248, -1, "perform");
    prop(scene, 521, 370, 312, 262);
    for (let n = 0; n < 3; n++) {
      ctx.fillStyle = ["#cd7278", "#7ba6c9", "#d2b563"][n];
      ctx.fillRect(413 + n * 86, 439, 70, 61);
      line(ctx, [446 + n * 86, 440, 446 + n * 86, 500], "#ffe1a3", 6);
      if (n <= scene.beat)
        text(ctx, "¡SORPRESA!", 448 + n * 86, 423 - (n % 2) * 18, 17);
    }
  } else {
    body(scene, actor, 338, 516, 307, 1, "perform");
    body(scene, rival, 737, 516, 294, -1, pulse ? "recoil" : "perform");
    prop(scene, 540, 323, 362, 260);
    for (let n = 0; n < 7; n++) {
      const x = 215 + n * 109,
        y = 224 + Math.sin(n * 1.7 + tick / 50) * 25 * scene.motion;
      line(ctx, [x - 5, y, x + 5, y, x, y - 7, x, y + 7], "#f6d88d", 2);
    }
  }
  damage(scene, 205);
}
