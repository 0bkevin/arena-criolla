// The data a match is made of. Shared by the simulation, the renderers and the
// network protocol.
import type { FighterId, StageId } from "../roster/roster";
import type { FieldFinaleState } from "./finales/field-finales";
import type { FinaleState } from "./finales/finales";

/** A seat in a match: 0 starts on the left (player 1), 1 on the right. */
export type PlayerIndex = 0 | 1;
export const PLAYERS = [0, 1] as const satisfies readonly PlayerIndex[];
export const opponentOf = (i: PlayerIndex): PlayerIndex => (i === 0 ? 1 : 0);
/** One value per seat, computed for player 1 and then player 2. */
export const perPlayer = <T>(value: (i: PlayerIndex) => T): [T, T] => [
  value(0),
  value(1),
];

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
  counterLanded: boolean;
  cooldown: number;
  stun: number;
  slowTicks: number;
  rootTicks: number;
  rootKind?: "chain" | "screen" | "spectral" | "flash" | "bite" | "pot";
  invincible: number;
  dashOnlyInvincible: number;
  /** Remaining safe-return immunity after a nonlethal fall. */
  fallProtectionTicks?: number;
  /** Other non-dash immunity that must survive cancellation of fall protection. */
  fallProtectionBase?: number;
  /** Other dash immunity that overlaps the fall layer and must survive it. */
  fallProtectionDashBase?: number;
  dash: number;
  lastActions: Record<Action, number>;
  bufferedAttack?: { attack: Exclude<Attack, "super" | null>; ticks: number };
  /** Ticks left on a held definitive press made while busy; charges once free. */
  bufferedSuperTicks?: number;
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
  owner: PlayerIndex;
  x: number;
  y: number;
  vx: number;
  life: number;
  vy?: number | undefined;
  age?: number | undefined;
  formationIndex?: number | undefined;
  /** Preserve the original painted projectile when ownership changes on a parry. */
  finaleArt?: { fighter: FighterId; pose: string; height: number } | undefined;
  hitInvincibility?: number | undefined;
  returnAfter?: number | undefined;
  tether?: { catchX: number; catchY: number; returnSpeed: number } | undefined;
  returning?: boolean | undefined;
  connected?: boolean | undefined;
  kind: string;
  damage: number;
  force?: number | undefined;
  originY?: number | undefined;
  wave?: { amplitude: number; period: number } | undefined;
  acceleration?: number | undefined;
  maxSpeed?: number | undefined;
  gravity?: number | undefined;
  homing?: number | undefined;
  pulls?: boolean | undefined;
  groundOnly?: boolean | undefined;
  slowTicks?: number | undefined;
  blastRadius?: number | undefined;
  bounces?: number | undefined;
  radius?: number | undefined;
  growth?: number | undefined;
  maxRadius?: number | undefined;
  plantAfter?: number | undefined;
  armAfter?: number | undefined;
  direction?: number | undefined;
  /** Defaults to special for existing projectiles; retained on reflection. */
  impact?: "special" | "super" | undefined;
}
export interface Effect {
  id: number;
  x: number;
  y: number;
  life: number;
  kind: "hit" | "block" | "special" | "ringout";
  color: string;
  duration: number;
  owner?: PlayerIndex | undefined;
  impact?: NonNullable<Attack> | undefined;
  strength?: number | undefined;
  direction?: number | undefined;
  visual?: "heat" | undefined;
}
export interface MatchState {
  id: string;
  stage: StageId;
  tick: number;
  remaining: number;
  phase: "intro" | "playing" | "finished";
  winner: PlayerIndex | "draw" | null;
  players: [PlayerState, PlayerState];
  projectiles: Projectile[];
  effects: Effect[];
  nextId: number;
  shake: number;
  hitstop: number;
  finale?: FinaleState | undefined;
  fieldFinales?: FieldFinaleState[] | undefined;
}
