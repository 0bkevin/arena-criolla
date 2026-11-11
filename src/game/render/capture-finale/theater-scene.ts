import { body } from "./actors";
import { clamp } from "../../../../shared/math";
import { bubble, chair, damage, line, prop, ring, text } from "./primitives";
import type { Scene } from "./scene";

export function drawTheaterScene(scene: Scene) {
  const { actor } = scene;
  if (actor === "george") drawFrontRowJoke(scene);
  else if (actor === "gabriela") drawMirrorDouble(scene);
  else if (actor === "chiqui") drawDanceFloor(scene);
  else drawStagePlay(scene);
  damage(scene, 204);
}
function drawFrontRowJoke(scene: Scene) {
  const { ctx, actor, rival, tick } = scene;
  chair(scene, 766, 411, -1);
  body(scene, rival, 766, 523, 291, -1, "seat");
  body(scene, actor, 333, 518, 308, 1, "talk");
  prop(scene, 489, 367, 272, 282);
  bubble(
    scene,
    tick < 78 ? "Tú, el de primera fila…" : "¡Esa cara es el remate!",
    541,
    184,
    268,
  );
  if (scene.beat >= 0)
    text(
      ctx,
      ["JA", "JA, JA", "JA, JA, JA"][scene.beat],
      750,
      254,
      32,
      "#ffe4a2",
    );
}
function drawMirrorDouble(scene: Scene) {
  const { ctx, actor, rival, pulse } = scene;
  for (const x of [331, 664]) {
    ctx.fillStyle = "#7b637c";
    ctx.strokeStyle = "#d4b9ad";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(x - 83, 211, 166, 293, 63);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.63;
    body(scene, actor, x, 501, 268, x < 500 ? 1 : -1, "perform", 0, false);
    ctx.restore();
  }
  body(scene, actor, 475, 524, 287, 1, "perform");
  body(scene, rival, 826, 523, 277, -1, pulse ? "recoil" : "stand");
  prop(scene, 540, 402, 194, 160);
  bubble(scene, "¿Cuál de las dos soy?", 540, 181, 236);
}
function drawDanceFloor(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  const move = Math.sin(tick / 45) * 37 * scene.motion;
  body(scene, actor, 393 + move, 515, 301, 1, "dance");
  body(scene, rival, 684 + move, 515, 291, 1, "dance");
  prop(scene, 540, 341, 238, 170, 0.75);

  for (const x of [202, 889]) {
    ctx.strokeStyle = "#d5ddea";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 352, 38, 25);
    line(
      ctx,
      [x + 19, 379, x + 1, 478, x + 19, 379, x + 39, 478],
      "#a7b7cb",
      3,
    );
    ring(scene, x + 19, 362, 31 + pulse * 24, "#fff1c29c");
  }
}
function drawStagePlay(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  body(scene, actor, actor === "amanda" ? 422 : 306, 522, 304, 1, "perform");
  body(scene, rival, 790, 522, 289, -1, pulse ? "recoil" : "stand");
  prop(
    scene,
    actor === "amanda" ? 540 : 520,
    actor === "norkys" ? 370 : 338,
    actor === "emilio" ? 344 : 298,
    273,
  );
  bubble(scene, stagePlayLine(scene), 542, 182, 281);
  if (actor === "emilio" && tick > 105) {
    const p = clamp((tick - 105) / 65);
    prop(scene, 930 - p * 420 * scene.motion, 466, 231, 142);
  }
  if (actor === "conde")
    for (let n = 0; n < 3; n++)
      text(
        ctx,
        "JA",
        660 + n * 83,
        291 + Math.sin(tick / 20 + n) * 20 * scene.motion,
        24,
        "#f0d597",
      );
  if (actor === "norkys")
    for (let n = 0; n < 3; n++)
      text(
        ctx,
        `${n + 1} · TOMA`,
        629,
        322 + n * 39,
        21,
        n <= scene.beat ? "#ffdf9f" : "#b7c4d277",
      );
}
function stagePlayLine({ actor, tick }: Scene) {
  return actor === "conde"
    ? "¡Que siga la función!"
    : actor === "emilio"
      ? [
          "¡Cambio de personaje!",
          "Otra máscara, otro remate",
          "¡Todos al autobús!",
        ][Math.min(2, Math.floor(tick / 60))]
      : actor === "norkys"
        ? ["Tu escena empieza ahora", "¡Repitamos esa toma!", "¡Corten!"][
            Math.min(2, Math.floor(tick / 60))
          ]
        : "Silencio, empieza la función";
}
