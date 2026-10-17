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
    | "release";
}
export interface EntranceAction {
  name: string;
  turns: number;
  frames: ActionFrame[];
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
