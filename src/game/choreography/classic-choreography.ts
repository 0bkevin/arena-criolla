import type { FighterId } from "../../../shared/roster/roster";
import type { Choreography } from "./choreography";
import { routine } from "./routine";

/** The original cast of public figures. */
export const CLASSIC_CHOREOGRAPHIES = {
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
} satisfies Partial<Record<FighterId, Choreography>>;
