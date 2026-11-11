import hackerDesk from "../../assets/manifests/finale-desk-assets.json";
import { body } from "./actors";
import { bubble, chair, damage, ellipse, line, prop, text } from "./primitives";
import type { Scene } from "./scene";

export function drawHackScene(scene: Scene) {
  if (scene.actor === "giuseppe") drawGiuseppeHack(scene);
  else drawDeviceHack(scene);
  damage(scene, 195);
}
function drawGiuseppeHack(scene: Scene) {
  const { ctx, actor, rival, tick, pulse } = scene;
  chair(scene, 315, 405, 1);
  body(scene, actor, 315, 522, 295, 1, "type");
  body(scene, rival, 785, 513, 291, -1, pulse ? "recoil" : "stand");
  drawHackerDesk(scene);
  line(ctx, [502, 353, 592, 353, 592, 260, 780, 260, 780, 208], "#68e7b87d", 4);
  for (let n = 0; n < 4; n++) {
    const fraction = (tick * 0.015 + n / 4) % 1;
    ellipse(
      ctx,
      770 - fraction * 200,
      260 + Math.sin(fraction * Math.PI) * 4,
      5,
      5,
      "#bcffe4",
    );
  }

  text(
    ctx,
    tick > 138
      ? "DESCARGA COMPLETA"
      : `${Math.min(99, Math.floor(tick / 1.4))}% · ENERGÍA EN TRANSFERENCIA`,
    605,
    426,
    18,
    "#a4f1d1",
  );
}
function drawHackerDesk(scene: Scene) {
  const { ctx } = scene;
  const desk = scene.props[hackerDesk.file];
  if (desk?.width && desk.height) {
    const frame = hackerDesk.frame;
    const height = 230;
    const width = (height * frame.width) / frame.height;
    const position = scene.layout.point(448, 522);
    // The keyboard is on Giuseppe's left-facing side of the lid. Preserve
    // the furniture's own aspect ratio and the human scale of the laptop.
    ctx.drawImage(
      desk,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      position.x - width / 2,
      position.y - height,
      width,
      height,
    );
  } else {
    line(ctx, [365, 375, 365, 520, 525, 520, 525, 375], "#593b2b", 10);
    ctx.fillStyle = "#96643e";
    ctx.fillRect(352, 360, 188, 15);
    line(ctx, [372, 357, 427, 357], "#6e7788", 7);
    ctx.fillStyle = "#303747";
    ctx.beginPath();
    ctx.moveTo(426, 357);
    ctx.lineTo(435, 292);
    ctx.lineTo(480, 286);
    ctx.lineTo(469, 350);
    ctx.closePath();
    ctx.fill();
    line(ctx, [426, 357, 435, 292], "#8af3c5", 2);
  }
}
function drawDeviceHack(scene: Scene) {
  const { actor, rival, pulse } = scene;
  body(
    scene,
    actor,
    302,
    515,
    296,
    1,
    actor === "enrique" ? "type" : "perform",
  );
  body(scene, rival, 785, 515, 290, -1, pulse ? "recoil" : "stand");
  prop(scene, 540, 355, actor === "lele" ? 268 : 330, 280);
  if (actor === "vallenilla") drawInstallmentCards(scene);
  else if (actor === "enrique") drawLedger(scene);
  else if (actor === "jesus") drawCoinTransfer(scene);
  else if (actor === "victor") drawSignalBars(scene);
  else if (actor === "lele") drawLiveStream(scene);
}
function drawInstallmentCards(scene: Scene) {
  const { ctx, tick } = scene;
  for (let n = 0; n < 3; n++) {
    const y = 340 + n * 54,
      slide = Math.sin((tick - n * 14) / 32) * 20 * scene.motion;
    const card = scene.layout.point(650 + slide, y + 22);
    ctx.fillStyle = ["#ef6c6c", "#78b7e1", "#edc477"][n];
    ctx.beginPath();
    ctx.roundRect(card.x - 44, card.y - 22, 88, 44, 7);
    ctx.fill();
    text(ctx, `${n + 1}/3`, card.x, card.y + 8, 23, "#19253a");
  }
}
function drawLedger(scene: Scene) {
  const { ctx } = scene;
  for (let n = 0; n < 5; n++)
    line(ctx, [460, 293 + n * 25, 603, 293 + n * 25], "#d8e5ba50", 2);
  bubble(
    scene,
    scene.beat < 0
      ? "Vamos a revisar la cuenta"
      : ["DÉBITO", "BALANCE", "CAJA CERRADA"][scene.beat],
    608,
    195,
    235,
  );
}
function drawCoinTransfer(scene: Scene) {
  const { ctx, tick } = scene;
  line(ctx, [410, 320, 689, 320], "#8ce6dc", 3);
  for (let n = 0; n < 7; n++) {
    const p = (tick / 65 + n / 7) % 1;
    ellipse(
      ctx,
      690 - p * 280,
      320 - Math.sin(p * Math.PI) * 44,
      10,
      12,
      "#f4cc65",
    );
  }
}
function drawSignalBars(scene: Scene) {
  const { ctx } = scene;
  for (let n = 0; n < 3; n++)
    line(
      ctx,
      [605 + n * 46, 412, 710 + n * 46, 224],
      n <= scene.beat ? "#c6ffe5" : "#8ee8cb40",
      n <= scene.beat ? 7 : 2,
    );
}
function drawLiveStream(scene: Scene) {
  const { ctx, tick } = scene;
  ctx.strokeStyle = "#f7b2d6";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(647, 208, 258, 317, 23);
  ctx.stroke();
  ellipse(ctx, 671, 231, 5, 5, "#ffb6d9");
  text(ctx, "EN DIRECTO", 737, 238, 19, "#ffcee7");
  for (let n = 0; n < 5; n++)
    text(
      ctx,
      ["¡JA!", "+1", "¡JA!", "+1", "¡JA!"][n],
      888 + Math.sin(n) * 17,
      480 - ((tick * scene.motion + n * 35) % 200),
      19,
      "#ffb9dc",
    );
}
