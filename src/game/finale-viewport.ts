import type { AttackArtFrame } from "./attack-art";

/** Visible canvas edges in the local painted coordinates used by view.point. */
export interface FinaleViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Includes every outer transform, including the arena camera and backing-pixel scale. */
export function finaleViewportBounds(
  ctx: CanvasRenderingContext2D,
): FinaleViewportBounds | undefined {
  const width = ctx.canvas?.width,
    height = ctx.canvas?.height;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    typeof ctx.getTransform !== "function"
  )
    return undefined;
  try {
    const matrix = ctx.getTransform();
    if (!matrix) return undefined;
    const { a, b, c, d, e, f } = matrix;
    if (![a, b, c, d, e, f].every(Number.isFinite)) return undefined;
    const determinant = a * d - b * c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12)
      return undefined;
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].map(([x, y]) => ({
      x: (d * (x - e) - c * (y - f)) / determinant,
      y: (-b * (x - e) + a * (y - f)) / determinant,
    }));
    const bounds = {
      left: Math.min(...corners.map((corner) => corner.x)),
      top: Math.min(...corners.map((corner) => corner.y)),
      right: Math.max(...corners.map((corner) => corner.x)),
      bottom: Math.max(...corners.map((corner) => corner.y)),
    };
    return Object.values(bounds).every(Number.isFinite) ? bounds : undefined;
  } catch {
    // Minimal test contexts may omit or stub the browser's transform support.
    return undefined;
  }
}

/** Horizontal anchor interval that retains the full painted frame at its existing scale. */
export function finaleArtXRange(
  viewport: FinaleViewportBounds | undefined,
  frame: AttackArtFrame,
  height: number,
  facing = 1,
  padding = 8,
): { minX: number; maxX: number; fits: boolean } {
  if (!viewport) return { minX: -Infinity, maxX: Infinity, fits: true };
  const scale = height / (frame.bodyHeight ?? frame.height);
  const start = -frame.anchorX * scale * facing,
    end = (frame.width - frame.anchorX) * scale * facing;
  const minX = viewport.left + padding - Math.min(start, end),
    maxX = viewport.right - padding - Math.max(start, end);
  return { minX, maxX, fits: minX <= maxX };
}

/** Translate only; callers may use fits/range to choose a different entrance path. */
export function clampFinaleArtX(
  viewport: FinaleViewportBounds | undefined,
  frame: AttackArtFrame,
  height: number,
  facing: number,
  desiredX: number,
  padding = 8,
) {
  const { minX, maxX, fits } = finaleArtXRange(
    viewport,
    frame,
    height,
    facing,
    padding,
  );
  return fits ? Math.max(minX, Math.min(maxX, desiredX)) : (minX + maxX) / 2;
}
