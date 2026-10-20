const INTERFACE_FONTS = [
  {
    family: "Barlow Condensed",
    file: "barlow-800.ttf",
    weight: "700 900",
    style: "normal",
  },
  {
    family: "Barlow Condensed",
    file: "barlow-800-italic.ttf",
    weight: "700 900",
    style: "italic",
  },
  {
    family: "DM Sans",
    file: "dm-sans-400.ttf",
    weight: "400 600",
    style: "normal",
  },
  {
    family: "DM Sans",
    file: "dm-sans-700.ttf",
    weight: "700 900",
    style: "normal",
  },
  {
    family: "Pixelify Sans",
    file: "pixelify-sans.ttf",
    weight: "400 700",
    style: "normal",
  },
];

export async function loadInterfaceFonts(): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts) return;

  // Keep faces outside the document until startup settles. A download that
  // finishes after the deadline must never replace already visible fallback text.
  const faces = INTERFACE_FONTS.map(
    ({ family, file, weight, style }) =>
      new FontFace(family, `url("/fonts/${file}") format("truetype")`, {
        weight,
        style,
      }),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(faces.map((face) => face.load())),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 3000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }

  for (const face of faces) {
    if (face.status === "loaded") document.fonts.add(face);
  }
}
