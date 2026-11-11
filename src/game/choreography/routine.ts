import type { Choreography, Gesture, Hand } from "./choreography";

export type Key = Partial<Omit<Gesture, "at">> & { at: number };
export const REST: Omit<Gesture, "at"> = {
  head: 0,
  lean: 0,
  back: 0,
  front: 0,
  backX: 0,
  backY: 0,
  frontX: 0,
  frontY: 0,
  cloth: 0,
};
export const beat = (key: Key): Gesture => ({ ...REST, ...key });
export function routine(
  name: string,
  hands: readonly [Hand, Hand],
  keys: Key[],
  neck = 0.21,
  shoulders = 0.28,
): Choreography {
  // One preparation, one characteristic accent, then a single release.
  // Earlier routines alternated the limbs several times and read as a loop.
  const energy = (key: Key) =>
    Object.keys(REST).reduce(
      (total, field) =>
        total +
        (key[field as keyof typeof REST] ?? 0) ** 2 *
          (field === "cloth" ? 0.001 : 1),
      0,
    );
  const accent = keys.reduce(
    (best, key) => (energy(key) > energy(best) ? key : best),
    keys[0],
  );
  const scaled = (at: number, strength: number) =>
    beat(
      Object.fromEntries([
        ["at", at],
        ...Object.keys(REST).map((field) => [
          field,
          (accent[field as keyof typeof REST] ?? 0) * strength,
        ]),
      ]) as Key,
    );
  return {
    name,
    hands,
    neck,
    shoulders,
    beats: [
      beat({ at: 0 }),
      scaled(0.22, 0.25),
      scaled(0.5, 1),
      scaled(0.76, 0.35),
      beat({ at: 0.9 }),
      beat({ at: 1 }),
    ],
  };
}
