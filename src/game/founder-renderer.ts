import type { Ability } from "../../shared/content";
import type { PlayerState, Projectile } from "../../shared/engine";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function invoice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.roundRect(-13, -17, 26, 34, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, -9);
  ctx.lineTo(7, -9);
  ctx.moveTo(-7, -3);
  ctx.lineTo(7, -3);
  ctx.moveTo(-7, 3);
  ctx.lineTo(1, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(5, 9, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-7, -5);
  ctx.lineTo(1, 0);
  ctx.lineTo(-7, 5);
  ctx.stroke();
  ctx.restore();
}

/** Draws the two projectile-shaped founder specials in projectile-local space. */
export function drawFounderProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
): boolean {
  const age = Math.max(0, shot.age ?? 0);
  ctx.save();
  switch (shot.kind) {
    case "ledger":
      ctx.lineWidth = 2;
      ctx.rotate(Math.sin(age / 11) * 0.04);
      invoice(ctx, 0, 0, 1);
      ctx.beginPath();
      ctx.moveTo(-10, -17);
      ctx.lineTo(-6, -12);
      ctx.stroke();
      break;
    case "settlement": {
      const returning = age >= (shot.returnAfter ?? Infinity);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 13, Math.sin(age / 12) * 0.08, -2.5, 2.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 22, -Math.sin(age / 12) * 0.08, 0.65, 5.55);
      ctx.stroke();
      arrowHead(ctx, returning ? -17 : 17, -10, returning ? 2.6 : -0.55);
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}

/** Draws compact, world-space cues for the five fictional founder specials. */
export function drawFounderSpecial(
  ctx: CanvasRenderingContext2D,
  ability: Ability,
  p: PlayerState,
  other: PlayerState,
  progress: number,
): void {
  const x = p.x;
  const y = p.y;
  const facing = p.facing || 1;
  const t = Number.isFinite(progress) ? progress : 0;
  ctx.save();

  if (ability === "ledger") {
    const launch = smooth((t + 8) / 11);
    ctx.globalAlpha *= 0.82 * (1 - smooth((t - 4) / 12));
    invoice(ctx, x + facing * (22 + launch * 19), y - 102 - launch * 8, 0.72);
    invoice(ctx, x + facing * (36 + launch * 19), y - 90 - launch * 8, 0.58);
  } else if (ability === "settlement") {
    const returning = t >= 10;
    const direction = returning ? -facing : facing;
    const phase = clamp(
      t < 0 ? (t + 8) / 8 : (t - (returning ? 10 : 0)) / 18,
      0,
      1,
    );
    const loopX = x + direction * (38 + phase * 58);
    ctx.globalAlpha *= 0.72 * (1 - smooth((t - 31) / 13));
    ctx.beginPath();
    ctx.ellipse(loopX, y - 86, 22, 13, direction * 0.18, -2.7, 2.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(loopX, y - 86, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (ability === "ignition") {
    const active = 1 - smooth((t - 11) / 6);
    ctx.globalAlpha *= 0.78 * active;
    ctx.lineWidth = 3;
    for (let streak = 0; streak < 3; streak++) {
      const back = x - facing * (24 + streak * 17);
      const height = y - 24 - streak * 6;
      ctx.beginPath();
      ctx.moveTo(back, height);
      ctx.lineTo(back - facing * (24 + (2 - streak) * 6), height + 3);
      ctx.stroke();
    }
    for (let tire = 0; tire < 2; tire++) {
      const mark = x - facing * (21 + tire * 16);
      ctx.beginPath();
      ctx.moveTo(mark - 7, y - 3);
      ctx.lineTo(mark + 7, y - 3);
      ctx.stroke();
    }
  } else if (ability === "slash") {
    const fade = 1 - smooth((t - 8) / 12);
    ctx.globalAlpha *= 0.9 * fade;
    ctx.strokeStyle = "#ff874d";
    ctx.lineWidth = 7;
    const swipeX = x + facing * 62;
    const swipeY = y - 91;
    ctx.beginPath();
    ctx.moveTo(swipeX - facing * 31, swipeY + 34);
    ctx.lineTo(swipeX + facing * 31, swipeY - 34);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(swipeX - facing * 18, swipeY + 36);
    ctx.lineTo(swipeX + facing * 44, swipeY - 32);
    ctx.moveTo(swipeX - facing * 43, swipeY + 18);
    ctx.lineTo(swipeX + facing * 14, swipeY - 43);
    ctx.stroke();
  } else if (ability === "grid") {
    const reach = clamp(Math.abs(other.x - x), 0, 270);
    const tiles = clamp(Math.floor((t + 20) / 8) + 1, 1, 4);
    ctx.globalAlpha *= 0.65 * (1 - smooth((t - 29) / 18));
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x + facing * 28, y - 4);
    ctx.lineTo(x + facing * (28 + reach), y - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let tile = 0; tile < tiles; tile++) {
      const along = ((tile + 1) / 5) * Math.max(40, reach);
      const tileX = x + facing * (28 + along);
      ctx.strokeRect(tileX - 9, y - 16, 18, 18);
      ctx.beginPath();
      ctx.arc(tileX, y - 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
