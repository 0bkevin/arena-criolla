import type { Ability } from "../../shared/content";
import type { PlayerState, Projectile } from "../../shared/engine";
import { drawSprite, type SpriteAsset } from "./assets";

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const size = point % 2 ? radius * 0.45 : radius;
    const px = x + Math.cos(angle) * size,
      py = y + Math.sin(angle) * size;
    if (!point) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawCultureProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
): boolean {
  const age = shot.age ?? 0;
  switch (shot.kind) {
    case "strum":
      ctx.lineWidth = 3;
      for (let string = 0; string < 4; string++) {
        ctx.beginPath();
        ctx.moveTo(-38, string * 7 - 14);
        ctx.bezierCurveTo(
          -8,
          -32 + string * 7,
          20,
          26 - string * 6,
          42,
          string * 7 - 14,
        );
        ctx.stroke();
      }
      break;
    case "tremolo":
      ctx.rotate(Math.sin(age / 5) * 0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 25, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let tick = -1; tick <= 1; tick++) {
        ctx.beginPath();
        ctx.moveTo(tick * 10, -20);
        ctx.lineTo(tick * 10, 20);
        ctx.stroke();
      }
      break;
    case "lasso":
      ctx.strokeStyle = "#ffe49e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(6, 0, 26, 35, Math.sin(age / 5) * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, 20);
      ctx.bezierCurveTo(-35, 35, -45, -12, -68, 6);
      ctx.stroke();
      break;
    case "crescendo": {
      const radius = shot.radius ?? 12;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-radius * 0.16, -radius * 0.14, radius * 0.66, -2.7, -0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      for (let bar = -2; bar <= 2; bar++) {
        const h = (0.2 + Math.abs(Math.sin(age / 5 + bar)) * 0.5) * radius;
        ctx.fillRect((bar * radius) / 4 - 2, -h / 2, 4, h);
      }
      break;
    }
    case "jackpot":
      ctx.rotate(age / 12);
      ctx.beginPath();
      ctx.roundRect(-21, -20, 42, 40, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff2b8";
      ctx.fillRect(-3, -20, 6, 40);
      ctx.fillRect(-21, -3, 42, 6);
      ctx.beginPath();
      ctx.ellipse(-8, -25, 9, 5, 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(8, -25, 9, 5, -0.6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "fountain":
      ctx.rotate(Math.atan2(shot.vy ?? 0, Math.abs(shot.vx)));
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.quadraticCurveTo(15, -22, 23, 0);
      ctx.quadraticCurveTo(15, 22, -28, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#dcfdff";
      ctx.beginPath();
      ctx.ellipse(10, -3, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "cocotero":
      ctx.rotate(Math.sin(age / 6) * 0.25);
      ctx.fillStyle = "#8cec95";
      ctx.strokeStyle = "#eaffb0";
      ctx.beginPath();
      ctx.moveTo(-25, 11);
      ctx.quadraticCurveTo(-6, -25, 31, -9);
      ctx.quadraticCurveTo(7, 13, -25, 11);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-25, 11);
      ctx.lineTo(24, -5);
      ctx.stroke();
      break;
    case "audit":
      ctx.strokeStyle = "#b8ffdf";
      ctx.lineWidth = 3;
      ctx.strokeRect(-19, -16, 38, 32);
      for (let bit = 0; bit < 6; bit++) {
        ctx.globalAlpha = (age + bit) % 6 < 3 ? 0.95 : 0.4;
        ctx.fillRect(-12 + (bit % 3) * 9, -9 + Math.floor(bit / 3) * 11, 5, 6);
      }
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-30, -14);
      ctx.lineTo(-42, 0);
      ctx.lineTo(-30, 14);
      ctx.stroke();
      break;
    case "prank":
      ctx.globalAlpha = age < (shot.armAfter ?? 0) ? 0.42 + (age % 8) / 20 : 1;
      ctx.fillStyle = "#ffe460";
      ctx.strokeStyle = "#725823";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, 16);
      ctx.quadraticCurveTo(-4, 16, 0, -12);
      ctx.quadraticCurveTo(5, 15, 27, 17);
      ctx.lineTo(10, 24);
      ctx.lineTo(0, 9);
      ctx.lineTo(-8, 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    default:
      return false;
  }
  return true;
}

export function drawCultureSpecial(
  ctx: CanvasRenderingContext2D,
  ability: Ability,
  p: PlayerState,
  rival: PlayerState,
  sprite: SpriteAsset,
  progress: number,
) {
  ctx.save();
  const x = p.x,
    y = p.y - 75;
  if (ability === "mirror") {
    if (progress > 4 && progress < 26 && Math.abs(rival.x - p.x) < 245) {
      ctx.globalAlpha = 0.32 * Math.sin(((progress - 4) * Math.PI) / 22);
      drawSprite(
        ctx,
        sprite,
        5,
        rival.x + p.facing * 90,
        rival.y,
        177,
        -p.facing,
      );
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(
        rival.x + p.facing * 90,
        rival.y - 75,
        38,
        80,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (ability === "curtain") {
    ctx.globalAlpha = p.attackTick >= 6 && p.attackTick <= 26 ? 0.7 : 0.2;
    const front = x + p.facing * 58;
    ctx.beginPath();
    ctx.moveTo(front - 20, y - 70);
    ctx.lineTo(front + 20, y - 70);
    ctx.lineTo(front + 15, y + 72);
    ctx.lineTo(front - 15, y + 72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let fold = -1; fold <= 1; fold++) {
      ctx.beginPath();
      ctx.moveTo(front + fold * 11, y - 65);
      ctx.lineTo(front + fold * 8, y + 65);
      ctx.stroke();
    }
  } else if (ability === "syncopate" || ability === "zapateo") {
    for (let step = 0; step < 4; step++) {
      const phase = (p.attackTick + step * 10) % 40;
      ctx.globalAlpha = (1 - phase / 40) * 0.6;
      ctx.beginPath();
      ctx.ellipse(
        x - p.facing * step * 28,
        p.y - 3,
        18 + phase * 1.1,
        6 + phase * 0.25,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (ability === "runway") {
    for (let trail = 0; trail < 4; trail++) {
      ctx.globalAlpha = 0.6 - trail * 0.12;
      star(ctx, x - p.facing * (32 + trail * 30), y - 20 + (trail % 2) * 30, 8);
    }
  } else if (ability === "pivot") {
    ctx.beginPath();
    ctx.arc(x, y, 87, -1.7 + progress / 6, 0.8 + progress / 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 99, 1.7 + progress / 6, 3.2 + progress / 6);
    ctx.stroke();
  } else if (ability === "jackpot") {
    star(ctx, x + p.facing * 55, y - 15, 16);
  } else if (
    ability === "strum" ||
    ability === "tremolo" ||
    ability === "fountain"
  ) {
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.arc(
        x + p.facing * 30,
        y,
        30 + ring * 18 + Math.max(0, progress),
        -1,
        1,
      );
      ctx.stroke();
    }
  } else if (ability === "lasso") {
    ctx.beginPath();
    ctx.ellipse(x + p.facing * 65, y, 50, 30, progress / 12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ability === "crescendo") {
    for (let bar = 0; bar < 5; bar++) {
      const height = 15 + Math.sin(p.attackTick / 4 + bar) * 12;
      ctx.fillRect(x + p.facing * (30 + bar * 9), y - height / 2, 4, height);
    }
  } else if (ability === "cocotero") {
    for (let leaf = -2; leaf <= 2; leaf++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + p.facing * 55,
        y + leaf * 45,
        x + p.facing * 100,
        y + leaf * 26,
      );
      ctx.stroke();
    }
  } else if (ability === "audit") {
    const front = x + p.facing * 65;
    ctx.globalAlpha = 0.45;
    ctx.strokeRect(front - 30, y - 38, 60, 76);
    const scan = ((p.attackTick * 5) % 76) - 38;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(front - 30, y + scan, 60, 3);
    for (let bit = 0; bit < 4; bit++) {
      ctx.fillRect(front - 22 + bit * 13, y - 16 + (bit % 2) * 25, 7, 7);
    }
  } else if (ability === "prank") {
    ctx.beginPath();
    ctx.roundRect(x - 28, y - 28, 56, 56, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
