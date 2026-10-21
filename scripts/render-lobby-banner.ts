import type { FighterId } from "../shared/content";
import { entrancePoseProgress } from "../shared/entrance-actions";
import { drawSprite, loadSprite, type SpriteAsset } from "../src/game/assets";
import { drawEntranceAction } from "../src/game/entrance-renderer";

type CastMember = {
  id: FighterId;
  x: number;
  top: number;
  height: number;
  facing?: 1 | -1;
  /** An authored entrance moment; omit to use the relaxed combat stance. */
  entrance?: number | "signature";
};

/**
 * Recreate the original two-row reference artwork from the game sprites.
 * Import /scripts/render-lobby-banner.ts in the dev browser, call
 * renderLobbyBanners(), and export its canvases as reference images.
 * The production banners were recomposed for a compact single row with image_gen;
 * see lobby-banner-art.json for their prompts. Do not overwrite them with these
 * taller reference canvases. Vite fingerprints the production WebP assets for
 * preloading and immutable browser caching; sprite atlases stay out of the lobby.
 */
export async function renderLobbyBanners() {
  // Two staggered rows borrow the OG cover's portrait rhythm. Similar head
  // sizes, inward gazes and quiet gestures make this one ensemble.
  const desktopBack: CastMember[] = [
    // Smaller portraits sit behind the main row, filling the widest gaps.
    { id: "enrique", x: 695, top: 52, height: 420, entrance: 0.001 },
    { id: "jesus", x: 1150, top: 54, height: 430, entrance: 0.001 },
    { id: "oscar", x: 1640, top: 64, height: 425, facing: -1, entrance: 0.001 },
    {
      id: "victor",
      x: 2105,
      top: 58,
      height: 430,
      facing: -1,
      entrance: "signature",
    },
    {
      id: "reynaldo",
      x: 2345,
      top: 58,
      height: 430,
      facing: -1,
      entrance: 0.09,
    },
    { id: "gomez", x: 104, top: 48, height: 550, entrance: "signature" },
    { id: "rummy", x: 338, top: 38, height: 560 },
    { id: "dayana", x: 550, top: 34, height: 545, entrance: 0.72 },
    { id: "javier", x: 840, top: 42, height: 560, entrance: 0.09 },
    { id: "mcm", x: 1044, top: 34, height: 560, entrance: 0.09 },
    { id: "sarcos", x: 1280, top: 36, height: 565, entrance: 0.23 },
    {
      id: "chataing",
      x: 1516,
      top: 42,
      height: 560,
      facing: -1,
      entrance: "signature",
    },
    { id: "emilio", x: 1752, top: 38, height: 560, facing: -1, entrance: 0.09 },
    {
      id: "carolina",
      x: 1988,
      top: 34,
      height: 565,
      facing: -1,
      entrance: "signature",
    },
    {
      id: "bolivar",
      x: 2224,
      top: 38,
      height: 565,
      facing: -1,
      entrance: 0.09,
    },
    {
      id: "tiotigre",
      x: 2460,
      top: 48,
      height: 550,
      facing: -1,
      entrance: "signature",
    },
  ];
  const desktopFront: CastMember[] = [
    { id: "zavarce", x: 95, top: 202, height: 640, entrance: "signature" },
    { id: "capriles", x: 390, top: 190, height: 640 },
    { id: "renny", x: 685, top: 185, height: 650, entrance: 0.09 },
    { id: "lila", x: 980, top: 190, height: 640, entrance: "signature" },
    {
      id: "conde",
      x: 1275,
      top: 168,
      height: 660,
      facing: -1,
      entrance: 0.001,
    },
    { id: "vallenilla", x: 1570, top: 192, height: 640, facing: -1 },
    {
      id: "george",
      x: 1865,
      top: 188,
      height: 645,
      facing: -1,
      entrance: 0.23,
    },
    { id: "simon", x: 2160, top: 180, height: 650, facing: -1, entrance: 0.12 },
    { id: "maite", x: 2455, top: 198, height: 640, facing: -1, entrance: 0.09 },
  ];
  // A separate portrait crop preserves readable faces on narrow screens.
  const mobileBack: CastMember[] = [
    { id: "enrique", x: 185, top: 42, height: 330, entrance: 0.001 },
    { id: "jesus", x: 777, top: 44, height: 330, facing: -1, entrance: 0.001 },
    { id: "mcm", x: 92, top: 26, height: 425, entrance: 0.09 },
    { id: "javier", x: 298, top: 34, height: 430, entrance: 0.09 },
    { id: "lila", x: 480, top: 24, height: 435, entrance: "signature" },
    { id: "bolivar", x: 674, top: 32, height: 430, facing: -1, entrance: 0.09 },
    {
      id: "carolina",
      x: 868,
      top: 26,
      height: 425,
      facing: -1,
      entrance: "signature",
    },
  ];
  const mobileFront: CastMember[] = [
    { id: "zavarce", x: 75, top: 204, height: 500, entrance: "signature" },
    { id: "vallenilla", x: 278, top: 210, height: 500 },
    { id: "conde", x: 480, top: 186, height: 510, entrance: 0.001 },
    { id: "simon", x: 682, top: 192, height: 500, facing: -1, entrance: 0.12 },
    { id: "maite", x: 885, top: 204, height: 500, facing: -1, entrance: 0.09 },
  ];
  const cast = [...desktopBack, ...desktopFront, ...mobileBack, ...mobileFront];
  const ids = [...new Set(cast.map(({ id }) => id))];
  const sprites = new Map<FighterId, SpriteAsset>(
    await Promise.all(
      ids.map(
        async (id) =>
          [
            id,
            await loadSprite(id, {
              entrance: cast.some(
                (entry) => entry.id === id && entry.entrance !== undefined,
              ),
            }),
          ] as const,
      ),
    ),
  );
  const stage = new Image();
  stage.src = "/assets/caracas.webp";
  await stage.decode();

  const portraits = new Map<
    string,
    {
      canvas: HTMLCanvasElement;
      left: number;
      top: number;
      width: number;
      height: number;
      head: number;
    }
  >();

  function portrait(entry: CastMember) {
    const key = `${entry.id}/${entry.entrance ?? "stance"}`;
    const cached = portraits.get(key);
    if (cached) return cached;
    const sprite = sprites.get(entry.id)!;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1100;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    if (entry.entrance === undefined) {
      drawSprite(ctx, sprite, 0, 600, 1040, 900, 1);
    } else {
      ctx.save();
      ctx.translate(600, 1040);
      const progress =
        entry.entrance === "signature"
          ? entrancePoseProgress(entry.id)
          : entry.entrance;
      if (!drawEntranceAction(ctx, sprite, entry.id, progress, 900, 1)) {
        throw new Error(`Missing entrance portrait: ${entry.id}`);
      }
      ctx.restore();
    }
    // Measure the actual silhouette, not its atlas cell. This keeps standing,
    // folded-arm and hat-tip poses at a consistent scale with clear faces.
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      right = 0,
      top = canvas.height,
      bottom = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 40) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right <= left || bottom <= top)
      throw new Error(`Empty portrait: ${key}`);
    let weightedX = 0,
      weight = 0;
    const headBottom = top + Math.ceil((bottom - top) * 0.22);
    for (let y = top; y < headBottom; y++) {
      for (let x = left; x <= right; x++) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        if (alpha < 40) continue;
        weightedX += (x - left) * alpha;
        weight += alpha;
      }
    }
    const result = {
      canvas,
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
      head: weightedX / weight,
    };
    portraits.set(key, result);
    return result;
  }

  function drawCast(
    ctx: CanvasRenderingContext2D,
    entries: CastMember[],
    back: boolean,
  ) {
    ctx.save();
    ctx.filter = back ? "saturate(0.84) brightness(0.91)" : "saturate(0.94)";
    ctx.shadowColor = "#07132470";
    ctx.shadowBlur = back ? 8 : 14;
    ctx.shadowOffsetY = back ? 4 : 8;
    for (const entry of entries) {
      const p = portrait(entry);
      const scale = entry.height / p.height;
      ctx.save();
      ctx.translate(entry.x, entry.top);
      ctx.scale(entry.facing ?? 1, 1);
      ctx.drawImage(
        p.canvas,
        p.left,
        p.top,
        p.width,
        p.height,
        -p.head * scale,
        0,
        p.width * scale,
        entry.height,
      );
      ctx.restore();
    }
    ctx.restore();
  }

  function scene(
    width: number,
    height: number,
    back: CastMember[],
    front: CastMember[],
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const sourceWidth =
      width > 1000 ? stage.naturalWidth : stage.naturalWidth - 136;
    const sourceHeight = (sourceWidth * height) / width;
    ctx.filter = "saturate(0.78) brightness(0.74)";
    ctx.drawImage(
      stage,
      0,
      width > 1000 ? 80 : 0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
    ctx.filter = "none";
    drawCast(ctx, back, true);
    drawCast(ctx, front, false);
    // A restrained fade seats the portrait in the navy lobby without covering faces.
    const shade = ctx.createLinearGradient(0, height * 0.68, 0, height);
    shade.addColorStop(0, "#0d1e3100");
    shade.addColorStop(1, "#0d1e31b3");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    return canvas;
  }

  return {
    desktop: scene(2560, 480, desktopBack, desktopFront),
    mobile: scene(960, 480, mobileBack, mobileFront),
  };
}
