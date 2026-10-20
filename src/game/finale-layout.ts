import type { MatchState } from "../../shared/engine";
import { finaleById } from "../../shared/finales";

const SCALE = 177 / 300;
type Anchor = readonly [x: number, feet: number];

/** Coordinates used to paint each sequence, independent of camera or arena. */
function authoredAnchors(state: MatchState): readonly [Anchor, Anchor] {
  const id = state.finale!.fighter;
  const family = finaleById(id)!.family;
  switch (id) {
    case "bolivar":
      return [
        [306, 514],
        [782, 514],
      ];
    case "capriles":
      return [
        [344, 518],
        [729, 518],
      ];
    case "gomez":
      return [
        [334, 516],
        [776, 516],
      ];
    case "giuseppe":
      return [
        [315, 522],
        [785, 513],
      ];
    case "zavarce":
      return [
        [252, 508],
        [756, 508],
      ];
    case "vallenilla":
      return [
        [296, 508],
        [724, 508],
      ];
    case "reynaldo":
      return [
        [385, 503],
        [771, 500],
      ];
    case "mcm":
      return [
        [410, 516],
        [656, 516],
      ];
    case "juan":
      return [
        [230, 516],
        [398, 516],
      ];
    case "carlos":
      return [
        [295, 516],
        [460, 516],
      ];
    case "dudamel":
      return [
        [347, 510],
        [783, 510],
      ];
    case "chataing":
      return [
        [341, 516],
        [744, 516],
      ];
    case "renny":
      return [
        [273, 516],
        [785, 516],
      ];
    case "sarcos":
      return [
        [295, 515],
        [767, 515],
      ];
    case "maite":
      return [
        [338, 516],
        [737, 516],
      ];
    case "george":
      return [
        [333, 518],
        [766, 523],
      ];
    case "gabriela":
      return [
        [475, 524],
        [826, 523],
      ];
    case "chiqui":
      return [
        [393, 515],
        [684, 515],
      ];
    case "amanda":
      return [
        [422, 522],
        [790, 522],
      ];
    case "tiotigre":
      return [
        [344, 514],
        [782, 514],
      ];
    case "javier":
      return [
        [362, 515],
        [789, 510],
      ];
  }
  if (family === "dance")
    return [
      [382, 504],
      [699, 504],
    ];
  if (family === "music")
    return [
      [330, 510],
      [783, 510],
    ];
  if (family === "technology")
    return [
      [302, 515],
      [785, 515],
    ];
  if (family === "theater")
    return [
      [306, 522],
      [790, 522],
    ];
  return [
    [306, 514],
    [782, 514],
  ];
}

/** Place objects between the captured fighters without stretching their artwork. */
export function finaleArenaLayout(state: MatchState) {
  const finale = state.finale;
  if (!finale || finaleById(finale.fighter)?.mode !== "capture")
    return undefined;
  const actor = state.players[finale.owner],
    rival = state.players[finale.target];
  const direction = finale.direction < 0 ? -1 : 1;
  const originX = (actor.x + rival.x) / 2;
  const originY = Math.min(actor.y, rival.y);
  const [a, b] = authoredAnchors(state);
  const distance = Math.abs(rival.x - actor.x);
  // A close capture needs space for two chairs. They slide apart locally;
  // the camera, collision positions, arena and platforms never move for it.
  const enter = Math.min(1, Math.max(0, finale.tick / 12));
  const leave = Math.min(1, Math.max(0, (finale.duration - finale.tick) / 12));
  const separation =
    finale.fighter === "capriles"
      ? (Math.max(0, 200 - distance) * Math.min(enter, leave)) / 2
      : 0;
  const localA = 540 + ((actor.x - originX) * direction - separation) / SCALE;
  const localB = 540 + ((rival.x - originX) * direction + separation) / SCALE;
  return {
    scale: SCALE,
    direction,
    originX,
    originY,
    targetPoint(y: number) {
      return {
        x: localB,
        y: y + 516 + (rival.y - originY) / SCALE - b[1],
      };
    },
    point(x: number, y: number) {
      const weight = (x - a[0]) / (b[0] - a[0]);
      const bounded = Math.max(0, Math.min(1, weight));
      const actorOffsetY = 516 + (actor.y - originY) / SCALE - a[1];
      const rivalOffsetY = 516 + (rival.y - originY) / SCALE - b[1];
      return {
        x: localA + (localB - localA) * weight,
        y: y + actorOffsetY + (rivalOffsetY - actorOffsetY) * bounded,
      };
    },
  };
}

export type FinaleArenaLayout = NonNullable<
  ReturnType<typeof finaleArenaLayout>
>;
