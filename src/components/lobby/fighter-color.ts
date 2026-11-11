import type { CSSProperties } from "react";

/** Exposes a fighter's accent color to lobby CSS as `--fighter-color`. */
export const colorStyle = (color: string) =>
  ({ "--fighter-color": color }) as CSSProperties;
