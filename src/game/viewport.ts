import { WORLD } from "../../shared/engine";

/** Expand the visible scene instead of cropping the arena or stretching fighters. */
export function arenaCanvasSize(
  width: number,
  height: number,
  immersive: boolean,
) {
  if (
    !immersive ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < height ||
    height <= 0
  )
    return { width: WORLD.width, height: WORLD.height };
  const ratio = width / height;
  return {
    width: Math.max(WORLD.width, Math.round(WORLD.height * ratio)),
    height: Math.max(WORLD.height, Math.round(WORLD.width / ratio)),
  };
}

export function arenaBounds(width: number, height: number) {
  return {
    x: (WORLD.width - width) / 2,
    y: (WORLD.height - height) / 2,
    width,
    height,
  };
}

/** Cover only the scenery; foreground coordinates keep their original proportions. */
export function sceneryCover(
  sourceWidth: number,
  sourceHeight: number,
  bounds: ReturnType<typeof arenaBounds>,
) {
  const scale = Math.max(
    bounds.width / sourceWidth,
    bounds.height / sourceHeight,
  );
  const width = sourceWidth * scale,
    height = sourceHeight * scale;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
}
