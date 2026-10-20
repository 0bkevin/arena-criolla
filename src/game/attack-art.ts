import manifest from "../../shared/attack-assets.json";
import type { FighterId } from "../../shared/content";

export interface AttackArtFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY?: number;
  bodyHeight?: number;
}
export interface AttackArtSheet {
  file: string;
  frames: Record<string, AttackArtFrame>;
}
export const ATTACK_ART = manifest as Record<string, AttackArtSheet>;

/** Preflight every required crop before a sequence paints any of its artwork. */
export function hasAttackArt(
  images: Record<string, HTMLImageElement>,
  fighter: FighterId,
  poses: readonly string[],
): boolean {
  const sheet = ATTACK_ART[fighter];
  const image = sheet && images[sheet.file];
  if (
    !image ||
    image.complete === false ||
    !Array.isArray(poses) ||
    !poses.length
  )
    return false;
  // Canvas source coordinates use intrinsic pixels, not CSS/attribute sizing.
  // Minimal recording contexts may provide only width/height test doubles.
  const sourceWidth =
      image.naturalWidth === undefined ? image.width : image.naturalWidth,
    sourceHeight =
      image.naturalHeight === undefined ? image.height : image.naturalHeight;
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  )
    return false;
  for (const pose of poses) {
    if (typeof pose !== "string" || !pose.length) return false;
    const frame = sheet.frames?.[pose];
    if (!frame) return false;
    const anchorY = frame.anchorY === undefined ? frame.height : frame.anchorY,
      bodyHeight =
        frame.bodyHeight === undefined ? frame.height : frame.bodyHeight;
    const valid =
      [
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        frame.anchorX,
        anchorY,
        bodyHeight,
      ].every(Number.isFinite) &&
      frame.x >= 0 &&
      frame.y >= 0 &&
      frame.width > 0 &&
      frame.height > 0 &&
      frame.x + frame.width <= sourceWidth &&
      frame.y + frame.height <= sourceHeight &&
      frame.anchorX >= 0 &&
      frame.anchorX <= frame.width &&
      anchorY >= 0 &&
      anchorY <= frame.height &&
      bodyHeight > 0 &&
      bodyHeight <= frame.height;
    if (!valid) return false;
  }
  return true;
}

/** Preserve full alpha while sizing and grounding the visible painted body. */
export function drawAttackArt(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  fighter: FighterId,
  pose: string,
  x: number,
  feet: number,
  height: number,
  facing = 1,
  alpha = 1,
): boolean {
  if (!hasAttackArt(images, fighter, [pose])) return false;
  const sheet = ATTACK_ART[fighter];
  const frame = sheet.frames[pose];
  const image = images[sheet.file];
  const scale = height / (frame.bodyHeight ?? frame.height);
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(facing, 1);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -frame.anchorX * scale,
    -(frame.anchorY ?? frame.height) * scale,
    frame.width * scale,
    frame.height * scale,
  );
  ctx.restore();
  return true;
}
