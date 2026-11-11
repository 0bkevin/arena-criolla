import { body } from "./actors";
import { sampleFinaleDance } from "./choreography";
import { TAU } from "../../../../shared/math";
import { damage, ellipse, line, note, prop, text } from "./primitives";
import type { Scene } from "./scene";

const NACHO_FINALE_LYRICS = [
  "Síii",
  "Voy a aceptar que soy",
  "Un perro mujeriego",
  "que conoció el amor",
  "Y lo quiere a su lado",
  "hasta viejo",
  "Con la mente en las nubes",
  "y los pies en el suelo",
];
export function drawDanceScene(scene: Scene) {
  const { ctx, actor, rival, tick, motion } = scene;
  const nacho = actor === "nacho",
    salsa = actor === "oscar",
    joropo = actor === "rummy";
  const period = nacho ? 45 : joropo ? 30 : 40;
  const rhythm = Math.sin((tick / period) * TAU) * motion;
  if (actor === "lila") {
    prop(scene, 538, 318, 365, 280);
    for (let n = 0; n < 3; n++)
      ellipse(
        ctx,
        480 + n * 60,
        385 + Math.sin(tick / 25 + n) * 16 * motion,
        10,
        12,
        "#b77b43",
      );
  } else if (joropo) {
    prop(scene, 210, 357, 226, 255);
    for (let n = 0; n < 8; n++) {
      const x = 250 + n * 83;
      const y = 510 + Math.sin(n * 1.4) * 7;
      ellipse(ctx, x, y, 5, 4, n % 2 ? "#eb91a6" : "#f7d37d");
    }
  } else if (salsa) prop(scene, 285, 338, 215, 276);
  else if (!nacho) prop(scene, 540, 305, 290, 190, 0.75);
  const pair = sampleFinaleDance(tick, !motion);
  const walk = nacho ? pair.dx : rhythm * (joropo ? 20 : salsa ? 38 : 29);
  const feet = nacho
    ? 504 + pair.dy
    : 504 - Math.abs(rhythm) * (joropo ? 13 : 5);
  body(scene, actor, 382 + walk, feet, 302, 1, "dance");
  body(scene, rival, 699 + walk, feet, 293, 1, "dance");
  if (nacho) {
    ctx.save();
    ctx.shadowColor = "#11151f";
    ctx.shadowBlur = 5;
    // Lyrics follow the scene clock even when the dancers use reduced motion.
    text(ctx, NACHO_FINALE_LYRICS[sampleFinaleDance(tick).frame], 540, 190, 30);
    ctx.restore();
  }

  for (let n = 0; n < 5; n++)
    note(
      ctx,
      250 + n * 143,
      251 - Math.sin(tick / 29 + n) * 17 * motion,
      10,
      `${scene.profile.accent}cc`,
    );
  if (motion)
    for (const x of [382 + walk, 699 + walk]) {
      line(ctx, [x - 28, 518, x - 5 + rhythm * 10, 518], "#ffe6b1", 4);
    }
  damage(scene);
}
