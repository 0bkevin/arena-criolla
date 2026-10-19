import type { Ability } from "../../shared/content";
import type { PlayerState, Projectile } from "../../shared/engine";

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = (point * Math.PI) / 5 - Math.PI / 2;
    const length = point % 2 ? radius * 0.43 : radius;
    const px = x + Math.cos(angle) * length,
      py = y + Math.sin(angle) * length;
    if (point) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawIconProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
): boolean {
  if (shot.kind === "signal") {
    const age = shot.age ?? 0;
    ctx.save();
    const returning = !!shot.returnAfter && age >= shot.returnAfter;
    ctx.strokeStyle = returning ? "#ffe18a" : "#9cf6df";
    ctx.fillStyle = "#d8fff6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, -0.8, 0.8);
    ctx.arc(0, 0, 13, Math.PI - 0.8, Math.PI + 0.8);
    ctx.stroke();
    ctx.fillRect(-4, -4, 8, 8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 21 + Math.sin(age * 0.3) * 2, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    // The caller mirrors by current velocity, including the return leg and
    // reflected shots. Keep this leading chevron upright in that transform.
    ctx.beginPath();
    ctx.moveTo(17, -6);
    ctx.lineTo(25, 0);
    ctx.lineTo(17, 6);
    ctx.stroke();
    ctx.restore();
    return true;
  }
  if (shot.kind !== "polar") return false;
  ctx.save();
  ctx.rotate((shot.age ?? 0) * 0.075);
  ctx.fillStyle = "#a4e4ff";
  ctx.strokeStyle = "#f0fbff";
  ctx.lineWidth = 2;
  star(ctx, 0, 0, 17);
  ctx.beginPath();
  ctx.arc(0, 0, 23, -0.6, 1.5);
  ctx.stroke();
  ctx.restore();
  return true;
}

export function drawIconSpecial(
  ctx: CanvasRenderingContext2D,
  ability: Ability,
  p: PlayerState,
  progress: number,
) {
  if (
    !["polar", "couture", "corona", "liberator", "retake", "signal"].includes(
      ability,
    )
  )
    return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing || 1, 1);
  const t = Math.max(0, progress);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 18) / 22) * 0.85;
  if (ability === "polar") {
    ctx.fillStyle = "#c3edff";
    ctx.strokeStyle = "#ffffff";
    const charge = Math.max(0, Math.min(1, (progress + 15) / 15));
    star(ctx, 35 + charge * 12, -85, 7 + charge * 7);
  } else if (ability === "couture") {
    ctx.strokeStyle = "#fff3dc";
    ctx.lineWidth = 4;
    const reach = progress < 0 ? 65 : Math.min(235, 90 + t * 13);
    ctx.beginPath();
    ctx.moveTo(22, -110);
    ctx.bezierCurveTo(reach * 0.55, -160, reach, -140, reach, -70);
    ctx.bezierCurveTo(reach - 12, -28, 65, -30, 25, -70);
    ctx.stroke();
    ctx.strokeStyle = "#d5b474";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(25, -105);
    ctx.bezierCurveTo(95, -130, reach - 25, -120, reach - 8, -70);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (ability === "corona") {
    ctx.strokeStyle = "#ffe494";
    ctx.fillStyle = "#fff6c7";
    for (let pulse = 0; pulse < 3; pulse++) {
      const age = t - pulse * 12;
      if (progress < 0 || age < 0 || age > 14) continue;
      const radius = 135 + pulse * 36;
      ctx.globalAlpha = (1 - age / 15) * 0.7;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -75, radius, 72, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let n = 0; n < 5; n++) {
        const angle = n * Math.PI * 0.4 - Math.PI / 2;
        star(ctx, Math.cos(angle) * radius, -75 + Math.sin(angle) * 72, 6);
      }
    }
  } else if (ability === "liberator") {
    for (const [n, color] of ["#ffe16b", "#6bafff", "#f87970"].entries()) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-22, -25 - n * 14);
      ctx.quadraticCurveTo(-65, -34 - n * 14, -105, -17 - n * 14);
      ctx.stroke();
    }
    ctx.strokeStyle = "#ffe9a6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(35, -77, 58, -1.1, 0.8);
    ctx.stroke();
  } else if (ability === "retake") {
    ctx.strokeStyle = p.countered ? "#fff1ac" : "#9ec2ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(20, -82, 57, -1.15, 1.15);
    ctx.stroke();
    // A compact clapper cue marks the anticipation and successful counter.
    ctx.fillStyle = "#172335";
    ctx.fillRect(23, -126, 35, 23);
    ctx.strokeRect(23, -126, 35, 23);
    for (let n = 0; n < 4; n++) {
      ctx.beginPath();
      ctx.moveTo(25 + n * 8, -125);
      ctx.lineTo(30 + n * 8, -119);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "#9cf6df";
    ctx.fillStyle = "#d8fff6";
    ctx.lineWidth = 2;
    const charge = Math.min(1, Math.max(0, (progress + 21) / 21));
    ctx.fillRect(34 + charge * 7, -91, 8, 8);
    for (let wave = 0; wave < 3; wave++) {
      ctx.globalAlpha = (0.55 - wave * 0.12) * (1 - charge * 0.3);
      const radius = 12 + wave * 11 + charge * 5;
      ctx.beginPath();
      ctx.arc(42, -87, radius, -0.8, 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
}
