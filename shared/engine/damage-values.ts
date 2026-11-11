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
/** Fraction of current HP lost for a nonlethal fall, unless the minimum is higher. */
export const RING_OUT_DAMAGE_FRACTION = 0.4;
/** Minimum HP loss for a fall; a fighter at or below this HP loses the stock. */
export const MIN_RING_OUT_DAMAGE = 10;

/** HP removed by a fall, capped at the fighter's remaining HP. */
export function ringOutDamage(hp: number): number {
  return Math.min(
    hp,
    Math.max(hp * RING_OUT_DAMAGE_FRACTION, MIN_RING_OUT_DAMAGE),
  );
}
