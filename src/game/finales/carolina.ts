import { coutureRunwayRange } from "../../../shared/couture-runway";
import type { FieldFinaleState } from "../../../shared/field-finales";
import { ATTACK_ART } from "../attack-art";

export const CAROLINA_MODEL_POSES = Array.from({ length: 4 }, (_, i) => [
  `model-${i + 1}-a`,
  `model-${i + 1}-b`,
]).flat();

/** Keep the same human scale when her arm or a model's skirt changes silhouette. */
export function carolinaPoseHeight(pose: string, height: number) {
  const sheet = ATTACK_ART.carolina,
    reference = pose.startsWith("model-")
      ? `model-${pose.split("-")[1]}-a`
      : "welcome";
  return (
    (height * sheet.frames[pose].bodyHeight!) /
    sheet.frames[reference].bodyHeight!
  );
}

/** A low, open runway sits in the current arena without obstructing the rival. */
export function drawCoutureRunway(
  ctx: CanvasRenderingContext2D,
  field: FieldFinaleState,
) {
  const { left, right } = coutureRunwayRange(field),
    y = field.y;
  ctx.save();
  ctx.fillStyle = "#151720";
  ctx.beginPath();
  ctx.moveTo(left, y + 8);
  ctx.lineTo(right, y + 8);
  ctx.lineTo(right - 12, y + 30);
  ctx.lineTo(left + 12, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#eae5dc";
  ctx.strokeStyle = "#bca875";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left + 20, y - 7);
  ctx.lineTo(right - 20, y - 7);
  ctx.lineTo(right, y + 8);
  ctx.lineTo(left, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff3cc";
  for (let x = left + 24; x < right - 15; x += 46) {
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
