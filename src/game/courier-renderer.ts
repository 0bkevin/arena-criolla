import type { Projectile } from "../../shared/engine";
import atlas from "../../shared/courier-assets.json";

/** Painted rider sprites share the fighters' art; staggered depth keeps the pack legible. */
export function drawCourierMotorcycle(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
  image: HTMLImageElement,
  reducedMotion: boolean,
) {
  const depths = [-30, -8, -45, -22, -4, -36, 0];
  const rank = Math.max(
    0,
    Math.min(depths.length - 1, shot.formationIndex ?? 0),
  );
  const frameIndex = reducedMotion
    ? 0
    : (Math.floor((shot.age ?? 0) / 5) + rank) % atlas.frameCount;
  const frame = atlas.frames[frameIndex];
  // A seated courier and a full-length street motorcycle keep their scale beside a 177px fighter.
  const scale = 154 / atlas.bodyHeight;
  const width = frame.width * scale;
  const height = frame.height * scale;
  const floor = 42 + depths[rank];
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -width * 0.62,
    floor - atlas.baseline * scale,
    width,
    height,
  );
  ctx.restore();
}
