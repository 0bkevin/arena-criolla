/** The flag's arc of seven stars, drawn on the arcade UI's two-pixel grid. */
export function VenezuelaStars({ className }: { className?: string }) {
  const heights = [15, 7, 2, 0, 2, 7, 15];
  return (
    <svg
      viewBox="0 0 128 26"
      width="128"
      height="26"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {heights.map((y, index) => (
        <path
          key={index}
          transform={`translate(${5 + index * 18} ${y})`}
          d="M4 0h2v3h4v2H8v2h1v3H6V8H4v2H1V7h1V5H0V3h4z"
        />
      ))}
    </svg>
  );
}

// Original arcade patterns inspired by araguaney flowers and four cuatro strings.
// These are decorative illustrations, rather than reproductions of traditional textiles.
