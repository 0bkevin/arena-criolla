import { hasAttackArt } from "../attack-art";
import type { FinaleView } from "./types";

const requiredPoses = ["headshirt", "fingerwag", "scold", "point"];

/** Javier's head-shirt comedy persona delivers three escalating reprimands. */
export function drawJavierFinale(view: FinaleView): boolean {
  if (!hasAttackArt(view.images, "javier", requiredPoses)) return false;

  const { tick, profile, pulse } = view;
  const [first, second, third] = profile.damageBeats;
  const pose =
    tick < first - 8
      ? "headshirt"
      : tick < second - 8
        ? "fingerwag"
        : tick < third - 8
          ? "scold"
          : "point";
  // Preserve the drawing's body scale when he bends forward; do not stretch
  // the shorter crouched silhouette up to the standing pose's height.
  const height = pose === "headshirt" ? 297 : pose === "fingerwag" ? 294 : 276;
  view.art(pose, 362, 515, height);
  view.body(view.rival, 789, 510, 288, -1, pulse ? "hurt" : "stand");
  // Original game dialogue, not a quotation attributed to the creator.
  if (tick >= first - 8 && tick < profile.duration - 12)
    view.bubble(
      pose === "fingerwag"
        ? "¡Un momentico!"
        : pose === "scold"
          ? "¡A mí me escuchas!"
          : "¡Y punto!",
      540,
      205,
      300,
    );
  view.damage(120);
  return true;
}
