import type { BuiltInFighterId, FighterId } from "../../shared/content";
import { REST, type Gesture } from "../../shared/choreography";
import { CLASSIC_VICTORIES } from "./victories-classic";
import { CULTURE_VICTORIES } from "./victories-culture";
import { FOLKLORE_VICTORIES } from "./victories-folklore";
import { FOUNDER_VICTORIES } from "./victories-founders";
import { ICON_VICTORIES } from "./victories-icons";
import { VICTORY_DURATION_MS, type VictoryProfile } from "./victory-types";

export { VICTORY_DURATION_MS } from "./victory-types";

export const VICTORIES = {
  ...CLASSIC_VICTORIES,
  ...CULTURE_VICTORIES,
  ...FOLKLORE_VICTORIES,
  ...FOUNDER_VICTORIES,
  ...ICON_VICTORIES,
} satisfies Record<BuiltInFighterId, VictoryProfile>;

const COMMUNITY_VICTORY: VictoryProfile = {
  name: "Un saludo a la arena",
  frame: 0,
  movement: "plant",
  gesture: { front: -0.28, frontY: -0.05, head: -0.06, lean: -0.03 },
  lift: 0.02,
  travel: 0,
  twist: 0.02,
  music: "brass",
};

export const victoryById = (id: FighterId): VictoryProfile =>
  id.startsWith("custom_")
    ? COMMUNITY_VICTORY
    : VICTORIES[id as BuiltInFighterId];

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

/** A single preparation, signature accent and held finish; never loops. */
export function sampleVictory(
  id: FighterId,
  elapsedMs: number,
  reducedMotion = false,
) {
  const profile = victoryById(id);
  const progress = clamp(elapsedMs / VICTORY_DURATION_MS);
  const rise = smooth((progress - 0.06) / 0.3);
  const release = smooth((progress - 0.65) / 0.25);
  const accent = rise * (1 - release * 0.65);
  const pulse = Math.sin(Math.PI * clamp((progress - 0.12) / 0.65));
  const jump = Math.sin(Math.PI * clamp((progress - 0.18) / 0.42));
  const gesture: Gesture = { at: progress, ...REST };
  if (!reducedMotion)
    for (const key of Object.keys(REST) as (keyof typeof REST)[])
      gesture[key] = (profile.gesture[key] ?? 0) * accent;
  const movement = reducedMotion
    ? 0
    : profile.movement === "sway"
      ? Math.sin(progress * Math.PI * 2) * pulse
      : pulse;
  const lift =
    profile.movement === "hop"
      ? jump
      : profile.movement === "plant"
        ? -pulse * 0.45
        : profile.movement === "rise"
          ? rise * (1 - release)
          : pulse;
  return {
    progress,
    frame:
      profile.frame === 4 && (progress < 0.18 || progress >= 0.64)
        ? 0
        : profile.frame,
    gesture,
    dx: reducedMotion ? 0 : profile.travel * movement,
    dy: reducedMotion ? 0 : -profile.lift * lift,
    rotate: reducedMotion ? 0 : profile.twist * movement,
  };
}

export function sampleDefeat(elapsedMs: number, reducedMotion = false) {
  const progress = clamp(elapsedMs / VICTORY_DURATION_MS);
  const settle = smooth(progress / 0.4);
  const recoil = Math.sin(clamp(progress / 0.27) * Math.PI);
  return {
    dx: reducedMotion ? 0 : -0.035 * settle - recoil * 0.025,
    dy: reducedMotion ? 0 : 0.045 * settle,
    rotate: reducedMotion ? 0 : -0.09 * settle - recoil * 0.035,
  };
}
