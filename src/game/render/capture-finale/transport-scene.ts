import { body } from "./actors";
import { TAU, clamp } from "./math";
import { damage, line, prop, ring } from "./primitives";
import type { Scene } from "./scene";

export function drawTransportScene(scene: Scene) {
  const { ctx, actor, rival, tick, motion, pulse } = scene;
  const progress = clamp((tick - 15) / 140);
  if (actor === "zavarce") {
    body(scene, actor, 252, 508, 292, 1, "stand");
    body(scene, rival, 756, 508, 282, -1, pulse ? "recoil" : "stand");
  } else if (actor === "reynaldo") {
    prop(scene, 553 + Math.sin(tick / 25) * 105 * motion, 369, 470, 326);
    body(scene, actor, 385, 503, 275, 1, "perform");
    body(scene, rival, 771, 500, 277, -1, "recoil");
    for (let n = 0; n < 3; n++)
      ring(scene, 773, 391, 62 + n * 23 + pulse * 15, "#f4cb78", 0.58);
  } else if (actor === "mcm") {
    for (let n = 0; n < 3; n++)
      line(
        ctx,
        [172, 239 + n * 15, 540, 270 + n * 10, 900, 235 + n * 16],
        ["#ffe180", "#7db8ed", "#ee9392"][n],
        7,
      );
    prop(scene, 537, 402, 540, 320);
    body(scene, actor, 410, 389, 218, 1, "perform");
    body(scene, rival, 656, 406, 220, -1, "recoil");
  } else if (actor === "juan") {
    for (let n = 0; n < 3; n++) {
      ring(
        scene,
        284 + n * 255,
        478,
        14,
        n <= scene.beat ? "#ffe398" : "#9fb5d155",
      );
      if (n < 2)
        line(ctx, [302 + n * 255, 478, 515 + n * 255, 478], "#9fb5d177", 3);
    }
    // The route moves through the arena; the captured riders stay in view.
    const x = 330 + Math.sin(progress * TAU) * 12 * motion;
    prop(scene, x, 384, 450, 250);
    body(scene, actor, x - 100, 396, 176, 1, "seat");
    body(scene, rival, x + 68, 396, 176, 1, "seat");
  } else {
    const x = 375 + Math.sin(progress * TAU) * 12 * motion;
    prop(scene, x, 413, 485, 263);
    body(scene, actor, x - 80, 442, 188, 1, "seat");
    body(scene, rival, x + 85, 442, 188, 1, "seat");

    for (let n = 0; n < 4; n++)
      line(
        ctx,
        [x - 255 - n * 24, 419 + n * 18, x - 292 - n * 24, 419 + n * 18],
        "#c7daef80",
        3,
      );
  }
  damage(scene, 210);
}
