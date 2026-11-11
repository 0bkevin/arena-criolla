// Shared base damage and combo bonuses.
/** Base light attack damage. */
export const LIGHT_DAMAGE = 6;
/** Base heavy attack damage. */
export const HEAVY_DAMAGE = 10.4;
/** Base definitive damage. */
export const SUPER_DAMAGE = 22;
/** Bonus for a light-heavy combo. */
export const LIGHT_HEAVY_BONUS = 2;
/** Bonus for a light-light-heavy combo. */
export const LIGHT_LIGHT_HEAVY_BONUS = 4;
/** Bonus for a combo into a definitive. */
export const SUPER_BONUS = 7;
/** Fraction of current HP lost for a surviving fall. */
export const RING_OUT_DAMAGE_FRACTION = 0.4;
/** A fighter loses the stock when pre-fall HP is strictly below this threshold. */
export const RING_OUT_STOCK_LOSS_THRESHOLD = 10;

/** HP removed by a fall; below the strict threshold the fall removes all remaining HP. */
export function ringOutDamage(hp: number): number {
  return hp < RING_OUT_STOCK_LOSS_THRESHOLD
    ? hp
    : hp * RING_OUT_DAMAGE_FRACTION;
}
