import { ATTACK_ART, hasAttackArt } from "../attack-art";
import { finaleArtXRange } from "../finale-viewport";
import type { FinaleView } from "./types";

const requiredPoses = [
  "ready",
  "gallop-extended",
  "gallop-gathered",
  "brake",
  "trooper-extended",
  "trooper-gathered",
  "dismount",
  "horse-exit",
];
// One source-pixel scale for all eight v2 poses keeps horses from growing
// when they change from upright to a naturally shorter galloping silhouette.
const poseHeights: Record<string, number> = {
  ready: 338 * 1.1,
  "gallop-extended": 295 * 1.1,
  "gallop-gathered": 304 * 1.1,
  brake: 348 * 1.1,
  "trooper-extended": 307 * 1.1,
  "trooper-gathered": 325 * 1.1,
  dismount: 312 * 1.1,
  "horse-exit": 299 * 1.1,
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, p: number) => a + (b - a) * clamp(p);

/** Fictional cavalry charge, using period-inspired riders on the captured arena. */
export function drawGomezFinale(view: FinaleView): boolean {
  const sheet = ATTACK_ART.gomez;
  if (!hasAttackArt(view.images, "gomez", requiredPoses)) return false;

  const { tick, pulse, motion } = view;
  const source = view.point(334, 516),
    target = view.point(776, 516);
  const span = target.x - source.x;
  const authored = (x: number) =>
    334 + ((x - source.x) * 442) / Math.max(1, span);
  // Horizontal offsets use local painted pixels, independent of capture distance.
  // There is no decorative depth offset: hooves follow the captured surfaces.
  const mounted = (pose: string, x: number, facing = 1, alpha = 1) =>
    view.art(pose, authored(x), 516, poseHeights[pose], facing, clamp(alpha));
  const contactX = target.x - Math.min(128, span * 0.55);
  // The commander must finish braking and turn fully inside the existing
  // camera. Use one common stop across both gaits/facings to avoid a jump at
  // the turn. Escort riders can still leave naturally through the screen edge.
  const stopPoses: readonly (readonly [string, number])[] = [
    ["brake", 1],
    ["gallop-extended", 1],
    ["gallop-gathered", 1],
    ["gallop-extended", -1],
    ["gallop-gathered", -1],
  ];
  const stopRanges = stopPoses.map(([pose, facing]) =>
    finaleArtXRange(
      view.viewport,
      sheet.frames[pose],
      poseHeights[pose],
      facing,
    ),
  );
  const minStop = Math.max(...stopRanges.map((range) => range.minX));
  const maxStop = Math.min(...stopRanges.map((range) => range.maxX));
  const turnX =
    minStop <= maxStop
      ? Math.max(minStop, Math.min(maxStop, target.x + 355))
      : (minStop + maxStop) / 2;
  const charge = (at: number, end = target.x + 355) =>
    at <= 48
      ? lerp(source.x, contactX, (at - 18) / 30)
      : lerp(contactX, end, (at - 48) / 28);
  const stride = (at: number) =>
    Math.floor(at / 5) % 2 ? "gathered" : "extended";

  // The escort follows the commander, with contacts exactly 22 frames apart.
  // Paint the last rider first so the leading silhouettes stay readable.
  for (const delay of [44, 22]) {
    const at = tick - delay;
    if (at >= -10 && at < 91) {
      const x = at < 18 ? source.x - (18 - at) * 8 : charge(at);
      mounted(
        `trooper-${stride(at)}`,
        x,
        1,
        clamp((at + 10) / 10) * clamp((91 - at) / 15),
      );
    }
  }

  if (tick < 18) {
    const enter = clamp(tick / 10);
    mounted("ready", source.x, 1, enter);
    if (enter < 1) {
      view.ctx.save();
      view.ctx.globalAlpha *= 1 - enter;
      view.body(view.actor, 334, 516, 297, 1, "stand");
      view.ctx.restore();
    }
  } else if (tick < 76) {
    mounted(`gallop-${stride(tick)}`, charge(tick, turnX));
  } else if (tick < 94) {
    mounted("brake", turnX);
  } else if (tick < 140) {
    // A visible retreat returns the rider to his unchanged physical position.
    const x = lerp(turnX, source.x, (tick - 94) / 46);
    mounted(`gallop-${stride(tick)}`, x, -1);
  } else if (tick < 158) {
    mounted("dismount", source.x);
  } else {
    const exit = clamp((tick - 158) / 18);
    mounted("horse-exit", source.x + 110 + exit * 270, 1, 1 - exit);
    view.body(view.actor, 334, 516, 297, 1, "stand");
  }
  view.body(view.rival, 776, 516, 288, -1, pulse ? "hurt" : "stand");
  if (pulse && motion) {
    const contact = view.point(776, 391);
    view.ring(contact.x, contact.y, 40 + pulse * 24, "#e8ca8d", 0.75);
  }
  if (tick < 36) view.bubble("¡Escuadrón, adelante!", 460, 65, 330);
  view.damage(115);
  return true;
}
