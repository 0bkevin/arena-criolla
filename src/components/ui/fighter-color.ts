import type { CSSProperties } from "react";

/** Exposes a fighter's accent color to CSS as `--fighter-color`. */
export const colorStyle = (color: string): CSSProperties => ({
  "--fighter-color": color,
});
