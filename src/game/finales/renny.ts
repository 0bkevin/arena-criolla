import { ATTACK_ART, hasAttackArt } from "../attack-art";
import type { FinaleView } from "./types";
import { clampFinaleArtX, finaleArtXRange } from "../finale-viewport";

const requiredPoses = ["ladder", "present", "kick", "push"];

/** Fictional commercial choreography inspired by Renny's variety-show dancers. */
export function drawRennyFinale(view: FinaleView): boolean {
  const sheet = ATTACK_ART.renny;
  if (!hasAttackArt(view.images, "renny", requiredPoses)) return false;

  const { tick, profile, pulse, motion } = view;
  const arrival = Math.min(1, Math.max(0, tick / 18));
  const departure = Math.min(1, Math.max(0, (tick - 158) / 22));
  // The bodies keep their painted scale even when capture distance changes.
  // Convert a local physical offset back to authored coordinates for view.art.
  const span = view.point(785, 516).x - view.point(273, 516).x;
  const toAuthored = 512 / Math.max(1, Math.abs(span));
  const targetX = view.point(785, 516).x;
  const inward = targetX + 235 > finaleArtXRange(view.viewport, sheet.frames.present, 388, -1).maxX;
  if (!inward) view.art("ladder", 273, 516, 318);
  const dancer = (side: 0 | 1) => {
    const facing = inward || side === 0 ? 1 : -1;
    let pose = "present";
    let contact = 0;
    for (const [index, beat] of profile.damageBeats.entries()) {
      const delta = tick - beat;
      if ((index === side || index === 2) && delta >= -8 && delta <= 12) {
        pose = index === 2 ? "push" : "kick";
        contact = Math.max(0, 1 - Math.abs(delta) / 13);
      }
    }
    // Feather tips are included in these heights; actual adult bodies remain
    // comparable to the rival, and crouching does not enlarge the head.
    const height = pose === "push" ? 370 : pose === "kick" ? 392 : 388;
    const offset =
      165 + (1 - arrival + departure) * 70 * motion - contact * 16 * motion;
    let desiredX = targetX - facing * offset;
    if (inward) {
      // At a ledge both helpers approach from the arena interior, trading the
      // front position on their hit beats. The final push becomes a short chain.
      const otherIsKicking = side === 0 && Math.abs(tick - profile.damageBeats[1]) <= 12;
      const front = contact > 0 || (side === 0 && !otherIsKicking);
      const distance = pose === "push" ? (side === 0 ? 110 : 420) : front ? 120 : 310;
      desiredX = targetX - distance;
    }
    const boundedX = clampFinaleArtX(view.viewport, sheet.frames[pose], height, facing, desiredX);
    const x = 785 + (boundedX - targetX) * toAuthored;
    // Helpers perform at the rival's surface, including unequal-height captures.
    const feet = 516 + view.point(785, 516).y - view.point(x, 516).y;
    view.art(pose, x, feet, height, facing, arrival * (1 - departure));
  };
  dancer(0);
  view.body(view.rival, 785, 516, 288, -1, pulse ? "hurt" : "stand");
  dancer(1);
  if (inward) view.art("ladder", 273, 516, 318);
  if (tick < 154) view.bubble("¡Y ahora, el comercial!", 450, 65, 345);
  view.damage(115);
  return true;
}
