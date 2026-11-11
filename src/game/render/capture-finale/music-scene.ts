import { body } from "./actors";
import { bubble, damage, line, note, prop, ring, text } from "./primitives";
import type { Scene } from "./scene";

export function drawMusicScene(scene: Scene) {
  const { ctx, actor, rival, tick, pulse, motion } = scene;
  const conductor = actor === "dudamel",
    water = actor === "yordano",
    neon = actor === "danny",
    duel = actor === "florentino";
  body(
    scene,
    rival,
    783,
    510,
    290,
    -1,
    duel ? "seat" : pulse ? "recoil" : "stand",
  );
  body(
    scene,
    actor,
    conductor ? 347 : 330,
    510,
    305,
    1,
    duel ? "talk" : "perform",
  );
  prop(
    scene,
    conductor ? 520 : water ? 488 : 455,
    359,
    conductor ? 360 : water ? 420 : 280,
    285,
  );
  if (conductor) drawConductorSweeps(scene);
  else if (water) drawWaterSong(scene);
  else if (neon) drawNeonHeart(scene);
  else if (duel) drawContrapunteo(scene);
  else drawSoundRings(scene);
  for (let n = 0; n < 4; n++)
    note(
      ctx,
      530 + n * 72,
      223 + Math.sin(tick / 28 + n) * 15 * motion,
      9,
      "#ead6a2aa",
    );
  damage(scene, 204);
}
function drawConductorSweeps(scene: Scene) {
  const { ctx, tick, motion } = scene;
  // Conducting sweeps hit the music stand, then the opponent, in three accents.
  const angle = Math.sin(tick / 22) * 0.5 * motion;
  line(
    ctx,
    [382, 304, 458 + Math.sin(angle) * 40, 251 - Math.cos(angle) * 32],
    "#fff0cc",
    3,
  );
  for (let n = 0; n < 5; n++) {
    line(ctx, [479, 327 + n * 12, 898, 327 + n * 12], "#c9d5ee35", 1);
    note(
      ctx,
      530 + n * 63,
      350 + Math.sin(n + tick / 20) * 26 * motion,
      12,
      "#fff2bc",
    );
  }
}
function drawWaterSong(scene: Scene) {
  const { ctx } = scene;
  for (let n = 0; n < 3; n++) {
    ctx.strokeStyle = `#9bd9ef${n === scene.beat ? "bb" : "55"}`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(482, 486 - n * 25);
    ctx.bezierCurveTo(580, 370 - n * 20, 681, 555 - n * 15, 891, 431 - n * 34);
    ctx.stroke();
  }
}
function drawNeonHeart(scene: Scene) {
  const { ctx, pulse } = scene;
  const p = pulse * 25;
  ctx.strokeStyle = "#f7a5dc";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(638, 310 + p);
  ctx.bezierCurveTo(499, 225 - p, 540, 165, 636, 229);
  ctx.bezierCurveTo(731, 165, 791, 229, 638, 310 + p);
  ctx.stroke();
  for (let n = 0; n < 3; n++)
    ring(scene, 693, 428, 93 + n * 25, "#9fe9ec88", 0.47);
}
function drawContrapunteo(scene: Scene) {
  const { ctx, tick } = scene;
  bubble(
    scene,
    tick < 75 ? "Te respondo con un verso" : "¡Que conteste la sabana!",
    583,
    191,
    278,
  );
  for (let n = 0; n < 3; n++) {
    ctx.fillStyle = "#edce9670";
    ctx.fillRect(478, 294 + n * 52, 210 + n * 26, 23);
    text(
      ctx,
      ["COPLA", "RESPUESTA", "CONTRAPUNTEO"][n],
      584 + n * 13,
      312 + n * 52,
      18,
      "#2c211b",
    );
  }
}
function drawSoundRings(scene: Scene) {
  const { ctx, actor, tick } = scene;
  for (let n = 0; n < 4; n++) {
    const p = (tick / 90 + n / 4) % 1;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ring(
      scene,
      410 + p * 374,
      326,
      25 + p * 85,
      actor === "ali" ? "#f4dd95" : scene.profile.accent,
      1.25,
    );
    ctx.restore();
  }
}
