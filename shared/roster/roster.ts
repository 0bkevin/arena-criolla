import fighterData from "./fighters.json";
import stageData from "./stages.json";
import type {
  Ability,
  FighterCategory,
  FighterId,
  STAGE_AMBIENCES,
  STAGE_THEMES,
  StageId,
} from "./ids";
import { readFighters, readStages } from "./roster-data";

export const SUPER_ENERGY_COST = 90;
export const SUPER_CHARGE_SECONDS = 0.3;
export const SUPER_CHARGE_TICKS = Math.round(SUPER_CHARGE_SECONDS * 60);
export const SUPER_CHARGE_SECONDS_LABEL = String(SUPER_CHARGE_SECONDS).replace(
  ".",
  ",",
);
export const SUPER_INTERRUPT_ENERGY_COST = 15;

export {
  FIGHTER_IDS,
  STAGE_IDS,
  type Ability,
  type FighterCategory,
  type FighterId,
  type FounderFighterId,
  type IconFighterId,
  type StageId,
} from "./ids";
export interface FighterDefinition {
  id: FighterId;
  sprite: string;
  category?: FighterCategory;
  displayHeight?: number;
  portraitScale?: number;
  portraitLift?: number;
  name: string;
  shortName: string;
  title: string;
  role: string;
  color: string;
  description: string;
  speed: number;
  damage: number;
  armor: number;
  stats: [number, number, number];
  ability: Ability;
  special: string;
  specialUnlockWins?: number;
  combos: [string, string, string];
}

export const FIGHTERS = readFighters(fighterData);
const fighterDefinitions = new Map(
  FIGHTERS.map((fighter) => [fighter.id, fighter]),
);

export interface Platform {
  x: number;
  y: number;
  width: number;
  motion?: { axis: "x" | "y"; range: number; period: number; phase?: number };
}
export interface StageDefinition {
  id: StageId;
  name: string;
  location: string;
  time: string;
  color: string;
  artStyle?: "pixel";
  theme: (typeof STAGE_THEMES)[number];
  ambience: (typeof STAGE_AMBIENCES)[number];
  description: string;
  platforms: Platform[];
}
export const STAGES = readStages(stageData);
const stageDefinitions = new Map(STAGES.map((stage) => [stage.id, stage]));
// Simulation and rendering share the same positions, including in online rooms.
// Motion is derived from the match tick rather than the browser's clock.
export function platformsAtTick(id: StageId, tick: number): Platform[] {
  return stageById(id).platforms.map((platform) => {
    if (!platform.motion) return platform;
    const { axis, range, period, phase = 0 } = platform.motion;
    const offset = Math.sin(((tick + phase) * Math.PI * 2) / period) * range;
    return {
      ...platform,
      [axis]: platform[axis] + Math.round(offset * 1000) / 1000,
    };
  });
}
export const fighterById = (id: FighterId) => fighterDefinitions.get(id)!;
export const stageById = (id: StageId) => stageDefinitions.get(id)!;
export const isFighter = (id: unknown): id is FighterId =>
  FIGHTERS.some((f) => f.id === id);
export const isStage = (id: unknown): id is StageId =>
  STAGES.some((s) => s.id === id);
