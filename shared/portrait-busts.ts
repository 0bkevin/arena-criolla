/** Fixed drawing surface of the Portrait canvas. */
export const PORTRAIT_CANVAS = { width: 400, height: 500 } as const;

/**
 * One pre-cut roster-card pose (see scripts/generate-portrait-busts.ts).
 * Lengths are atlas pixels; `left` and `center` are relative to the middle of
 * the pose's atlas cell, as drawSprite and Portrait measure them.
 */
export interface PortraitBust {
  file: string;
  source: string;
  sourceSha256: string;
  sha256: string;
  frame: number;
  bodyHeight: number;
  left: number;
  center: number;
  width: number;
  height: number;
  /** Rows of the pose stored in `file`, from its top. */
  rows: number;
  /** Position of the pose's top-left pixel inside `file`. */
  x: number;
  y: number;
  mirror: number;
}

/** Bust scale and vertical placement, matching Portrait's sheet drawing. */
export function bustPlacement(
  fighter: { portraitScale?: number; portraitLift?: number },
  bust: Pick<PortraitBust, "frame" | "bodyHeight" | "height">,
) {
  const height = 690 * (fighter.portraitScale ?? 1);
  const scale = height / bust.bodyHeight;
  const feet = height + 30 - height * (fighter.portraitLift ?? 0);
  // drawSprite anchors the jump pose by body height, the others by their feet.
  const top = feet - (bust.frame === 4 ? height : bust.height * scale);
  return { height, scale, feet, top };
}
