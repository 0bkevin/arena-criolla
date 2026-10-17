import type { FighterId } from "./content";
import { PRESENTATIONS } from "./presentation";

export interface Gesture {
  at: number;
  head: number;
  lean: number;
  back: number;
  front: number;
  backX: number;
  backY: number;
  frontX: number;
  frontY: number;
  cloth: number;
}
export type Hand = readonly [number, number];
export interface RigidPart {
  zones: { from: Hand; to: Hand; radius: number }[];
  pivot: Hand;
  bind: "body" | "back" | "front" | "head";
  rock?: number;
  frames?: number[];
}
export interface Choreography {
  name: string;
  camera?: { height: number; shift: number };
  neck: number;
  headWidth?: number;
  shoulders: number;
  hands: readonly [Hand, Hand];
  raisedHands?: readonly [Hand, Hand];
  rigidParts?: RigidPart[];
  beats: Gesture[];
}
type Key = Partial<Omit<Gesture, "at">> & { at: number };
export const REST: Omit<Gesture, "at"> = {
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
const beat = (key: Key): Gesture => ({ ...REST, ...key });
function routine(
  name: string,
  hands: readonly [Hand, Hand],
  keys: Key[],
  neck = 0.21,
  shoulders = 0.28,
): Choreography {
  // One preparation, one characteristic accent, then a single release.
  // Earlier routines alternated the limbs several times and read as a loop.
  const energy = (key: Key) =>
    Object.keys(REST).reduce(
      (total, field) =>
        total +
        (key[field as keyof typeof REST] ?? 0) ** 2 *
          (field === "cloth" ? 0.001 : 1),
      0,
    );
  const accent = keys.reduce(
    (best, key) => (energy(key) > energy(best) ? key : best),
    keys[0],
  );
  const scaled = (at: number, strength: number) =>
    beat(
      Object.fromEntries([
        ["at", at],
        ...Object.keys(REST).map((field) => [
          field,
          (accent[field as keyof typeof REST] ?? 0) * strength,
        ]),
      ]) as Key,
    );
  return {
    name,
    hands,
    neck,
    shoulders,
    beats: [
      beat({ at: 0 }),
      scaled(0.22, 0.25),
      scaled(0.5, 1),
      scaled(0.76, 0.35),
      beat({ at: 0.9 }),
      beat({ at: 1 }),
    ],
  };
}

// Hands are audited separately on each presentation pose, in body-height units
// relative to the head centre, after normalizing the original atlas direction.
// These are theatrical adaptations of public personas, never claimed as real rituals.
export const CHOREOGRAPHIES: Record<FighterId, Choreography> = {
  zavarce: routine(
    "Consulta, confirma y señala",
    [
      [-0.11, 0.34],
      [0.12, 0.35],
    ],
    [
      { at: 0.12, head: 0.09, front: 0.12, frontY: 0.035 },
      { at: 0.27, head: 0.14, front: 0.2, frontX: -0.025, frontY: -0.04 },
      {
        at: 0.43,
        head: -0.065,
        front: -0.28,
        frontX: 0.025,
        frontY: -0.055,
        lean: -0.025,
      },
      { at: 0.57, front: 0.15, frontY: -0.025 },
      { at: 0.7, front: -0.22, frontX: 0.04, head: -0.035 },
      { at: 0.87, head: 0.03, lean: 0.025 },
    ],
  ),
  vallenilla: routine(
    "Tres acentos con la mano",
    [
      [-0.1, 0.35],
      [0.12, 0.35],
    ],
    [
      { at: 0.12, head: 0.075, front: 0.16 },
      { at: 0.26, front: -0.3, frontY: -0.045, lean: -0.035 },
      { at: 0.39, front: 0.17, head: 0.065 },
      { at: 0.51, front: -0.26, frontX: 0.035, head: -0.04 },
      { at: 0.64, front: 0.15 },
      { at: 0.76, front: -0.33, frontY: -0.03, lean: -0.045 },
      { at: 0.9, head: 0.04 },
    ],
  ),
  javier: routine(
    "Brazos cruzados y reacción",
    [
      [-0.1, 0.34],
      [0.11, 0.32],
    ],
    [
      { at: 0.13, head: -0.14, lean: -0.025, back: -0.12, front: 0.12 },
      { at: 0.3, head: 0.12, lean: 0.04, back: 0.18, front: -0.18 },
      {
        at: 0.47,
        head: -0.19,
        back: -0.24,
        backX: -0.035,
        front: 0.26,
        frontX: 0.045,
      },
      { at: 0.63, head: 0.13, lean: -0.035 },
      { at: 0.77, head: -0.08, back: 0.1, front: -0.12 },
      { at: 0.89, head: 0.025 },
    ],
  ),
  capriles: routine(
    "Saludo casual, asentimiento y guardia",
    [
      [-0.08, 0.35],
      [0.11, 0.34],
    ],
    [
      { at: 0.13, head: 0.035, front: 0.12 },
      {
        at: 0.3,
        front: -0.28,
        frontX: 0.015,
        frontY: -0.035,
        head: 0.065,
        lean: -0.015,
      },
      { at: 0.44, front: -0.25, frontY: -0.025, head: -0.075 },
      { at: 0.58, front: -0.17, frontY: -0.025, head: 0.1 },
      { at: 0.72, front: 0.1, head: -0.04, back: -0.08 },
      { at: 0.87, head: 0.025, lean: 0.015 },
    ],
    0.22,
    0.29,
  ),
  renny: routine(
    "Abre el programa con la palma",
    [
      [-0.06, 0.4],
      [0.22, 0.37],
    ],
    [
      { at: 0.13, head: 0.025, front: 0.16, back: 0.06 },
      {
        at: 0.3,
        front: -0.27,
        frontX: 0.055,
        frontY: -0.045,
        lean: -0.045,
        head: -0.04,
      },
      { at: 0.46, front: 0.12, frontX: 0.02, head: 0.08 },
      { at: 0.61, front: -0.2, frontX: 0.07, back: -0.11, lean: 0.035 },
      { at: 0.75, head: -0.06, front: -0.1, frontY: -0.025 },
      { at: 0.88, head: 0.02 },
    ],
  ),
  gomez: routine(
    "Revista solemne y saludo corto",
    [
      [-0.08, 0.31],
      [0.12, 0.31],
    ],
    [
      { at: 0.14, head: -0.095, lean: -0.025 },
      { at: 0.31, head: 0.055, front: -0.22, frontY: -0.035, frontX: -0.025 },
      { at: 0.47, head: -0.045, front: -0.23, frontY: -0.04 },
      { at: 0.62, front: 0.12, head: 0.085 },
      { at: 0.78, head: -0.055, back: 0.1, lean: 0.025 },
      { at: 0.9, head: 0.015 },
    ],
    0.22,
    0.28,
  ),
  simon: routine(
    "Inclinación de sombrero y compás llanero",
    [
      [-0.1, 0.51],
      [0.14, 0.49],
    ],
    [
      { at: 0.12, head: 0.035, front: 0.12 },
      { at: 0.27, front: -0.25, frontX: 0.025, frontY: -0.035, head: 0.09 },
      {
        at: 0.43,
        head: -0.055,
        front: -0.1,
        frontY: -0.06,
        back: -0.09,
        lean: -0.025,
      },
      { at: 0.56, front: 0.17, frontY: -0.025, head: 0.055, lean: 0.025 },
      { at: 0.68, front: -0.18, back: 0.12, head: -0.055, lean: -0.03 },
      { at: 0.8, front: 0.13, head: 0.04 },
      { at: 0.9, head: 0.025 },
    ],
    0.25,
    0.31,
  ),
  conde: routine(
    "Palma de bienvenida y remate del Conde",
    [
      [-0.12, 0.51],
      [0.15, 0.51],
    ],
    [
      { at: 0.13, head: 0.1, front: 0.12 },
      { at: 0.3, front: -0.23, frontX: 0.025, frontY: -0.035, head: 0.095 },
      { at: 0.44, head: -0.08, front: -0.21, frontY: -0.025 },
      { at: 0.6, front: 0.18, head: 0.13, lean: 0.04 },
      { at: 0.74, front: -0.19, frontY: -0.05, head: -0.075 },
      { at: 0.89, head: 0.025 },
    ],
    0.25,
    0.32,
  ),
  emilio: routine(
    "Palma, cambio de actitud y reverencia",
    [
      [-0.075, 0.49],
      [0.23, 0.39],
    ],
    [
      { at: 0.13, head: -0.08, front: 0.14 },
      {
        at: 0.29,
        front: -0.23,
        frontX: 0.055,
        back: 0.12,
        lean: -0.045,
        head: 0.06,
      },
      { at: 0.44, head: -0.16, front: 0.14, lean: 0.04 },
      { at: 0.6, head: 0.13, front: -0.19, frontY: -0.035, back: -0.12 },
      { at: 0.76, head: 0.1, lean: 0.055, front: 0.09 },
      { at: 0.9, head: -0.02 },
    ],
  ),
  maite: routine(
    "Gala, micrófono y saludo amplio",
    [
      [-0.09, 0.39],
      [0.08, 0.28],
    ],
    [
      { at: 0.12, head: 0.07, back: 0.12 },
      {
        at: 0.29,
        back: -0.26,
        backX: -0.05,
        backY: -0.06,
        front: -0.1,
        head: -0.035,
        lean: -0.035,
      },
      { at: 0.45, back: -0.15, backX: -0.02, head: 0.07, cloth: 0.7 },
      { at: 0.61, back: 0.16, head: -0.045, lean: 0.045, cloth: -0.6 },
      { at: 0.77, head: 0.1, front: -0.1, back: -0.09, cloth: 0.3 },
      { at: 0.9, head: 0.025 },
    ],
  ),
  oscar: routine(
    "Dos acentos de salsa y palmas abiertas",
    [
      [-0.19, 0.4],
      [0.22, 0.4],
    ],
    [
      { at: 0.12, lean: 0.045, head: -0.035, back: 0.15, front: -0.15 },
      { at: 0.27, lean: -0.07, head: 0.07, back: -0.22, front: 0.22 },
      { at: 0.42, lean: 0.06, head: -0.06, back: 0.25, front: -0.24 },
      { at: 0.57, lean: -0.065, head: 0.055, back: -0.22, front: 0.2 },
      { at: 0.73, lean: 0.035, head: -0.04, front: -0.19, frontX: 0.04 },
      { at: 0.88, head: 0.025 },
    ],
  ),
  puma: routine(
    "Invita al público y levanta el pecho",
    [
      [-0.08, 0.48],
      [0.18, 0.37],
    ],
    [
      { at: 0.13, head: 0.06, front: 0.12 },
      {
        at: 0.31,
        front: -0.32,
        frontX: 0.06,
        frontY: -0.055,
        lean: -0.04,
        head: -0.08,
      },
      { at: 0.48, front: -0.18, head: -0.1, back: -0.08 },
      { at: 0.64, front: 0.16, head: 0.08, lean: 0.03 },
      { at: 0.79, front: -0.14, head: -0.04 },
      { at: 0.91, head: 0.02 },
    ],
  ),
  chataing: routine(
    "Pide un segundo, mira y remata",
    [
      [-0.05, 0.36],
      [0.13, 0.51],
    ],
    [
      { at: 0.13, head: 0.13, front: 0.12 },
      { at: 0.3, front: -0.28, frontY: -0.14, frontX: 0.025, head: -0.035 },
      { at: 0.45, head: -0.17, front: -0.15, frontY: -0.07, lean: -0.03 },
      { at: 0.61, head: 0.12, front: 0.17, lean: 0.035 },
      { at: 0.77, head: -0.09, front: -0.18, frontY: -0.035 },
      { at: 0.9, head: 0.025 },
    ],
  ),
  george: routine(
    "Abre la palma y marca el remate",
    [
      [-0.04, 0.29],
      [0.22, 0.34],
    ],
    [
      { at: 0.12, head: 0.085, front: 0.14 },
      { at: 0.28, front: -0.28, frontX: 0.055, head: -0.085, lean: -0.04 },
      { at: 0.44, front: 0.17, head: 0.13, lean: 0.035 },
      { at: 0.61, front: -0.32, frontX: 0.035, frontY: -0.03, head: -0.12 },
      { at: 0.77, front: 0.1, head: 0.06 },
      { at: 0.89, head: -0.025 },
    ],
  ),
  mcm: routine(
    "Asentimiento y gesto de encuentro",
    [
      [-0.09, 0.33],
      [0.12, 0.33],
    ],
    [
      { at: 0.13, head: 0.065, front: 0.12 },
      { at: 0.3, front: -0.3, frontY: -0.075, frontX: 0.025, head: -0.055 },
      { at: 0.47, front: -0.17, head: 0.095, lean: 0.025 },
      { at: 0.62, front: 0.16, head: -0.05 },
      { at: 0.78, front: -0.15, back: -0.1, head: 0.04 },
      { at: 0.9, head: 0.015 },
    ],
  ),
  ali: routine(
    "Compás de guitarra y mano abierta",
    [
      [0.05, 0.42],
      [0.28, 0.33],
    ],
    [
      { at: 0.12, back: -0.2, backY: -0.04, head: -0.04 },
      { at: 0.27, back: 0.28, backY: 0.04, head: 0.075, lean: 0.025 },
      { at: 0.4, back: -0.22, backY: -0.035, head: -0.055 },
      { at: 0.54, back: 0.3, backY: 0.045, head: 0.065 },
      { at: 0.69, front: -0.24, frontY: -0.045, head: -0.04 },
      { at: 0.84, front: 0.1, head: 0.035 },
    ],
  ),
  gualberto: routine(
    "Compás de cuatro y saludo de escena",
    [
      [-0.04, 0.4],
      [0.2, 0.36],
    ],
    [
      { at: 0.13, back: -0.26, backY: -0.035, head: 0.065 },
      { at: 0.27, back: 0.32, backY: 0.035, head: -0.055, lean: -0.035 },
      { at: 0.41, back: -0.28, backY: -0.035, head: 0.07, lean: 0.025 },
      { at: 0.55, back: 0.27, backY: 0.04, head: -0.035 },
      { at: 0.7, front: -0.2, frontY: -0.04, head: 0.095 },
      { at: 0.86, head: 0.025 },
    ],
    0.24,
    0.3,
  ),
  reynaldo: routine(
    "Micrófono al pecho e invitación llanera",
    [
      [-0.04, 0.31],
      [0.2, 0.35],
    ],
    [
      { at: 0.13, back: -0.13, backY: -0.035, head: 0.06 },
      { at: 0.3, front: -0.29, frontX: 0.055, head: -0.04, lean: -0.04 },
      { at: 0.46, front: 0.16, head: 0.075 },
      { at: 0.61, front: -0.24, frontX: 0.04, back: -0.1, head: -0.06 },
      { at: 0.78, head: 0.09, lean: 0.035 },
      { at: 0.89, head: 0.02 },
    ],
  ),
  dudamel: routine(
    "Preparación, dos compases y corte",
    [
      [0.04, 0.35],
      [0.23, 0.32],
    ],
    [
      { at: 0.13, back: -0.34, backY: -0.065, front: 0.2, head: -0.08 },
      { at: 0.28, back: 0.38, backY: 0.045, front: -0.24, lean: 0.055 },
      {
        at: 0.42,
        back: -0.4,
        backY: -0.07,
        front: 0.25,
        head: -0.09,
        lean: -0.035,
      },
      {
        at: 0.56,
        back: 0.4,
        backY: 0.055,
        front: -0.27,
        head: 0.07,
        lean: 0.05,
      },
      { at: 0.71, back: -0.28, front: -0.32, frontY: -0.04, head: -0.04 },
      { at: 0.85, head: 0.035, back: 0.1 },
    ],
  ),
  danny: routine(
    "Rebote de hombros y paso urbano",
    [
      [-0.04, 0.31],
      [0.12, 0.5],
    ],
    [
      { at: 0.12, head: -0.07, lean: 0.045, back: 0.13, front: -0.15 },
      { at: 0.27, head: 0.1, lean: -0.07, back: -0.19, front: 0.22 },
      { at: 0.43, head: -0.095, lean: 0.07, back: 0.2, front: -0.23 },
      { at: 0.59, head: 0.075, lean: -0.055, back: -0.15, front: 0.19 },
      { at: 0.76, head: -0.045, front: -0.12 },
      { at: 0.89, head: 0.025 },
    ],
  ),
  nacho: routine(
    "Paso lateral y dos marcas urbanas",
    [
      [-0.08, 0.34],
      [0.13, 0.42],
    ],
    [
      { at: 0.13, lean: -0.06, head: 0.065, back: -0.17, front: 0.19 },
      { at: 0.29, lean: 0.065, head: -0.07, back: 0.23, front: -0.26 },
      { at: 0.45, lean: -0.055, head: 0.08, back: -0.22, front: 0.23 },
      { at: 0.61, front: -0.34, frontY: -0.035, head: -0.055 },
      { at: 0.78, lean: 0.035, head: 0.035 },
      { at: 0.9, head: 0.02 },
    ],
  ),
  sarcos: routine(
    "Bienvenida amplia con micrófono",
    [
      [-0.025, 0.32],
      [0.24, 0.32],
    ],
    [
      { at: 0.12, head: 0.07, front: 0.12 },
      {
        at: 0.29,
        front: -0.3,
        frontX: 0.065,
        frontY: -0.045,
        head: -0.055,
        lean: -0.04,
      },
      { at: 0.46, front: 0.17, head: 0.075 },
      { at: 0.62, front: -0.22, frontX: 0.04, back: -0.1, head: -0.06 },
      { at: 0.79, head: 0.1, lean: 0.04 },
      { at: 0.91, head: 0.02 },
    ],
  ),
  yordano: routine(
    "Palmas abiertas y pulso de cantautor",
    [
      [-0.15, 0.44],
      [0.2, 0.38],
    ],
    [
      { at: 0.14, head: 0.055, back: 0.12, front: 0.1 },
      {
        at: 0.31,
        head: -0.075,
        back: -0.21,
        front: -0.26,
        frontX: 0.045,
        lean: -0.035,
      },
      { at: 0.48, head: 0.085, back: 0.16, front: 0.13, lean: 0.035 },
      { at: 0.65, head: -0.055, front: -0.22, back: -0.12 },
      { at: 0.81, head: 0.045, front: 0.08 },
      { at: 0.92, head: 0.015 },
    ],
  ),
  lila: routine(
    "Pose de diva y saludo expansivo",
    [
      [-0.09, 0.36],
      [0.14, 0.49],
    ],
    [
      { at: 0.13, head: -0.07, lean: -0.035, front: 0.14 },
      {
        at: 0.3,
        front: -0.36,
        frontY: -0.14,
        frontX: 0.045,
        head: -0.1,
        back: -0.1,
      },
      { at: 0.47, front: -0.2, frontY: -0.07, head: 0.065, cloth: 0.55 },
      { at: 0.63, front: 0.15, head: -0.085, lean: 0.04, cloth: -0.45 },
      { at: 0.79, head: 0.075, front: -0.15 },
      { at: 0.91, head: 0.02 },
    ],
  ),
  rummy: routine(
    "Saludo del sombrero y palma llanera",
    [
      [-0.19, 0.27],
      [0.07, 0.43],
    ],
    [
      { at: 0.13, head: 0.06, back: 0.16 },
      { at: 0.3, back: 0.34, backX: 0.055, backY: -0.055, head: 0.09 },
      {
        at: 0.46,
        head: -0.06,
        back: -0.3,
        backX: -0.055,
        front: -0.24,
        frontY: -0.04,
      },
      { at: 0.62, back: 0.2, head: 0.07, lean: 0.035 },
      { at: 0.78, back: -0.16, head: -0.04, cloth: 0.25 },
      { at: 0.89, head: 0.02 },
    ],
    0.25,
    0.31,
  ),
  chiqui: routine(
    "Mano en cadera y saludo de gala",
    [
      [-0.11, 0.34],
      [0.13, 0.49],
    ],
    [
      { at: 0.13, lean: -0.035, head: -0.055, front: 0.12 },
      { at: 0.3, front: -0.34, frontY: -0.125, head: 0.07, frontX: 0.03 },
      { at: 0.47, front: 0.2, head: -0.06, cloth: 0.65 },
      {
        at: 0.63,
        front: -0.22,
        frontY: -0.075,
        lean: 0.045,
        head: 0.075,
        cloth: -0.45,
      },
      { at: 0.8, head: 0.045, front: 0.08 },
      { at: 0.91, head: 0.02 },
    ],
  ),
  norkys: routine(
    "Entrada de pasarela y giro de hombros",
    [
      [-0.12, 0.5],
      [0.15, 0.5],
    ],
    [
      { at: 0.13, head: -0.06, lean: -0.055, back: 0.15, front: -0.13 },
      { at: 0.3, head: 0.08, lean: 0.065, back: -0.2, front: 0.2 },
      { at: 0.46, front: -0.3, frontY: -0.115, head: -0.08, lean: -0.025 },
      { at: 0.63, front: 0.17, head: 0.085, lean: 0.04 },
      { at: 0.8, head: -0.035, back: -0.1 },
      { at: 0.9, head: 0.02 },
    ],
  ),
  gabriela: routine(
    "Dos actitudes y saludo de actriz",
    [
      [-0.11, 0.33],
      [0.12, 0.51],
    ],
    [
      { at: 0.13, head: -0.12, lean: -0.035 },
      { at: 0.3, head: 0.13, lean: 0.055, front: -0.28, frontY: -0.11 },
      { at: 0.47, head: -0.14, front: 0.15, back: -0.12 },
      { at: 0.64, head: 0.1, front: -0.22, frontY: -0.06, lean: -0.04 },
      { at: 0.8, head: 0.075, front: 0.1 },
      { at: 0.91, head: 0.025 },
    ],
  ),
  amanda: routine(
    "Reflexión, mirada y gesto abierto",
    [
      [-0.12, 0.35],
      [0.075, 0.23],
    ],
    [
      { at: 0.14, head: 0.14, front: 0.16, frontX: -0.025, frontY: -0.025 },
      { at: 0.32, head: -0.11, front: -0.18, frontX: 0.045, lean: -0.03 },
      { at: 0.49, head: 0.13, front: 0.19, back: 0.1 },
      {
        at: 0.66,
        head: -0.07,
        front: -0.26,
        frontX: 0.055,
        frontY: -0.045,
        lean: 0.04,
      },
      { at: 0.81, head: 0.055 },
      { at: 0.91, head: 0.015 },
    ],
  ),
  lele: routine(
    "Selfie, inclinación y saludo al clip",
    [
      [-0.1, 0.33],
      [0.1, 0.28],
    ],
    [
      { at: 0.12, front: -0.26, frontY: -0.045, head: -0.11 },
      {
        at: 0.28,
        head: 0.15,
        lean: 0.05,
        front: -0.17,
        back: -0.22,
        backY: -0.075,
      },
      { at: 0.44, head: -0.13, back: 0.22, front: -0.1, lean: -0.045 },
      { at: 0.59, head: 0.09, back: -0.27, backY: -0.05 },
      { at: 0.75, head: -0.04, front: 0.16, back: 0.13 },
      { at: 0.89, head: 0.025 },
    ],
  ),
  giuseppe: routine(
    "Observa, confirma y abre las manos",
    [
      [-0.12, 0.53],
      [0.13, 0.51],
    ],
    [
      { at: 0.14, head: 0.12, front: 0.15 },
      {
        at: 0.32,
        head: -0.105,
        front: -0.24,
        frontY: -0.05,
        back: -0.15,
        backY: -0.04,
      },
      { at: 0.49, head: 0.12, front: 0.16, lean: 0.035 },
      { at: 0.65, head: -0.065, front: -0.24, frontX: 0.045, back: 0.13 },
      { at: 0.81, head: 0.06 },
      { at: 0.92, head: 0.015 },
    ],
  ),
  silbon: routine(
    "Carga del saco y amenaza encorvada",
    [
      [-0.16, 0.52],
      [0.2, 0.5],
    ],
    [
      { at: 0.12, head: 0.13, lean: 0.075, back: -0.2, cloth: 0.45 },
      {
        at: 0.28,
        head: -0.1,
        lean: -0.045,
        front: -0.23,
        frontY: -0.09,
        backY: -0.065,
      },
      { at: 0.44, head: 0.16, lean: 0.08, front: 0.2, cloth: -0.5 },
      { at: 0.6, head: -0.1, front: -0.3, frontY: -0.11, lean: -0.035 },
      { at: 0.76, head: 0.08, back: -0.14, cloth: 0.35 },
      { at: 0.89, head: 0.035 },
    ],
    0.25,
    0.33,
  ),
  llorona: routine(
    "Lleva las manos al rostro y las extiende",
    [
      [-0.12, 0.37],
      [0.2, 0.37],
    ],
    [
      { at: 0.13, head: 0.12, back: -0.17, front: 0.16, cloth: 0.6 },
      {
        at: 0.3,
        back: -0.33,
        backY: -0.105,
        front: -0.3,
        frontY: -0.13,
        head: 0.16,
        lean: 0.035,
      },
      { at: 0.46, head: -0.1, back: 0.22, front: 0.25, cloth: -0.8 },
      {
        at: 0.63,
        back: -0.29,
        front: -0.34,
        frontX: 0.05,
        head: 0.085,
        cloth: 0.75,
      },
      { at: 0.8, head: -0.055, front: 0.14, cloth: -0.4 },
      { at: 0.92, head: 0.02 },
    ],
  ),
  sayona: routine(
    "Aparta el mantón y revela la mirada",
    [
      [-0.17, 0.45],
      [0.18, 0.35],
    ],
    [
      { at: 0.13, head: 0.11, front: 0.2, back: 0.17, cloth: 0.65 },
      {
        at: 0.3,
        front: -0.34,
        frontY: -0.045,
        back: -0.22,
        backX: -0.05,
        head: -0.13,
        cloth: -0.85,
      },
      { at: 0.47, head: 0.13, lean: 0.045, front: 0.18, cloth: 0.75 },
      { at: 0.64, head: -0.1, front: -0.29, frontX: 0.035, cloth: -0.65 },
      { at: 0.81, head: 0.055, back: 0.1, cloth: 0.35 },
      { at: 0.91, head: 0.02 },
    ],
  ),
  lionza: routine(
    "Palmas ceremoniales de Sorte",
    [
      [-0.1, 0.32],
      [0.16, 0.35],
    ],
    [
      { at: 0.13, head: 0.09, back: 0.15, front: 0.14, cloth: 0.25 },
      {
        at: 0.3,
        back: -0.28,
        backX: -0.035,
        front: -0.32,
        frontY: -0.065,
        head: -0.08,
      },
      {
        at: 0.46,
        back: -0.17,
        front: -0.2,
        head: -0.045,
        lean: -0.04,
        cloth: 0.6,
      },
      { at: 0.63, head: 0.1, back: 0.2, front: 0.19, cloth: -0.5 },
      { at: 0.8, head: -0.045, front: -0.18, cloth: 0.25 },
      { at: 0.9, head: 0.025 },
    ],
    0.24,
    0.31,
  ),
  florentino: routine(
    "Marca la copla y responde con la mano",
    [
      [-0.1, 0.38],
      [0.17, 0.48],
    ],
    [
      { at: 0.12, head: 0.065, back: -0.18, front: 0.15 },
      {
        at: 0.28,
        head: -0.065,
        back: 0.25,
        front: -0.3,
        frontY: -0.125,
        lean: -0.035,
      },
      { at: 0.43, head: 0.085, back: -0.22, front: 0.14 },
      { at: 0.58, head: -0.055, back: 0.24, front: -0.25, frontX: 0.04 },
      { at: 0.75, head: 0.1, lean: 0.035, back: -0.1 },
      { at: 0.89, head: 0.025 },
    ],
    0.25,
    0.32,
  ),
  diablo: routine(
    "Amenaza, paso y manos de retador",
    [
      [-0.1, 0.36],
      [0.12, 0.33],
    ],
    [
      { at: 0.12, head: 0.1, lean: 0.055, back: 0.19, front: 0.16, cloth: 0.4 },
      {
        at: 0.29,
        head: -0.14,
        lean: -0.065,
        back: -0.3,
        front: -0.33,
        frontY: -0.04,
      },
      { at: 0.45, head: 0.11, back: 0.18, front: 0.23, cloth: -0.55 },
      {
        at: 0.62,
        head: -0.12,
        front: -0.32,
        frontX: 0.05,
        back: -0.22,
        lean: -0.045,
      },
      { at: 0.79, head: 0.06, cloth: 0.3 },
      { at: 0.9, head: 0.02 },
    ],
    0.25,
    0.32,
  ),
  knoche: routine(
    "Revisa el frasco y ajusta los lentes",
    [
      [-0.12, 0.34],
      [0.13, 0.31],
    ],
    [
      { at: 0.13, head: 0.14, front: 0.14 },
      {
        at: 0.31,
        back: 0.18,
        backY: 0.07,
        front: -0.2,
        frontY: -0.025,
        frontX: -0.03,
        head: 0.18,
        lean: 0.055,
      },
      { at: 0.47, head: -0.12, front: -0.2, frontX: 0.025 },
      { at: 0.63, head: 0.1, front: 0.19, frontY: 0.03, back: -0.12 },
      { at: 0.79, head: -0.055, lean: -0.025 },
      { at: 0.9, head: 0.025 },
    ],
    0.26,
    0.33,
  ),
  momoy: routine(
    "Apoya el bastón y ofrece la palma",
    [
      [-0.16, 0.41],
      [0.15, 0.45],
    ],
    [
      { at: 0.13, head: 0.12, back: 0.14, backY: 0.04, lean: 0.045 },
      {
        at: 0.3,
        head: -0.065,
        front: -0.24,
        frontY: -0.04,
        back: -0.1,
        cloth: 0.35,
      },
      { at: 0.46, head: 0.11, front: 0.18, frontY: -0.035, lean: -0.035 },
      { at: 0.63, head: -0.1, front: -0.26, frontX: 0.035, cloth: -0.3 },
      { at: 0.8, head: 0.055, back: 0.09 },
      { at: 0.91, head: 0.025 },
    ],
    0.36,
    0.43,
  ),
  tiotigre: routine(
    "Saca pecho y reta con las garras",
    [
      [-0.15, 0.36],
      [0.17, 0.39],
    ],
    [
      { at: 0.12, head: -0.1, lean: -0.06, back: 0.21, front: 0.2, cloth: 0.6 },
      {
        at: 0.29,
        head: 0.13,
        lean: 0.065,
        back: -0.26,
        front: -0.24,
        frontY: -0.025,
      },
      { at: 0.45, head: -0.12, back: 0.27, front: 0.25, cloth: -0.65 },
      {
        at: 0.61,
        head: 0.11,
        front: -0.34,
        frontX: 0.045,
        back: -0.26,
        lean: -0.05,
      },
      { at: 0.78, head: -0.06, cloth: 0.3 },
      { at: 0.9, head: 0.02 },
    ],
    0.25,
    0.32,
  ),
  tioconejo: routine(
    "Brinca, ladea las orejas y piensa",
    [
      [-0.12, 0.46],
      [0.1, 0.4],
    ],
    [
      { at: 0.12, head: 0.14, lean: 0.06, back: 0.21, front: 0.16 },
      { at: 0.27, head: -0.17, lean: -0.055, back: -0.27, front: -0.3 },
      { at: 0.43, head: 0.19, front: 0.24, back: 0.22 },
      { at: 0.59, head: -0.15, front: -0.27, frontY: -0.055, lean: -0.045 },
      { at: 0.75, head: 0.13, front: 0.16, cloth: 0.4 },
      { at: 0.9, head: 0.035 },
    ],
    0.35,
    0.42,
  ),
};

// Frame 1 is audited independently: crossed arms and props are not generic palms.
CHOREOGRAPHIES.javier.raisedHands = [
  [0.055, 0.27],
  [-0.02, 0.27],
];
CHOREOGRAPHIES.mcm.raisedHands = [
  [0.065, 0.28],
  [-0.015, 0.275],
];
CHOREOGRAPHIES.gomez.raisedHands = [
  [0.065, 0.29],
  [-0.02, 0.28],
];
CHOREOGRAPHIES.capriles.raisedHands = [
  [-0.04, 0.29],
  [0.13, 0.29],
];
CHOREOGRAPHIES.ali.raisedHands = [
  [0.05, 0.41],
  [0.27, 0.28],
];
CHOREOGRAPHIES.gualberto.raisedHands = [
  [-0.03, 0.36],
  [0.18, 0.29],
];
CHOREOGRAPHIES.maite.raisedHands = [
  [-0.025, 0.28],
  [0.125, 0.26],
];
CHOREOGRAPHIES.llorona.raisedHands = [
  [-0.06, 0.27],
  [0.15, 0.25],
];
CHOREOGRAPHIES.momoy.raisedHands = [
  [-0.16, 0.41],
  [0.15, 0.38],
];
CHOREOGRAPHIES.tioconejo.raisedHands = [
  [-0.08, 0.39],
  [0.08, 0.36],
];
const zone = (from: Hand, to: Hand, radius: number) => ({ from, to, radius });
CHOREOGRAPHIES.ali.rigidParts = [
  {
    bind: "body",
    rock: 0.33,
    pivot: [0, 0.43],
    zones: [
      zone([-0.09, 0.43], [0.065, 0.43], 0.115),
      zone([0.07, 0.4], [0.34, 0.29], 0.065),
    ],
  },
];
CHOREOGRAPHIES.gualberto.rigidParts = [
  {
    bind: "body",
    rock: 0.38,
    pivot: [0.01, 0.4],
    zones: [
      zone([-0.045, 0.42], [0.065, 0.42], 0.105),
      zone([0.05, 0.4], [0.25, 0.32], 0.065),
    ],
  },
];
CHOREOGRAPHIES.dudamel.rigidParts = [
  {
    bind: "head",
    pivot: [0.04, 0.35],
    zones: [zone([0.015, 0.35], [0.23, 0.17], 0.09)],
  },
];
CHOREOGRAPHIES.momoy.rigidParts = [
  {
    bind: "head",
    pivot: [-0.16, 0.41],
    zones: [zone([-0.19, 0.29], [-0.17, 0.96], 0.065)],
  },
];
CHOREOGRAPHIES.florentino.rigidParts = [
  {
    bind: "head",
    pivot: [-0.14, 0.47],
    zones: [
      zone([-0.17, 0.5], [-0.14, 0.47], 0.095),
      zone([-0.14, 0.46], [0.075, 0.22], 0.06),
    ],
  },
];
CHOREOGRAPHIES.knoche.rigidParts = [
  {
    bind: "body",
    pivot: [-0.17, 0.56],
    zones: [zone([-0.17, 0.54], [-0.17, 0.61], 0.055)],
  },
];
CHOREOGRAPHIES.silbon.rigidParts = [
  {
    bind: "body",
    pivot: [-0.19, 0.38],
    zones: [zone([-0.2, 0.31], [-0.23, 0.48], 0.095)],
  },
];
CHOREOGRAPHIES.lele.rigidParts = [
  {
    bind: "head",
    pivot: [0.1, 0.28],
    zones: [zone([0.1, 0.22], [0.1, 0.3], 0.05)],
  },
];
CHOREOGRAPHIES.maite.rigidParts = [
  {
    bind: "head",
    pivot: [0.08, 0.28],
    frames: [0],
    zones: [zone([0.08, 0.22], [0.08, 0.3], 0.045)],
  },
];
for (const [id, pivot] of [
  ["chataing", [-0.05, 0.35]],
  ["george", [-0.04, 0.29]],
  ["reynaldo", [-0.04, 0.31]],
  ["sarcos", [-0.025, 0.32]],
] as const)
  CHOREOGRAPHIES[id].rigidParts = [
    {
      bind: "head",
      pivot,
      zones: [
        zone([pivot[0], pivot[1] - 0.055], [pivot[0], pivot[1] + 0.03], 0.05),
      ],
    },
  ];
for (const [id, width] of [
  ["capriles", 0.16],
  ["gomez", 0.15],
  ["simon", 0.26],
  ["conde", 0.3],
  ["gualberto", 0.2],
  ["rummy", 0.2],
  ["silbon", 0.28],
  ["lionza", 0.14],
  ["florentino", 0.27],
  ["momoy", 0.23],
  ["tioconejo", 0.15],
] as const)
  CHOREOGRAPHIES[id].headWidth = width;
// Wide welcoming palms need extra room beside the diagonal division.
for (const [id, height, shift] of [
  ["sarcos", 700, -90],
  ["renny", 740, -60],
  ["reynaldo", 740, -70],
  ["emilio", 740, -60],
  ["puma", 740, -45],
  ["oscar", 720, -60],
  ["ali", 720, -40],
  ["gualberto", 720, -35],
] as const)
  CHOREOGRAPHIES[id].camera = { height, shift };

for (const [id, choreography] of Object.entries(CHOREOGRAPHIES))
  choreography.name = PRESENTATIONS[id as FighterId].introName;
CHOREOGRAPHIES.oscar.camera = { height: 470, shift: -10 };
CHOREOGRAPHIES.dudamel.camera = { height: 470, shift: -10 };
// Leave room for the tall ears throughout Conejo's one-shot hop.
CHOREOGRAPHIES.tioconejo.camera = { height: 620, shift: 0 };

export function sampleGesture(
  id: FighterId,
  progress: number,
  selection = false,
): Gesture {
  const t = Math.max(0, Math.min(1, progress));
  const beats = CHOREOGRAPHIES[id].beats;
  const next = beats.findIndex((b) => b.at > t);
  const a = beats[next < 0 ? beats.length - 1 : Math.max(0, next - 1)];
  const b = next < 0 ? a : beats[next];
  const fraction = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
  const ease = fraction * fraction * (3 - 2 * fraction);
  const strength = selection ? 0.45 : 1;
  const value = { at: t } as Gesture;
  for (const key of Object.keys(REST) as (keyof typeof REST)[])
    value[key] = (a[key] + (b[key] - a[key]) * ease) * strength;
  return value;
}
