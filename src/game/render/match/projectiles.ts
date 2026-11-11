import { fighterById } from "../../../../shared/roster/roster";
import type { MatchState, Projectile } from "../../../../shared/engine/engine";
import { drawAttackArt } from "../../assets/attack-art";
import { drawArenaFinaleProjectile } from "../arena-finale-renderer";
import { drawCourierMotorcycle } from "../courier-renderer";
import { drawCultureProjectile } from "../culture-renderer";
import { drawWiredMicrophone } from "../finales/chataing";
import { drawCocoProjectile } from "../finales/coco";
import { drawDeynaBallProjectile } from "../finales/deyna";
import { drawDudamelProjectile } from "../finales/dudamel";
import { drawInakiProjectile } from "../finales/inaki";
import { drawLloronaProjectile } from "../finales/llorona";
import { drawLorenzoProjectile } from "../finales/lorenzo";
import { drawSonicProjectile } from "../finales/maite";
import { drawMelanioSignal } from "../finales/melanio";
import { drawFolkloreProjectile } from "../folklore-renderer";
import { drawFounderProjectile } from "../founder-renderer";
import { drawIconProjectile } from "../icon-renderer";
import type { Assets } from "./match-assets";

export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  time: number,
  reducedMotion: boolean,
) {
  for (const projectile of state.projectiles) {
    if (
      projectile.tether &&
      state.players[projectile.owner].config.fighter === "chataing"
    )
      continue;
    drawProjectile(ctx, state, assets, projectile, time, reducedMotion);
  }
}

/** Each shot travels in its own glowing frame, mirrored to its direction. */
function drawProjectile(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  projectile: Projectile,
  time: number,
  reducedMotion: boolean,
) {
  const color = fighterById(
    state.players[projectile.owner].config.fighter,
  ).color;
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.scale(
    Math.sign(projectile.vx) ||
      projectile.direction ||
      state.players[projectile.owner].facing,
    1,
  );
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  if (
    drawInakiProjectile(ctx, assets.finaleProps, projectile, reducedMotion) ||
    drawArenaFinaleProjectile(ctx, assets.finaleProps, projectile)
  ) {
    // Original artwork is retained when a projectile changes owners.
  } else if (projectile.kind === "sonic") {
    drawSonicProjectile(ctx, projectile, reducedMotion);
  } else if (projectile.kind === "courier") {
    if (assets.courier)
      drawCourierMotorcycle(ctx, projectile, assets.courier, reducedMotion);
  } else if (
    drawLloronaProjectile(ctx, assets.finaleProps, projectile) ||
    drawDudamelProjectile(ctx, projectile) ||
    drawLorenzoProjectile(ctx, assets.finaleProps, projectile) ||
    drawDeynaBallProjectile(ctx, assets.finaleProps, projectile) ||
    drawMelanioSignal(ctx, assets.finaleProps, projectile) ||
    drawCocoProjectile(ctx, assets.finaleProps, projectile) ||
    drawIconProjectile(ctx, projectile) ||
    drawFounderProjectile(ctx, projectile) ||
    drawCultureProjectile(ctx, projectile) ||
    drawFolkloreProjectile(ctx, projectile)
  ) {
    // The folklore effects share the same glow and transform as other shots.
  } else if (projectile.kind === "installments") {
    drawInstallmentsBox(ctx, state, assets, projectile);
  } else if (projectile.kind === "cuatro") {
    drawThrownCuatro(ctx, time);
  } else if (projectile.kind === "static") {
    // Community users of the technique retain a visible physical microphone.
    drawWiredMicrophone(
      ctx,
      assets.finaleProps,
      { x: 0, y: 0 },
      1,
      0,
      40,
      false,
    );
  } else if (projectile.kind === "broadcast") {
    drawBroadcastWave(ctx);
  } else {
    drawShockwave(ctx);
  }
  ctx.restore();
}
function drawInstallmentsBox(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  projectile: Projectile,
) {
  ctx.shadowBlur = 0;
  ctx.rotate(Math.sin((projectile.age ?? 0) / 9) * 0.08);
  // Keep the printed C readable when the projectile travels left.
  const painted = drawAttackArt(
    ctx,
    assets.finaleProps,
    "vallenilla",
    "box",
    0,
    23,
    46,
    Math.sign(projectile.vx) ||
      projectile.direction ||
      state.players[projectile.owner].facing,
  );
  if (!painted) {
    // Failed optional artwork must not leave a damaging projectile invisible.
    ctx.fillStyle = "#fff52c";
    ctx.strokeStyle = "#30312d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-21, -21, 42, 42, 7);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.scale(Math.sign(projectile.vx) || projectile.direction || 1, 1);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.restore();
  }
}
function drawThrownCuatro(ctx: CanvasRenderingContext2D, time: number) {
  ctx.rotate(Math.sin(time / 100) * 0.12);
  ctx.beginPath();
  ctx.ellipse(-5, 9, 9, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(2, -18, 3, 28);
  ctx.fillRect(3, -18, 13, 4);
}
function drawBroadcastWave(ctx: CanvasRenderingContext2D) {
  for (let ring = 0; ring < 3; ring++) {
    ctx.globalAlpha = 1 - ring * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + ring * 8, -1.25, 1.25);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
}
function drawShockwave(ctx: CanvasRenderingContext2D) {
  for (let j = 0; j < 3; j++) {
    ctx.globalAlpha = 1 - j * 0.25;
    ctx.beginPath();
    ctx.arc(-j * 12, 0, 19 + j * 3, -1.1, 1.1);
    ctx.stroke();
  }
}
