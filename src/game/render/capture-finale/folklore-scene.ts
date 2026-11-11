import { body } from "./actors";
import { TAU } from "./math";
import { bubble, damage, ellipse, line, prop, ring } from "./primitives";
import type { Scene } from "./scene";

export function drawFolkloreScene(scene: Scene) {
  const { actor, rival, tick, pulse } = scene;
  const river = actor === "llorona" || actor === "momoy";
  body(scene, actor, actor === "tiotigre" ? 344 : 306, 514, 304, 1, "perform");
  body(
    scene,
    rival,
    782,
    actor === "tioconejo" && tick > 90 ? 532 : 514,
    287,
    -1,
    pulse ? "recoil" : "stand",
  );
  prop(
    scene,
    529,
    actor === "lionza" ? 389 : actor === "knoche" ? 405 : 359,
    actor === "lionza" ? 427 : actor === "knoche" ? 254 : 340,
    actor === "knoche" ? 220 : 294,
  );
  if (river) drawRiver(scene);
  else if (actor === "sayona") drawSayonaApparitions(scene);
  else if (actor === "silbon") drawSilbonBones(scene);
  else if (actor === "diablo") drawDiabloFlames(scene);
  else if (actor === "knoche") drawKnocheJars(scene);
  else if (actor === "tiotigre") drawClawMarks(scene);
  else if (actor === "tioconejo") drawRabbitTrap(scene);
  else drawSpiritCircle(scene);
  damage(scene, 205);
}
function drawRiver(scene: Scene) {
  const { ctx, actor, tick, motion } = scene;
  for (let n = 0; n < 5; n++) {
    ctx.strokeStyle = n % 2 ? "#a7d6df66" : "#9dcde9aa";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(211, 479 + n * 10);
    ctx.bezierCurveTo(
      401,
      433 + n * 12 + Math.sin(tick / 30) * 12 * motion,
      602,
      547,
      891,
      466 + n * 10,
    );
    ctx.stroke();
  }
  if (actor === "momoy")
    for (let n = 0; n < 8; n++)
      ring(
        scene,
        700 + Math.sin(n * 3.1) * 120,
        455 + Math.cos(n) * 48,
        8 + (n % 3) * 3,
        "#b6ecd699",
        0.5,
      );
  else
    for (let n = 0; n < 10; n++)
      ellipse(
        ctx,
        650 + n * 21,
        221 + ((tick * motion + n * 37) % 248),
        3,
        7,
        "#bce3ef9c",
      );
}
function drawSayonaApparitions(scene: Scene) {
  const { ctx, actor } = scene;
  ctx.save();
  ctx.globalAlpha = 0.26;
  body(scene, actor, 648, 517, 290, 1, "stand");
  body(scene, actor, 898, 517, 290, -1, "stand");
  ctx.restore();
  for (let n = 0; n < 5; n++) {
    const x = 635 + n * 69;
    line(ctx, [x, 495, x, 471], "#f1dfb9", 6);
    ellipse(ctx, x, 462, 4, 9, "#e9bd80");
  }
}
function drawSilbonBones(scene: Scene) {
  const { ctx, tick, pulse, motion } = scene;
  for (let n = 0; n < 5; n++) {
    const a = (n / 5) * TAU + (tick / 40) * motion,
      x = 771 + Math.cos(a) * (86 + n * 4),
      y = 357 + Math.sin(a) * 105;
    line(ctx, [x - 9, y - 8, x + 9, y + 8], "#e7dec7", 6);
    ellipse(ctx, x - 10, y - 9, 5, 5, "#e7dec7");
    ellipse(ctx, x + 10, y + 9, 5, 5, "#e7dec7");
  }
  for (let n = 0; n < 3; n++)
    ring(scene, 756, 337, 88 + n * 31 + pulse * 13, "#b9ddc65c", 1.14);
}
function drawDiabloFlames(scene: Scene) {
  const { ctx, tick, pulse, motion } = scene;
  for (let n = 0; n < 13; n++) {
    const x = 586 + n * 28,
      y = 493 - Math.sin(n * 0.8 + tick / 24) * 5 * motion;
    ellipse(ctx, x, y, 9, 23 + pulse * 10, n % 2 ? "#d88452aa" : "#f0bc73aa");
  }
}
function drawKnocheJars(scene: Scene) {
  const { ctx, tick, motion } = scene;
  for (let n = 0; n < 3; n++) {
    ellipse(
      ctx,
      510 + n * 51,
      398,
      15,
      21,
      ["#c1b5df", "#a5d7c3", "#e6c28c"][n],
    );
    const rise = (tick * motion + n * 45) % 160;
    ellipse(
      ctx,
      664 + n * 46,
      416 - rise,
      26 + rise * 0.22,
      22 + rise * 0.17,
      "#c9d5d32b",
    );
  }
}
function drawClawMarks(scene: Scene) {
  const { ctx } = scene;
  for (let n = 0; n < 3; n++) {
    const x = 684 + n * 44;
    line(
      ctx,
      [x, 280, x + 46, 414],
      n <= scene.beat ? "#ffe3aa" : "#dcb99344",
      7,
    );
  }
}
function drawRabbitTrap(scene: Scene) {
  const { ctx, tick } = scene;
  line(ctx, [424, 411, 607, 500, 816, 500], "#d6c28f", 3);
  if (tick > 90) {
    ellipse(ctx, 792, 515, 89, 22, "#0b1516");
    ring(scene, 792, 500, 74, "#a4b49a", 0.3);
  }
  bubble(
    scene,
    tick < 90 ? "Una ayudita, compadre…" : "¡Cuidado con el caminito!",
    545,
    186,
    276,
  );
}
function drawSpiritCircle(scene: Scene) {
  const { ctx, tick, motion } = scene;
  for (let n = 0; n < 12; n++) {
    const a = (n / 12) * TAU + (tick / 180) * motion;
    ellipse(
      ctx,
      740 + Math.cos(a) * 147,
      373 + Math.sin(a) * 116,
      11,
      5,
      n % 2 ? "#a2d4b7aa" : "#e7d18caa",
    );
  }
}
