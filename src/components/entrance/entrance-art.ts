import entranceImages from "./entrance-images.json";

/** One clash cutout; `avif`/`webp` list the 1x then 2x files. */
export interface EntranceArt {
  width: number;
  height: number;
  avif: string[];
  webp: string[];
}

export const ENTRANCE_ART: Record<"renny" | "capriles", EntranceArt> =
  entranceImages;

/**
 * Rendered width of one fighter: ~59% of the matchup, which is capped by the
 * viewport width, the duel's 55svh height (x1.72 aspect) and 1000px.
 * Shared with the <link rel=preload> so both pick the same file.
 */
export const ENTRANCE_ART_SIZES = "min(59vw, 56vh, 510px)";

/** `srcset` with width descriptors for the 1x and 2x files. */
export const entranceSrcSet = (art: EntranceArt, urls: string[]) =>
  urls.map((url, index) => `${url} ${art.width * (index + 1)}w`).join(", ");
