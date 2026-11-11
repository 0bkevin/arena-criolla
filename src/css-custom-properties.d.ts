import "react";

// Inline styles may set CSS custom properties (`--fighter-color`, `--hp`, …).
declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
