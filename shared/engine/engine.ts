// Public API of the combat simulation that the browser and both servers run.
export { WORLD } from "./arena";
export {
  ACTIONS,
  PLAYERS,
  emptyInput,
  opponentOf,
  perPlayer,
  type Action,
  type Attack,
  type Effect,
  type Input,
  type MatchState,
  type PlayerConfig,
  type PlayerIndex,
  type PlayerState,
  type Projectile,
} from "./types";
export { createMatch } from "./match";
export { outgoingDamageMultiplier } from "./combat";
export { stepMatch } from "./step";
export { cpuInput } from "./cpu";
