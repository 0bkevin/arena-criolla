// Raw v2 crown-to-sole is 425px. The scroll is taller than the man.
// Use one source-pixel scale through all four poses, undoing atlas packing;
// the accent's bent knees therefore lower his head without enlarging his face.
export const OSCAR_HEIGHTS: Record<string, number> = {
  ready: (469 * 305) / 425,
  pull: (470 * 305) / 425,
  release: (470 * 305) / 425,
  accent: (447 * 305) / 425,
};
