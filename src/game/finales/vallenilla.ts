import { ATTACK_ART, hasAttackArt } from "../attack-art";
import type { FinaleView } from "./types";
import { clampFinaleArtX, finaleArtXRange } from "../finale-viewport";

const requiredPoses = ["summon", "guard", "jab", "hook", "uppercut"];

/** Two Cashea helpers trade three punches each, on the engine's six hit beats. */
export function drawVallenillaFinale(view: FinaleView): boolean {
  const sheet = ATTACK_ART.vallenilla;
  if (!hasAttackArt(view.images, "vallenilla", requiredPoses)) return false;

  const { tick, motion, profile, pulse } = view;
  view.art("summon", 296, 508, 292);
  const arrival = Math.min(1, Math.max(0, (tick - 10) / 24));
  const departure = Math.min(1, Math.max(0, (tick - 152) / 24));
  const alpha = arrival * (1 - departure);
  const targetX = view.point(724, 508).x;
  const span = view.point(724, 508).x - view.point(296, 508).x;
  const toAuthored = 428 / Math.max(1, Math.abs(span));
  const outside = finaleArtXRange(view.viewport, sheet.frames.guard, 260, -1);
  const inward = targetX + 165 > outside.maxX;
  const helper = (index: number) => {
    const facing = inward || index === 0 ? 1 : -1;
    let pose = "guard";
    let lunge = 0;
    for (let beat = index; beat < profile.damageBeats.length; beat += 2) {
      const delta = tick - profile.damageBeats[beat];
      if (delta >= -5 && delta <= 7) {
        pose = ["jab", "hook", "uppercut"][Math.floor(beat / 2)];
        lunge = Math.max(0, 1 - Math.abs(delta) / 8) * 14;
      }
    }
    let desiredX = targetX - facing * (165 - lunge * motion);
    if (inward) {
      // Alternate the leading helper at each strike. A brief crossing between
      // beats keeps both complete faces readable at contact, even at a ledge.
      let frontWeight = 1;
      for (let beat = 1; beat < profile.damageBeats.length; beat++) {
        const midpoint = (profile.damageBeats[beat - 1] + profile.damageBeats[beat]) / 2;
        const blend = Math.max(0, Math.min(1, (tick - midpoint + 4) / 8));
        frontWeight += ((beat % 2 === 0 ? 1 : 0) - frontWeight) * blend;
      }
      const weight = index === 0 ? frontWeight : 1 - frontWeight;
      desiredX = targetX - (310 - weight * 185);
    }
    desiredX -= facing * ((1 - arrival) * 100 + departure * 130) * motion;
    const bounded = clampFinaleArtX(view.viewport, sheet.frames[pose], index === 0 ? 236 : 260, facing, desiredX);
    const x = 724 + (bounded - targetX) * toAuthored;
    const feet = 508 + view.point(724, 508).y - view.point(x, 508).y;
    view.art(
      pose,
      x,
      feet,
      index === 0 ? 236 : 260,
      facing,
      alpha,
    );
  };
  helper(0);
  helper(1);
  // The struck fighter stays in front of both helpers, so close captures and
  // edge containment never hide the rival's face behind a mascot's head.
  view.body(view.rival, 724, 508, 288, -1, pulse ? "hurt" : "stand");
  view.damage(195);
  return true;
}
