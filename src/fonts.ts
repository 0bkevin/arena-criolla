import { assetUrl } from "./asset-url";

const INTERFACE_FONTS = [
  {
    family: "Barlow Condensed",
    file: "barlow-800.woff2",
    weight: "700 900",
    style: "normal",
    entrance: false,
  },
  {
    family: "Barlow Condensed",
    file: "barlow-800-italic.woff2",
    weight: "700 900",
    style: "italic",
    entrance: true,
  },
  {
    family: "DM Sans",
    file: "dm-sans-400.woff2",
    weight: "400 600",
    style: "normal",
    entrance: true,
  },
  {
    family: "DM Sans",
    file: "dm-sans-700.woff2",
    weight: "700 900",
    style: "normal",
    entrance: false,
  },
  {
    family: "Pixelify Sans",
    file: "pixelify-sans.woff2",
    weight: "400 700",
    style: "normal",
    entrance: false,
  },
];

export type InterfaceFontLoading = {
  entranceReady: Promise<{ displayReady: boolean }>;
  ready: Promise<void>;
  activateInterface: () => void;
};

async function settleFonts(
  faces: FontFace[],
  deadline: number,
): Promise<FontFace[]> {
  // Freeze each group's selection at its deadline. A late download must never
  // replace the fallback text selected for that group.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(faces.map((face) => face.load())),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, deadline);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }

  return faces.filter((face) => face.status === "loaded");
}

function registerFonts(faces: FontFace[]): void {
  for (const face of faces) document.fonts.add(face);
}

export function loadInterfaceFonts(): InterfaceFontLoading {
  if (typeof FontFace === "undefined" || !document.fonts) {
    const ready = Promise.resolve();
    return {
      entranceReady: Promise.resolve({ displayReady: false }),
      ready,
      activateInterface: () => {},
    };
  }

  const faces = INTERFACE_FONTS.map(
    ({ family, file, weight, style, entrance }) => ({
      entrance,
      face: new FontFace(
        family,
        `url("${assetUrl(`/fonts/${file}`)}") format("woff2")`,
        {
          weight,
          style,
        },
      ),
    }),
  );
  const entranceReady = settleFonts(
    faces.filter(({ entrance }) => entrance).map(({ face }) => face),
    1200,
  ).then((selected) => {
    registerFonts(selected);
    return { displayReady: selected.some((face) => face.style === "italic") };
  });
  const remainingReady = settleFonts(
    faces.filter(({ entrance }) => !entrance).map(({ face }) => face),
    3000,
  );
  let activationRequested = false;
  let remainingSelection: FontFace[] | undefined;
  const activateSelectedFonts = () => {
    if (!activationRequested || !remainingSelection) return;
    registerFonts(remainingSelection);
    remainingSelection = undefined;
  };
  const ready = Promise.all([entranceReady, remainingReady]).then(
    ([, selected]) => {
      remainingSelection = selected;
      activateSelectedFonts();
    },
  );
  return {
    entranceReady,
    ready,
    activateInterface: () => {
      // Wait for the intro to leave before exposing other styles from the same
      // families: they could otherwise replace a failed entrance font's fallback.
      activationRequested = true;
      activateSelectedFonts();
    },
  };
}
