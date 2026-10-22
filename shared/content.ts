import fighterData from "./fighters.json";
import stageData from "./stages.json";

export const SUPER_ENERGY_COST = 90;
export const SUPER_CHARGE_SECONDS = 0.8;
export const SUPER_CHARGE_TICKS = Math.round(SUPER_CHARGE_SECONDS * 60);
export const SUPER_CHARGE_SECONDS_LABEL = String(SUPER_CHARGE_SECONDS).replace(
  ".",
  ",",
);
export const SUPER_INTERRUPT_ENERGY_COST = 15;

export type FounderFighterId =
  "enrique" | "jesus" | "carlos" | "victor" | "juan" | "kevin";
export type IconFighterId =
  "lorenzo" | "carolina" | "dayana" | "deyna" | "bolivar" | "edgar" | "melanio";

export type BuiltInFighterId =
  | FounderFighterId
  | IconFighterId
  | "zavarce"
  | "vallenilla"
  | "javier"
  | "capriles"
  | "renny"
  | "gomez"
  | "simon"
  | "conde"
  | "emilio"
  | "maite"
  | "oscar"
  | "puma"
  | "chataing"
  | "george"
  | "mcm"
  | "silbon"
  | "llorona"
  | "sayona"
  | "lionza"
  | "florentino"
  | "diablo"
  | "knoche"
  | "momoy"
  | "tiotigre"
  | "tioconejo"
  | "ali"
  | "gualberto"
  | "reynaldo"
  | "dudamel"
  | "danny"
  | "nacho"
  | "sarcos"
  | "yordano"
  | "lila"
  | "rummy"
  | "chiqui"
  | "norkys"
  | "gabriela"
  | "amanda"
  | "lele"
  | "dorangel"
  | "giuseppe";
export type FighterId = BuiltInFighterId | `custom_${string}`;

export type StageId =
  | "caracas"
  | "guaira"
  | "valencia"
  | "canaima"
  | "maracaibo"
  | "merida"
  | "coro"
  | "roques"
  | "poliedro";
export type Ability =
  | "courier"
  | "installments"
  | "spin"
  | "sprint"
  | "broadcast"
  | "command"
  | "cuatro"
  | "whirl"
  | "echo"
  | "spotlight"
  | "salsa"
  | "roar"
  | "static"
  | "punchline"
  | "rally"
  | "whistle"
  | "undertow"
  | "haunt"
  | "wildspirit"
  | "verse"
  | "hellfire"
  | "elixir"
  | "roots"
  | "pounce"
  | "trickster"
  | "strum"
  | "tremolo"
  | "lasso"
  | "cadenza"
  | "crescendo"
  | "syncopate"
  | "jackpot"
  | "fountain"
  | "cocotero"
  | "zapateo"
  | "runway"
  | "pivot"
  | "mirror"
  | "curtain"
  | "prank"
  | "audit"
  | "ledger"
  | "settlement"
  | "ignition"
  | "slash"
  | "grid"
  | "remittance"
  | "polar"
  | "couture"
  | "corona"
  | "football"
  | "liberator"
  | "retake"
  | "bite"
  | "signal";

export type FighterCategory = "culture" | "folklore" | "founders" | "community";

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

export const BUILT_IN_FIGHTERS = fighterData as FighterDefinition[];
export const FIGHTERS = [...BUILT_IN_FIGHTERS];
const builtInDefinitions = new Map(
  BUILT_IN_FIGHTERS.map((fighter) => [fighter.id, fighter]),
);
export const COMMUNITY_DEFINITIONS = new Map<FighterId, FighterDefinition>();

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
  theme: "plaza" | "pier" | "jungle" | "bridge" | "snow" | "sand" | "concert";
  ambience: "city" | "coast" | "forest" | "wind" | "crowd";
  description: string;
  platforms: Platform[];
}
export const STAGES = stageData as StageDefinition[];
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
export const fighterById = (id: FighterId) =>
  (builtInDefinitions.get(id) ?? COMMUNITY_DEFINITIONS.get(id))!;
export const stageById = (id: StageId) => stageDefinitions.get(id)!;
export const isFighter = (id: unknown): id is FighterId =>
  FIGHTERS.some((f) => f.id === id);
export const isStage = (id: unknown): id is StageId =>
  STAGES.some((s) => s.id === id);
