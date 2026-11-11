// Public API of the combat simulation that the browser and both servers run.
export { WORLD } from "./arena";
export {
  ACTIONS,
  emptyInput,
  type Action,
  type Attack,
  type Effect,
  type Input,
  type MatchState,
  type PlayerConfig,
  type PlayerState,
  type Projectile,
} from "./types";
export { createMatch } from "./match";
export { outgoingDamageMultiplier } from "./combat";
export { stepMatch } from "./step";
export { cpuInput } from "./cpu";
