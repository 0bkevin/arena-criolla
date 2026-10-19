import type { Choreography, Gesture, Hand } from "./choreography";
import type { IconFighterId } from "./content";

const rest = {
  head: 0,
  lean: 0,
  back: 0,
  front: 0,
  backX: 0,
  backY: 0,
  frontX: 0,
  frontY: 0,
  cloth: 0,
};

function greeting(
  name: string,
  hands: readonly [Hand, Hand],
  preparation: Partial<typeof rest>,
  accent: Partial<typeof rest>,
): Choreography {
  const key = (at: number, pose: Partial<typeof rest>): Gesture => ({
    at,
    ...rest,
    ...pose,
  });
  const release = Object.fromEntries(
    Object.entries(accent).map(([field, value]) => [field, value * 0.3]),
  );
  return {
    name,
    neck: 0.2,
    shoulders: 0.29,
    hands,
    raisedHands: [
      [-0.08, 0.28],
      [0.12, 0.27],
    ],
    camera: { height: 650, shift: 0 },
    beats: [
      key(0, {}),
      key(0.19, preparation),
      key(0.5, accent),
      key(0.72, release),
      key(0.9, {}),
      key(1, {}),
    ],
  };
}

// One preparation, characteristic accent and release; selection never loops.
export const ICON_CHOREOGRAPHIES = {
  lorenzo: greeting(
    "Se recoge el puño y presenta la palma",
    [
      [-0.12, 0.34],
      [0.15, 0.34],
    ],
    { head: -0.025, back: 0.05, front: -0.1 },
    { head: -0.1, back: 0.2, front: -0.42, frontX: 0.055, lean: -0.025 },
  ),
  carolina: greeting(
    "Acomoda el puño y presenta su silueta",
    [
      [-0.08, 0.39],
      [0.14, 0.36],
    ],
    { head: -0.03, front: -0.12, frontY: -0.015 },
    { head: -0.12, front: -0.46, frontY: -0.065, back: 0.15, lean: 0.025 },
  ),
  dayana: greeting(
    "Paso y saludo a la tribuna",
    [
      [-0.09, 0.37],
      [0.16, 0.34],
    ],
    { head: -0.025, back: -0.03, front: -0.13 },
    {
      head: -0.1,
      front: -0.55,
      frontX: 0.04,
      frontY: -0.055,
      back: -0.12,
      cloth: 0,
    },
  ),
  bolivar: greeting(
    "Saludo de campaña y paso firme",
    [
      [-0.1, 0.35],
      [0.17, 0.32],
    ],
    { head: -0.02, front: -0.17 },
    { head: -0.07, front: -0.68, frontY: -0.08, back: 0.12, lean: -0.025 },
  ),
  edgar: greeting(
    "Esquiva de hombro y guardia de acción",
    [
      [-0.1, 0.33],
      [0.12, 0.32],
    ],
    { lean: -0.014, head: 0.03, front: -0.08, back: -0.05 },
    { lean: -0.055, head: 0.12, back: -0.2, front: -0.32, frontX: 0.045 },
  ),
  melanio: greeting(
    "Asiente y abre la señal",
    [
      [-0.1, 0.35],
      [0.13, 0.34],
    ],
    { head: -0.025, front: -0.1, frontX: 0.03 },
    { head: -0.045, front: -0.48, frontX: 0.055, frontY: -0.055, lean: -0.018 },
  ),
} satisfies Record<IconFighterId, Choreography>;
