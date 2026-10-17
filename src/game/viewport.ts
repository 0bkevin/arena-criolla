import { ARENA_VIEW, WORLD } from "../../shared/arena";

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
    return { ...ARENA_VIEW };
  const ratio = width / height;
  return {
    width: Math.max(ARENA_VIEW.width, Math.round(ARENA_VIEW.height * ratio)),
    height: Math.max(ARENA_VIEW.height, Math.round(ARENA_VIEW.width / ratio)),
  };
}

export function arenaBounds(width: number, height: number) {
  return {
    x: WORLD.x + (WORLD.width - width) / 2,
    y: WORLD.y + (WORLD.height - height) / 2,
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

/** Extend fixed world artwork into recovery views without moving or stretching it. */
export function sceneryTiles(
  cover: ReturnType<typeof sceneryCover>,
  bounds: ReturnType<typeof arenaBounds>,
) {
  const tiles = [];
  const firstColumn = Math.floor((bounds.x - cover.x) / cover.width);
  const lastColumn = Math.ceil(
    (bounds.x + bounds.width - cover.x) / cover.width,
  );
  const firstRow = Math.floor((bounds.y - cover.y) / cover.height);
  const lastRow = Math.ceil(
    (bounds.y + bounds.height - cover.y) / cover.height,
  );
  for (let row = firstRow; row < lastRow; row++) {
    for (let column = firstColumn; column < lastColumn; column++) {
      tiles.push({
        x: cover.x + column * cover.width,
        y: cover.y + row * cover.height,
        width: cover.width,
        height: cover.height,
        mirrorX: column % 2 !== 0,
        mirrorY: row % 2 !== 0,
      });
    }
  }
  return tiles;
}
