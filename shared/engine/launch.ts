/** HP-dependent multiplier used for horizontal launch speed. */
export function launchScale(hp: number) {
  return 1 + (100 - hp) / 90;
}

export function launchStun(force: number) {
  return Math.round(force * 2.6 + 5);
}
