import type { FighterId } from "../../../../shared/roster/roster";
import perroChoreography from "../../../../shared/engine/finales/perro-mujeriego-choreography.json";
import { smooth } from "./math";

const DANCE_BLEND_TICKS = 6;
export const CAPTURED_DANCE_FRAMES = [0, 0, 0, 1, 1, 4, 1, 0] as const;

/** The continuous 34–40 second reference phrase, with one clock for both roles. */
export function sampleFinaleDance(tick: number, reducedMotion = false) {
  if (reducedMotion)
    return {
      phase: 0,
      frame: 0,
      nextFrame: 0,
      blend: 0,
      dx: 0,
      dy: 0,
      rotate: 0,
    };
  const at = Number.isFinite(tick)
    ? Math.max(0, Math.min(perroChoreography.durationTicks - 1, tick))
    : 0;
  let frame = 0;
  for (let index = 1; index < perroChoreography.poses.length; index++) {
    if (at < perroChoreography.poses[index].tick) break;
    frame = index;
  }
  const next = perroChoreography.poses[frame + 1];
  const blend = next
    ? smooth((at - next.tick + DANCE_BLEND_TICKS) / DANCE_BLEND_TICKS)
    : 0;
  const phase = (at % 42) / 42;
  const angle = phase * Math.PI * 2;
  return {
    phase,
    frame,
    nextFrame: blend > 0 ? frame + 1 : frame,
    blend,
    dx: Math.sin(angle) * 3,
    dy: -(Math.sin(angle * 2) ** 2) * 4,
    rotate: 0,
  };
}
/** One authored dance phrase; keyboard taps repeat only inside the typing section. */
export function finalePerformerFrame(
  id: FighterId,
  tick: number,
  reducedMotion = false,
) {
  if (reducedMotion) return 0;
  if (id === "giuseppe") {
    if (tick < 18) return 0;
    if (tick >= 156) return 7;
    return 1 + (Math.floor((tick - 18) / 8) % 6);
  }
  if (tick < 18) return 0;
  if (tick < 42) return 1;
  if (tick < 55) return 2;
  if (tick < 85) return 3;
  if (tick < 105) return 4;
  if (tick < 136) return 5;
  if (tick < 160) return 6;
  return 7;
}
