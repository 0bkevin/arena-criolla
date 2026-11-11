import { finaleAsset } from "../../../../shared/engine/finales/finales";
import { TAU } from "./math";
import { sceneDirections, type Scene } from "./scene";

export function prop(
  scene: Scene,
  x: number,
  y: number,
  width: number,
  height = width * 0.72,
  alpha = 1,
  facing = 1,
) {
  // These atlas cells depict entire replacement environments rather than props.
  if (
    [
      "nacho",
      "amanda",
      "chiqui",
      "momoy",
      "lionza",
      "tiotigre",
      "florentino",
    ].includes(scene.actor)
  )
    return;
  const position = finaleAsset(scene.actor),
    { ctx } = scene;
  if (!position) return;
  const image = scene.props[position.file];
  if (!image?.width || !image.height) return;
  const cellW = image.width / 4,
    cellH = image.height / 2;
  const positionOnArena = scene.layout.point(x, y);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(positionOnArena.x, positionOnArena.y);
  ctx.scale(facing, 1);
  ctx.drawImage(
    image,
    position.column * cellW,
    position.row * cellH,
    cellW,
    cellH,
    -width / 2,
    -height / 2,
    width,
    height,
  );
  ctx.restore();
}
export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 20,
  color = "#f8edce",
  align: CanvasTextAlign = "center",
) {
  ctx.font = `700 ${size}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  readableText(ctx, value, x, y);
}
function readableText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth?: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sceneDirections.get(ctx) ?? 1, 1);
  if (maxWidth === undefined) ctx.fillText(value, 0, 0);
  else ctx.fillText(value, 0, 0, maxWidth);
  ctx.restore();
}
export function line(
  ctx: CanvasRenderingContext2D,
  points: readonly number[],
  color: string,
  width = 3,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    if (i === 0) ctx.moveTo(points[i], points[i + 1]);
    else ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.stroke();
}
export function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}
export function bubble(
  scene: Scene,
  value: string | readonly string[],
  x: number,
  y: number,
  width = 240,
) {
  const { ctx } = scene;
  const lines = typeof value === "string" ? [value] : value;
  const extraHeight = (lines.length - 1) * 22;
  ctx.fillStyle = "#fbefd5";
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 30, width, 50 + extraHeight, 13);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 18, y + 18 + extraHeight);
  ctx.lineTo(x - 7, y + 33 + extraHeight);
  ctx.lineTo(x + 2, y + 18 + extraHeight);
  ctx.fill();
  ctx.font = '700 20px "Barlow Condensed", sans-serif';
  ctx.fillStyle = "#43311c";
  ctx.textAlign = "center";
  for (const [index, line] of lines.entries())
    readableText(ctx, line, x, y + 2 + index * 22, width - 24);
}
export function note(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ellipse(ctx, x, y, size * 0.6, size * 0.4, color);
  line(
    ctx,
    [
      x + size * 0.5,
      y,
      x + size * 0.5,
      y - size * 1.7,
      x + size * 1.2,
      y - size * 1.3,
    ],
    color,
    3,
  );
}
export function ring(
  scene: Scene,
  x: number,
  y: number,
  radius: number,
  color = scene.profile.accent,
  squash = 1,
) {
  const { ctx } = scene;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(
    x,
    y,
    Math.max(1, radius),
    Math.max(1, radius * squash),
    0,
    0,
    TAU,
  );
  ctx.stroke();
}
export function damage(scene: Scene, y = 205) {
  if (!scene.pulse) return;
  const { ctx, pulse } = scene;
  const position = scene.layout.targetPoint(y);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(
    ctx,
    `−${Math.round(scene.state.finale!.damage / scene.profile.damageBeats.length)} VIDA`,
    position.x,
    position.y - (1 - pulse) * 24 * scene.motion,
    29,
    "#ffb4a2",
  );
  ctx.restore();
}
export function chair(scene: Scene, x: number, seat: number, facing: number) {
  const { ctx } = scene;
  const position = scene.layout.point(x, 509);
  ctx.save();
  ctx.translate(position.x - x, position.y - 509);
  ctx.fillStyle = "#74462b";
  ctx.beginPath();
  ctx.roundRect(x - facing * 31 - 19, seat - 112, 38, 116, 7);
  ctx.fill();
  ctx.fillStyle = "#b77942";
  ctx.fillRect(x - 36, seat - 3, 81, 13);
  line(ctx, [x - 27, seat + 8, x - 31, 509], "#815035", 9);
  line(ctx, [x + 35, seat + 8, x + 45, 509], "#815035", 9);
  ctx.restore();
}
export function mug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size = 1,
  tilt = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(size, size);
  ctx.strokeStyle = "#f4e4c4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(13, -6, 8, 8, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#f4e4c4";
  ctx.beginPath();
  ctx.roundRect(-12, -17, 25, 25, 4);
  ctx.fill();
  ellipse(ctx, 0, -16, 11, 3, "#5b3725");
  line(ctx, [-3, -22, -5, -29, -1, -36], "#fff3d470", 2);
  ctx.restore();
}
