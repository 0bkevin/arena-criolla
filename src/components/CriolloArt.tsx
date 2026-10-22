import { useId } from "react";

type Motif = "arepa" | "cuatro" | "turpial" | "araguaney";

// Original ornaments drawn on a two-pixel grid, matching the arcade UI.
export function CriolloArt({
  kind,
  size = 32,
  className,
}: {
  kind: Motif;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      data-criollo-motif={kind}
    >
      {kind === "arepa" && (
        <>
          <path
            d="M16 14h32v4h8v8h4v20h-4v6h-8v4H16v-4H8v-6H4V26h4v-8h8z"
            fill="#17284d"
          />
          <path
            d="M16 18h32v4h8v8h2v12h-4v6h-8v4H18v-4h-8v-6H8V30h2v-8h6z"
            fill="#e7a653"
          />
          <path
            d="M18 18h28v4h8v8h2v8h-6v6H16v-4h-6V28h4v-6h4z"
            fill="#fff0bb"
          />
          <path
            d="M18 26h6v4h-6zm20-2h8v4h-8zM28 36h6v4h-6zM46 34h6v4h-6zM12 34h4v4h-4z"
            fill="#dcad6c"
          />
          <path d="M12 46h10v2h24v-2h8v4h-8v2H22v-2H12z" fill="#a96338" />
        </>
      )}
      {kind === "cuatro" && (
        <>
          <path
            d="M26 2h12v4h4v4h-4v4h4v4h-4v12h8v6h4v18h-4v6H18v-6h-4V36h4v-6h8V18h-4v-4h4v-4h-4V6h4z"
            fill="#17284d"
          />
          <path d="M28 4h8v26h-8z" fill="#a96338" />
          <path d="M26 32h12v4h8v18h-4v4H22v-4h-4V38h4v-4h4z" fill="#e8a94f" />
          <path d="M22 38h6v-4h8v4h6v14h-4v4H24v-4h-4V40h2z" fill="#ffd77c" />
          <path d="M26 40h12v10H26zM24 52h16v4H24z" fill="#643f36" />
          <path
            d="M28 8h1v46h-1zm2 0h1v46h-1zm2 0h1v46h-1zm2 0h1v46h-1z"
            fill="#fff4d8"
          />
          <path
            d="M22 6h4v4h-4zm16 0h4v4h-4zM22 14h4v4h-4zm16 0h4v4h-4z"
            fill="#fff4d8"
          />
        </>
      )}
      {kind === "turpial" && (
        <>
          <path d="M10 58h44v4H10z" fill="#648d79" />
          <path d="M24 46h4v12h-4zm16 0h4v12h-4z" fill="#ab6a43" />
          <path
            d="M16 24h8V10h4V6h16v4h4v12h10v4H46v6h4v10h-4v8H30v-4h-8v-8h-4v14h-4v6H6V42h4V30h6z"
            fill="#17284d"
          />
          <path d="M26 26h18v6h4v10h-4v6H30v-4h-6V32h2z" fill="#ffb84f" />
          <path d="M20 26h10v4h6v10H26v-4h-6z" fill="#101d34" />
          <path d="M24 28h4v4h4v6h-4v-4h-4z" fill="#fff3d9" />
          <path d="M38 14h8v6h-8z" fill="#5dcde0" />
          <path d="M40 14h4v4h-4z" fill="#fff3d9" />
          <path d="M48 22h10v4H48z" fill="#fff3d9" />
        </>
      )}
      {kind === "araguaney" && (
        <>
          <path
            d="M28 28h8v32H24v-4h4zM20 24h6v12h8v6H24v-6h-4zM36 24h6v10h-6z"
            fill="#ab6a43"
          />
          <path d="M8 38h12v4H8v-4zm32-2h12v4H40z" fill="#71b9a0" />
          {[
            [12, 22],
            [22, 12],
            [38, 12],
            [48, 24],
            [30, 28],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path d="M-4-10h8v6h6v8H4v6h-8V4h-6v-8h6z" fill="#ffd356" />
              <path d="M-2-4h4v2h4v4H2v2h-4V2h-4v-4h4z" fill="#f2a942" />
              <path d="M-2-2h4v4h-4z" fill="#fff0ae" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

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
export function CriolloPattern({
  kind = "flowers",
  className,
}: {
  kind?: "flowers" | "strings";
  className?: string;
}) {
  const id = `criollo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-criollo-pattern={kind}
      shapeRendering="crispEdges"
    >
      <defs>
        <pattern id={id} width="64" height="48" patternUnits="userSpaceOnUse">
          {kind === "flowers" ? (
            <>
              <path d="M12 12h8v6h6v8h-6v6h-8v-6H6v-8h6z" fill="currentColor" />
              <path d="M14 20h4v4h-4z" fill="#fff2d6" />
              <path d="M42 6h4v4h-4zm10 30h4v4h-4z" fill="currentColor" />
              <path
                d="M32 28h4v4h4v4h-4v4h-4v-4h-4v-4h4z"
                fill="currentColor"
                opacity=".5"
              />
            </>
          ) : (
            <>
              <path
                d="M6 0h1v48H6zm4 0h1v48h-1zm4 0h1v48h-1zm4 0h1v48h-1z"
                fill="currentColor"
                opacity=".45"
              />
              <path
                d="M34 10h8v4h4v8h-4v4h-8v-4h-4v-8h4z"
                fill="currentColor"
              />
              <path d="M36 16h4v4h-4zM48 34h4v4h-4z" fill="#fff2d6" />
            </>
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
