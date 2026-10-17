const shapes = {
  dice: "M3 1h10v2h2v10h-2v2H3v-2H1V3h2zm1 3v2h2V4zm6 0v2h2V4zM7 7v2h2V7zM4 10v2h2v-2zm6 0v2h2v-2z",
  heart: "M2 3h4v1h4V3h4v2h1v5h-2v2h-2v2H5v-2H3v-2H1V5h1z",
  arrow: "M9 2h2v2h2v2h2v4h-2v2h-2v2H9v-4H1V6h8z",
  star: "M6 1h4v4h4v4h-4v5H6V9H1V5h5z",
  coin: "M4 1h8v2h2v2h1v6h-1v2h-2v2H4v-2H2v-2H1V5h1V3h2zm3 3v8h2V4z",
  gamepad:
    "M3 3h10v2h2v8h-4v-2H5v2H1V5h2zm1 3v2H2v2h2v2h2v-2h2V8H6V6zm6 1v2h2V7zm3 3v2h2v-2z",
  bolt: "M8 1h5v2h-2v3H9v2h4v2h-2v2H9v2H6v-4H3V8h2V5h1V3h2z",
  swords:
    "M1 1h3v2h2v2h2v2h2V5h2V3h2V1h2v4h-2v2h-2v2h-2v2h2v2h2v2h-2v-2h-2v-2H8v2H6v2H4v-2h2v-2h2V9H6V7H4V5H2V3H1z",
} as const;

export function PixelIcon({
  kind,
  size = 18,
  className,
}: {
  kind: keyof typeof shapes;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      <path d={shapes[kind]} fillRule="evenodd" />
    </svg>
  );
}
