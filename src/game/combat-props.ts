import type { PlayerState } from "../../shared/engine";

/** Simón's four-string instrument follows his torso and the one forward strum. */
export function drawCuatro(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  bodyHeight: number,
) {
  ctx.save();
  ctx.translate(player.x + player.facing * 4, player.y - bodyHeight * 0.57);
  ctx.scale((player.facing * bodyHeight) / 177, bodyHeight / 177);
  ctx.rotate(-0.22);
  ctx.fillStyle = "#a96235";
  ctx.strokeStyle = "#472d25";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(5, -7);
  ctx.bezierCurveTo(-3, -21, -23, -16, -20, -5);
  ctx.bezierCurveTo(-17, 0, -20, 3, -24, 8);
  ctx.bezierCurveTo(-34, 26, -2, 37, 9, 21);
  ctx.bezierCurveTo(14, 12, 6, 5, 5, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#774528";
  ctx.fillRect(3, -5, 42, 9);
  ctx.fillStyle = "#c99b5b";
  ctx.fillRect(40, -8, 11, 15);
  ctx.fillStyle = "#382b26";
  ctx.beginPath();
  ctx.arc(-5, 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-16, 12, 4, 8);
  ctx.strokeStyle = "#ead1a0";
  ctx.lineWidth = 0.6;
  for (let string = 0; string < 4; string++) {
    ctx.beginPath();
    ctx.moveTo(-14, 12 + string * 1.6);
    ctx.lineTo(46, -3 + string * 1.6);
    ctx.stroke();
  }
  const stroke = Math.sin(
    Math.max(0, Math.min(1, (player.attackTick - 9) / 16)) * Math.PI,
  );
  ctx.fillStyle = "#dfb489";
  ctx.beginPath();
  ctx.ellipse(-2, -3 + stroke * 14, 6, 3, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
