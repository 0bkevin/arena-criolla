/** `value` limited to [min, max], the unit range by default. */
export const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

/** Smoothstep easing of `value`, clamped to [0, 1] first. */
export const smoothstep = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export const TAU = Math.PI * 2;
