// The data a match is made of. Shared by the simulation, the renderers and the
// network protocol.
import type { FighterId, StageId } from "../roster/roster";
import type { FieldFinaleState } from "./finales/field-finales";
import type { FinaleState } from "./finales/finales";

export const ACTIONS = [
  "jump",
  "light",
  "heavy",
  "special",
  "dash",
  "super",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Attack = "light" | "heavy" | "special" | "super" | null;
export interface Input {
  left: boolean;
  right: boolean;
  block: boolean;
  down: boolean;
  superHeld: boolean;
  actions: Record<Action, number>;
}
export const emptyInput = (): Input => ({
  left: false,
  right: false,
  block: false,
  down: false,
  superHeld: false,
  actions: { jump: 0, light: 0, heavy: 0, special: 0, dash: 0, super: 0 },
});
export interface PlayerConfig {
  name: string;
  fighter: FighterId;
  wins: number;
}
export interface PlayerState {
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  // The part of vx caused by contact, preserved by the voluntary retreat limit.
  recoilVx?: number;
  vy: number;
  facing: number;
  hp: number;
  /** Lets a finishing throw reach the blast zone before a lethal HP loss resolves. */
  knockoutDelay?: number;
  stocks: number;
  energy: number;
  /** Consumed on activation and retained across lost stocks for this match. */
  superUsed: boolean;
  superChargeTicks: number;
  superChargeInterruptedTick?: number;
  grounded: boolean;
  supportPlatform: number | null;
  dropThrough: number;
  jumps: number;
  blocking: boolean;
  attack: Attack;
  attackTick: number;
  attackHit: boolean;
  countered: boolean;
  cooldown: number;
  stun: number;
  slowTicks: number;
  rootTicks: number;
  rootKind?: "chain" | "screen" | "spectral" | "flash" | "bite" | "pot";
  invincible: number;
  dash: number;
  lastActions: Record<Action, number>;
  bufferedAttack?: { attack: Exclude<Attack, "super" | null>; ticks: number };
  history: { action: string; tick: number }[];
  combo: string;
  comboTick: number;
  comboBonus: number;
  hits: number;
  peakCombo: number;
  streak: number;
  lastHitTick: number;
  /** Active gameplay ticks; paused with hitstop and capture finales. */
  transformation?: { id: string; ticks: number; damageMultiplier: number };
}
export interface Projectile {
  id: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  life: number;
  vy?: number;
  age?: number;
  formationIndex?: number;
  /** Preserve the original painted projectile when ownership changes on a parry. */
  finaleArt?: { fighter: FighterId; pose: string; height: number };
  hitInvincibility?: number;
  returnAfter?: number;
  tether?: { catchX: number; catchY: number; returnSpeed: number };
  returning?: boolean;
  connected?: boolean;
  kind: string;
  damage: number;
  force?: number;
  originY?: number;
  wave?: { amplitude: number; period: number };
  acceleration?: number;
  maxSpeed?: number;
  gravity?: number;
  homing?: number;
  pulls?: boolean;
  groundOnly?: boolean;
  slowTicks?: number;
  blastRadius?: number;
  bounces?: number;
  radius?: number;
  growth?: number;
  maxRadius?: number;
  plantAfter?: number;
  armAfter?: number;
  direction?: number;
  /** Defaults to special for existing projectiles; retained on reflection. */
  impact?: "special" | "super";
}
export interface Effect {
  id: number;
  x: number;
  y: number;
  life: number;
  kind: "hit" | "block" | "special" | "ringout";
  color: string;
  duration: number;
  owner?: number;
  impact?: NonNullable<Attack>;
  strength?: number;
  direction?: number;
  visual?: "heat";
}
export interface MatchState {
  id: string;
  stage: StageId;
  tick: number;
  remaining: number;
  phase: "intro" | "playing" | "finished";
  winner: number | "draw" | null;
  players: [PlayerState, PlayerState];
  projectiles: Projectile[];
  effects: Effect[];
  nextId: number;
  shake: number;
  hitstop: number;
  finale?: FinaleState;
  fieldFinales?: FieldFinaleState[];
}
