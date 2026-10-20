import courier from "../../../shared/courier-assets.json";
import type { FinaleView } from "./types";

/** Seven painted couriers, each meeting the target on its own damage beat. */
export function drawZavarceFinale(view: FinaleView) {
  const { ctx, tick, motion, pulse, images, profile } = view;
  const image = images[courier.file];
  if (!image?.width) return false;
  const target = view.point(756, 508);
  const depths = [-6, -4, -2, 0, 2, 4, 6];
  const scale = 240 / courier.bodyHeight;
  const drawRider = (index: number) => {
    const at = profile.damageBeats[index];
    const frame =
      courier.frames[
        motion ? (Math.floor(tick / 5) + index) % courier.frameCount : 0
      ];
    // Local canvas already inherits the finale's arena orientation. Constant
    // speed keeps every front wheel aligned with its corresponding hit beat.
    const x = target.x - 100 + (motion ? (tick - at) * 8 : (3 - index) * 96);
    const feet = target.y + depths[index];
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      x - (frame.width * scale) / 2,
      feet - courier.baseline * scale,
      frame.width * scale,
      frame.height * scale,
    );
  };
  view.body(view.actor, 252, 508, 292, 1, tick < 28 ? "perform" : "stand");
  // Depth layering leaves the defender readable amid the rolling formation.
  for (let i = 0; i < 4; i++) drawRider(i);
  view.body(view.rival, 756, 508, 282, -1, pulse ? "recoil" : "stand");
  for (let i = 4; i < 7; i++) drawRider(i);
  view.damage(195);
  return true;
}
