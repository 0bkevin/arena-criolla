import type { FighterId } from "../../../shared/roster/roster";
import type { Choreography } from "./choreography";
import { routine } from "./routine";

/** Culture fighters. */
export const CULTURE_CHOREOGRAPHIES = {
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
} satisfies Partial<Record<FighterId, Choreography>>;
