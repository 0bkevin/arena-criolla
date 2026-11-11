export const clamp = (n: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, n));
export const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;
