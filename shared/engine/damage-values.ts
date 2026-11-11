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
/**
 * HP lost for falling out of the arena. It ignores armor and transformation,
 * so it is the same for every fighter. A fall that this amount would leave at
 * 0 HP or less costs the stock instead, never more than this much health.
 */
export const RING_OUT_DAMAGE = 10;
