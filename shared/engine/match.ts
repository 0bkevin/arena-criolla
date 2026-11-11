import { WORLD } from "./arena";
import type { StageId } from "../roster/roster";
import {
  emptyInput,
  type MatchState,
  type PlayerConfig,
  type PlayerState,
} from "./types";

function makePlayer(config: PlayerConfig, index: number): PlayerState {
  return {
    // Room progress can advance after a win; the match keeps its starting counts.
    config: { ...config },
    x: index === 0 ? 330 : 750,
    y: WORLD.floor,
    vx: 0,
    recoilVx: 0,
    vy: 0,
    facing: index === 0 ? 1 : -1,
    hp: 100,
    stocks: 2,
    energy: 35,
    superUsed: false,
    superChargeTicks: 0,
    grounded: true,
    supportPlatform: -1,
    dropThrough: 0,
    jumps: 0,
    blocking: false,
    attack: null,
    attackTick: 0,
    attackHit: false,
    countered: false,
    counterLanded: false,
    cooldown: 0,
    stun: 0,
    slowTicks: 0,
    rootTicks: 0,
    invincible: 90,
    dashOnlyInvincible: 0,
    dash: 0,
    lastActions: { ...emptyInput().actions },
    history: [],
    combo: "",
    comboTick: 0,
    comboBonus: 0,
    hits: 0,
    peakCombo: 0,
    streak: 0,
    lastHitTick: 0,
  };
}

export function createMatch(
  stage: StageId,
  configs: [PlayerConfig, PlayerConfig],
  id = "local",
): MatchState {
  return {
    id,
    stage,
    tick: 0,
    remaining: 120 * 60,
    phase: "intro",
    winner: null,
    players: [makePlayer(configs[0], 0), makePlayer(configs[1], 1)],
    projectiles: [],
    effects: [],
    nextId: 0,
    shake: 0,
    hitstop: 0,
  };
}
