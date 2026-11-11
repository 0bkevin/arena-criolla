import type { FighterId } from "../../../shared/roster/roster";
import { PRESENTATIONS } from "../../../shared/engine/presentation";
import { DEFAULT_ENTRANCE_FIGHTERS } from "./entrance-actions";
import { FOUNDER_CHOREOGRAPHIES } from "./founder-choreography";
import { ICON_CHOREOGRAPHIES } from "./icon-choreography";
import { CLASSIC_CHOREOGRAPHIES } from "./classic-choreography";
import { CULTURE_CHOREOGRAPHIES } from "./culture-choreography";
import { FOLKLORE_CHOREOGRAPHIES } from "./folklore-choreography";
import { REST, routine } from "./routine";

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

// Hands are audited separately on each presentation pose, in body-height units
// relative to the head centre, after normalizing the original atlas direction.
// These are theatrical adaptations of public personas, never claimed as real rituals.
export const CHOREOGRAPHIES: Record<FighterId, Choreography> = {
  dorangel: routine(
    "Se yergue y cruza los brazos",
    [
      [-0.1, 0.34],
      [0.12, 0.35],
    ],
    [{ at: 0.45, head: -0.03, front: -0.1 }],
  ),
  ...FOUNDER_CHOREOGRAPHIES,
  ...ICON_CHOREOGRAPHIES,
  ...CLASSIC_CHOREOGRAPHIES,
  ...CULTURE_CHOREOGRAPHIES,
  ...FOLKLORE_CHOREOGRAPHIES,
};

// Frame 1 is audited independently: crossed arms and props are not generic palms.
CHOREOGRAPHIES.javier.raisedHands = [
  [-0.08, 0.28],
  [0.12, 0.27],
];
CHOREOGRAPHIES.javier.headWidth = 0.16;
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
    pivot: [0.025, 0.43],
    zones: [zone([0.025, 0.41], [0.025, 0.45], 0.02)],
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
// The folded arms belong in the close-up, without the lateral room that the
// old outstretched greetings needed. Painted entrances own their body motion.
for (const id of DEFAULT_ENTRANCE_FIGHTERS)
  CHOREOGRAPHIES[id].camera = { height: 650, shift: 0 };

export function sampleGesture(
  id: FighterId,
  progress: number,
  selection = false,
): Gesture {
  const t = Math.max(0, Math.min(1, progress));
  if (PRESENTATIONS[id].introStyle === "defiant") return { at: t, ...REST };
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
