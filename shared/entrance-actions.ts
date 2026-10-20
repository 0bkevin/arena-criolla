import type { BuiltInFighterId, FighterId } from "./content";

export interface ActionFrame {
  at: number;
  frame: number;
  mirror?: boolean;
  phase?:
    | "draw"
    | "sing"
    | "turn"
    | "settle"
    | "straighten"
    | "fold"
    | "hold"
    | "release"
    | "juggle"
    | "pose";
}
export interface EntranceAction {
  name: string;
  turns: number;
  frames: ActionFrame[];
  ball?: { at: number; x: number; y: number; lift: number }[];
}

// Use this entrance for the generic human greetings and prop overlays. Keep
// the instrument, folklore, and dedicated musical performances individual.
export const DEFAULT_ENTRANCE_FIGHTERS = [
  "zavarce",
  "vallenilla",
  "javier",
  "capriles",
  "renny",
  "gomez",
  "emilio",
  "maite",
  "puma",
  "chataing",
  "george",
  "mcm",
  "reynaldo",
  "danny",
  "nacho",
  "sarcos",
  "yordano",
  "lila",
  "rummy",
  "chiqui",
  "norkys",
  "gabriela",
  "amanda",
  "giuseppe",
  "enrique",
  "jesus",
  "carlos",
  "victor",
  "juan",
  "lorenzo",
  "carolina",
  "bolivar",
  "edgar",
  "melanio",
] as const satisfies readonly BuiltInFighterId[];

export const DEFAULT_ENTRANCE_ACTION: EntranceAction = {
  name: "Se yergue y cruza los brazos",
  turns: 0,
  frames: [
    { at: 0, frame: 0, phase: "straighten" },
    { at: 0.09, frame: 1, phase: "straighten" },
    { at: 0.23, frame: 2, phase: "fold" },
    { at: 0.32, frame: 3, phase: "fold" },
    { at: 0.4, frame: 4, phase: "fold" },
    { at: 0.48, frame: 5, phase: "hold" },
    { at: 0.76, frame: 4, phase: "release" },
    { at: 0.8, frame: 3, phase: "release" },
    { at: 0.84, frame: 2, phase: "release" },
    { at: 0.87, frame: 0, phase: "release" },
  ],
};

// Authored chronology, deliberately without modulo, ping-pong, or replay.
// Oscar's painted views keep the microphone in the same hand through the turn.
export const ENTRANCE_ACTIONS: Partial<Record<FighterId, EntranceAction>> = {
  ...Object.fromEntries(
    DEFAULT_ENTRANCE_FIGHTERS.map((id) => [id, DEFAULT_ENTRANCE_ACTION]),
  ),
  kevin: {
    name: "Se acomoda la manga, cruza los brazos y entra en guardia",
    turns: 0,
    frames: [
      { at: 0, frame: 0, phase: "settle" },
      { at: 0.08, frame: 1, phase: "straighten" },
      { at: 0.2, frame: 2, phase: "fold" },
      { at: 0.31, frame: 3, phase: "fold" },
      { at: 0.4, frame: 4, phase: "hold" },
      { at: 0.56, frame: 5, phase: "hold" },
      { at: 0.76, frame: 6, phase: "release" },
      { at: 0.86, frame: 7, phase: "settle" },
    ],
  },
  dayana: {
    name: "Da una vuelta y posa en la pasarela",
    turns: 1,
    frames: [
      { at: 0, frame: 0, phase: "settle" },
      { at: 0.08, frame: 1, phase: "turn" },
      { at: 0.2, frame: 2, phase: "turn" },
      { at: 0.29, frame: 3, phase: "turn" },
      { at: 0.39, frame: 4, phase: "turn" },
      { at: 0.47, frame: 5, phase: "pose" },
      { at: 0.6, frame: 6, phase: "pose" },
      { at: 0.72, frame: 7, phase: "pose" },
      { at: 0.85, frame: 0, phase: "settle" },
    ],
  },
  deyna: {
    name: "Hace toques de freestyle y controla el balón",
    turns: 0,
    frames: [
      { at: 0, frame: 0, phase: "settle" },
      { at: 0.13, frame: 1, phase: "juggle" },
      { at: 0.31, frame: 2, phase: "juggle" },
      { at: 0.49, frame: 3, phase: "juggle" },
      { at: 0.67, frame: 4, phase: "juggle" },
      { at: 0.83, frame: 5, phase: "settle" },
    ],
    ball: [
      { at: 0.03, x: 0.2, y: -0.055, lift: 0.04 },
      { at: 0.18, x: 0.35, y: -0.31, lift: 0.2 },
      { at: 0.36, x: 0.35, y: -0.32, lift: 0.18 },
      { at: 0.54, x: 0.35, y: -0.46, lift: 0.16 },
      { at: 0.72, x: 0.37, y: -0.31, lift: 0.12 },
      { at: 0.86, x: 0.2, y: -0.055, lift: 0 },
    ],
  },
  ...Object.fromEntries(
    Object.entries({
      simon: "Levanta el sombrero y saluda al rival",
      conde: "Se acomoda el sombrero y saluda al público",
      ali: "Invita al coro con su cuatro",
      gualberto: "Rasguea el cuatro y ofrece un saludo",
      lele: "Saluda a la cámara y guarda el teléfono",
      silbon: "Se acomoda el saco y encara al rival",
      llorona: "Abre los brazos y descubre su rostro",
      sayona: "Aparta el mantón y revela su mirada",
      lionza: "Abre las palmas y llama a Sorte",
      florentino: "Se quita el sombrero e invita al contrapunteo",
      diablo: "Abre las manos y reta con una sonrisa",
      knoche: "Examina el frasco y desafía al rival",
      momoy: "Se toca el sombrero y ofrece la palma",
      tiotigre: "Se estira y cruza las garras",
      tioconejo: "Se yergue, saluda y se prepara",
    }).map(([id, name]) => [
      id,
      {
        name,
        turns: 0,
        frames: [
          { at: 0, frame: 0, phase: "draw" },
          { at: 0.12, frame: 1, phase: "draw" },
          { at: 0.27, frame: 2, phase: "pose" },
          { at: 0.44, frame: 3, phase: "pose" },
          { at: 0.62, frame: 4, phase: "hold" },
          { at: 0.81, frame: 5, phase: "settle" },
        ],
      } as EntranceAction,
    ]),
  ),
  oscar: {
    name: "Saca el micrófono, canta y da una vuelta de salsa",
    turns: 1,
    frames: [
      { at: 0, frame: 0, phase: "draw" },
      { at: 0.035, frame: 1, phase: "draw" },
      { at: 0.11, frame: 2, phase: "draw" },
      { at: 0.18, frame: 3, phase: "sing" },
      { at: 0.26, frame: 4, phase: "sing" },
      { at: 0.36, frame: 5, phase: "sing" },
      { at: 0.43, frame: 6, phase: "turn" },
      { at: 0.475, frame: 7, phase: "turn" },
      { at: 0.52, frame: 8, phase: "turn" },
      { at: 0.565, frame: 9, phase: "turn" },
      { at: 0.61, frame: 10, phase: "turn" },
      { at: 0.655, frame: 11, phase: "turn" },
      { at: 0.7, frame: 12, phase: "turn" },
      { at: 0.745, frame: 13, phase: "turn" },
      { at: 0.805, frame: 14, phase: "settle" },
      { at: 0.86, frame: 15, phase: "settle" },
    ],
  },
  dudamel: {
    name: "Abre los brazos y dirige la orquesta",
    turns: 0,
    frames: [
      { at: 0, frame: 0 },
      { at: 0.08, frame: 1 },
      { at: 0.16, frame: 2 },
      { at: 0.24, frame: 3 },
      { at: 0.34, frame: 4 },
      { at: 0.42, frame: 5 },
      { at: 0.5, frame: 6 },
      { at: 0.59, frame: 7 },
      { at: 0.67, frame: 8 },
      { at: 0.74, frame: 9 },
      { at: 0.8, frame: 10 },
      { at: 0.85, frame: 11 },
    ],
  },
};
/** Keep the authored signature pose on the result screen, before its release. */
export function entrancePoseProgress(id: FighterId): number {
  return (
    ENTRANCE_ACTIONS[id]?.frames
      .filter((frame) => frame.phase === "hold" || frame.phase === "pose")
      .at(-1)?.at ?? 1
  );
}

export function sampleEntranceAction(id: FighterId, progress: number) {
  const action = ENTRANCE_ACTIONS[id],
    t = Math.max(0, Math.min(1, progress));
  if (!action || t <= 0 || t >= 0.9) return null;
  const next = action.frames.findIndex((f) => f.at > t);
  const a =
    action.frames[next < 0 ? action.frames.length - 1 : Math.max(0, next - 1)];
  const b = next < 0 ? a : action.frames[next];
  // Clean hand-drawn animation frames. Blending whole silhouettes creates
  // doubled faces and floating hands, so each moment displays one pose.
  return {
    current: a,
    next: b,
  };
}

/** One painted football follows a finite series of foot contacts, without looping. */
export function sampleEntranceBall(id: FighterId, progress: number) {
  const contacts = ENTRANCE_ACTIONS[id]?.ball;
  if (!contacts || progress < contacts[0].at || progress >= 0.9) return null;
  const next = contacts.findIndex((c) => c.at > progress);
  const a = contacts[next < 0 ? contacts.length - 1 : next - 1];
  const b = next < 0 ? a : contacts[next];
  const t = b.at > a.at ? (progress - a.at) / (b.at - a.at) : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - 4 * a.lift * t * (1 - t),
    alpha: Math.min(
      1,
      (progress - contacts[0].at) / 0.03,
      (0.9 - progress) / 0.04,
    ),
  };
}
