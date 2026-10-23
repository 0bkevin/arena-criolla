import type { MatchState } from "./engine";
import type { FieldFinaleState } from "./field-finales";

export const INAKI_FINALE = {
  duration: 118,
  recovery: 70,
  riding: false,
  cues: [16, 22, 28, 34, 40],
} as const;

export const INAKI_CASH = {
  offsetX: 60,
  offsetY: 126,
  radius: 24,
  speed: 10,
  life: 70,
} as const;

/** Money is a traveling projectile; posing or charging never deals remote damage. */
export function advanceInakiFinale(state: MatchState, field: FieldFinaleState) {
  if (field.fighter !== "inaki" || field.cancelled) return;
  const index = INAKI_FINALE.cues.indexOf(
    field.tick as (typeof INAKI_FINALE.cues)[number],
  );
  if (index < 0) return;
  const player = state.players[field.owner];
  state.projectiles.push({
    id: state.nextId++,
    owner: field.owner,
    direction: field.direction,
    x: player.x + field.direction * INAKI_CASH.offsetX,
    y: player.y - INAKI_CASH.offsetY,
    vx: field.direction * INAKI_CASH.speed,
    vy: 0,
    age: 0,
    life: INAKI_CASH.life,
    kind: "banknotes",
    impact: "super",
    radius: INAKI_CASH.radius,
    damage: field.damage / INAKI_FINALE.cues.length,
    force: index === INAKI_FINALE.cues.length - 1 ? 4 : 1.4,
    hitInvincibility: 4,
    finaleArt: {
      fighter: "inaki",
      pose: "cash-orb-release",
      height: INAKI_CASH.radius * 2,
    },
  });
}
