import type { Choreography, Gesture, Hand } from "./choreography";
import type { FounderFighterId } from "./content";

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
function routine(
  name: string,
  accent: Partial<typeof rest>,
  hands: readonly [Hand, Hand],
): Choreography {
  const key = (at: number, strength: number): Gesture =>
    ({
      at,
      ...Object.fromEntries(
        Object.entries(rest).map(([field]) => [
          field,
          strength === 0
            ? 0
            : (accent[field as keyof typeof rest] ?? 0) * strength,
        ]),
      ),
    }) as Gesture;
  return {
    name,
    neck: 0.21,
    shoulders: 0.29,
    hands,
    raisedHands: [
      [-0.07, 0.3],
      [0.14, 0.27],
    ],
    beats: [
      key(0, 0),
      key(0.22, 0.25),
      key(0.5, 1),
      key(0.76, 0.35),
      key(0.9, 0),
      key(1, 0),
    ],
  };
}

// Fictional gestures inspired by each business, not claims about personal habits.
export const FOUNDER_CHOREOGRAPHIES = {
  inaki: routine(
    "Ajusta el reloj y se pone en guardia",
    { head: -0.035, front: -0.12 },
    [
      [-0.1, 0.34],
      [0.12, 0.35],
    ],
  ),
  kevin: routine(
    "Confirma el envío y entra en guardia",
    { head: -0.08, front: -0.26, frontX: 0.03, back: -0.09, lean: 0.02 },
    [
      [-0.11, 0.35],
      [0.14, 0.34],
    ],
  ),
  enrique: routine(
    "Revisa y confirma el balance",
    { head: 0.12, front: -0.25, frontY: -0.035, back: 0.11, lean: -0.025 },
    [
      [-0.1, 0.37],
      [0.13, 0.36],
    ],
  ),
  jesus: routine(
    "Confirma una transferencia",
    { head: -0.11, front: -0.3, frontX: 0.04, back: -0.12, lean: 0.03 },
    [
      [-0.11, 0.37],
      [0.13, 0.36],
    ],
  ),
  carlos: routine(
    "Gira la llave y marca la salida",
    { head: 0.1, front: -0.28, frontY: -0.04, back: 0.14, lean: -0.035 },
    [
      [-0.1, 0.36],
      [0.13, 0.35],
    ],
  ),
  victor: routine(
    "Traza la diagonal de Slash",
    { head: -0.09, front: -0.32, frontX: 0.045, back: 0.08, lean: 0.025 },
    [
      [-0.1, 0.37],
      [0.12, 0.35],
    ],
  ),
  juan: routine(
    "Conecta los puntos de la ciudad",
    { head: 0.15, front: -0.24, frontY: -0.045, back: -0.15, lean: -0.03 },
    [
      [-0.11, 0.38],
      [0.13, 0.36],
    ],
  ),
} satisfies Record<FounderFighterId, Choreography>;
