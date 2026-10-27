import { fighterById, type FighterId } from "../../shared/content";
import { loadImage } from "./assets";
import busts from "../../shared/portrait-busts.json";
import {
  bustPlacement,
  PORTRAIT_CANVAS,
  type PortraitBust,
} from "../../shared/portrait-busts";

/** Pre-cut roster-card pose for a built-in fighter, if one was generated. */
export function portraitBust(id: FighterId): PortraitBust | undefined {
  return Object.hasOwn(busts, id)
    ? (busts as Record<string, PortraitBust>)[id]
    : undefined;
}

/** Fetch roster-card busts ahead of the cards, ahead of other lobby art. */
export function warmPortraitBusts(ids: readonly FighterId[]) {
  for (const id of ids) {
    const bust = portraitBust(id);
    if (bust) void loadImage(bust.file, "high").catch(() => {});
  }
}

/** Draw a pre-cut bust exactly where Portrait would draw it from the atlas. */
export function drawPortraitBust(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  bust: PortraitBust,
  id: FighterId,
  facing: number,
) {
  const { scale, feet, top } = bustPlacement(fighterById(id), bust);
  const offset = bust.center * scale * facing * bust.mirror;
  ctx.clearRect(0, 0, PORTRAIT_CANVAS.width, PORTRAIT_CANVAS.height);
  ctx.save();
  ctx.translate(PORTRAIT_CANVAS.width / 2 - offset, feet);
  ctx.scale(facing * bust.mirror, 1);
  ctx.drawImage(
    image,
    bust.x,
    bust.y,
    bust.width,
    bust.rows,
    bust.left * scale,
    top - feet,
    bust.width * scale,
    bust.rows * scale,
  );
  ctx.restore();
}
