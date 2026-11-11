import readableText from "./manifests/readable-text.json";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lettering painted on clothes (Iñaki's "rial" print, Deyna's "9"), in sheet
 * pixels. A fighter facing left is drawn mirrored, which would read backwards.
 */
const LETTERING = new Map<string, Rect[]>(Object.entries(readableText));

function sheetName(image: HTMLImageElement): string | undefined {
  return /\/([^/?#]+)\.(?:webp|png|avif)(?:[?#]|$)/.exec(
    image.currentSrc || image.src,
  )?.[1];
}

/**
 * After a sheet region has been drawn, redraw any lettering inside it flipped
 * back in place when the current transform mirrors the drawing. The body stays
 * mirrored; only the print reads the right way round.
 */
export function unmirrorLettering(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  /** The drawn region in sheet pixels. */
  source: Rect,
  /** Where those pixels live in the image actually drawn. */
  texture: { image: CanvasImageSource; x: number; y: number },
  destination: Rect,
) {
  const rects = LETTERING.get(sheetName(sheet) ?? "");
  if (!rects) return;
  const m = ctx.getTransform?.();
  if (!m || m.a * m.d - m.b * m.c >= 0) return;
  const sx = destination.width / source.width,
    sy = destination.height / source.height;
  for (const r of rects) {
    if (
      r.x < source.x ||
      r.y < source.y ||
      r.x + r.width > source.x + source.width ||
      r.y + r.height > source.y + source.height
    )
      continue;
    const x = destination.x + (r.x - source.x) * sx,
      y = destination.y + (r.y - source.y) * sy,
      width = r.width * sx,
      height = r.height * sy;
    ctx.save();
    ctx.translate(x + width / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      texture.image,
      texture.x + r.x - source.x,
      texture.y + r.y - source.y,
      r.width,
      r.height,
      -width / 2,
      y,
      width,
      height,
    );
    ctx.restore();
  }
}
