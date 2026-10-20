import { finaleById } from "../../shared/finales";
import { fighterById } from "../../shared/content";
import type { PlayerState } from "../../shared/engine";
import { TECHNIQUES } from "../../shared/techniques";
import { drawAttackArt, hasAttackArt } from "./attack-art";

interface TransformationArt {
  fighter: "conde" | "emilio";
  specialPose: string;
  posture: Record<string, number>;
  poseFacing?: Record<string, number>;
}
const forms: Record<string, TransformationArt> = {
  "conde-bond": {
    fighter: "conde",
    specialPose: "whirl",
    posture: {
      ready: 1,
      guard: 0.94,
      run: 1,
      jump: 0.85,
      punch: 0.94,
      kick: 0.96,
      hurt: 0.9,
      whirl: 0.94,
    },
  },
  "el-chunior": {
    fighter: "emilio",
    specialPose: "retort",
    posture: {
      ready: 1,
      guard: 0.98,
      run: 0.98,
      jump: 0.9,
      punch: 0.93,
      kick: 0.93,
      hurt: 0.93,
      retort: 0.93,
    },
    // The conversational ready drawing faces left, as in Emilio's canonical sheet.
    poseFacing: { ready: -1 },
  },
};

/** Same costume for actions, recoil and dash trails; choose contact poses at hit time. */
export function transformationPose(player: PlayerState): string {
  if (player.stun) return "hurt";
  if (player.blocking) return "guard";
  if (player.attack === "light")
    return player.attackTick < 6
      ? "guard"
      : player.attackTick <= 13
        ? "punch"
        : "ready";
  if (player.attack === "heavy")
    return player.attackTick < 11
      ? "guard"
      : player.attackTick <= 20
        ? "kick"
        : "ready";
  if (player.attack === "special") {
    const technique = TECHNIQUES[fighterById(player.config.fighter).ability];
    const form = player.transformation && forms[player.transformation.id];
    const startup = technique.startup;
    const active = (technique.pulses ?? [0]).some(
      (offset) =>
        player.attackTick >= startup + offset &&
        player.attackTick < startup + offset + (technique.dash?.ticks ?? 9),
    );
    return player.attackTick < startup
      ? "guard"
      : active
        ? (form?.specialPose ?? "ready")
        : "ready";
  }
  if (!player.grounded) return "jump";
  if (player.dash || Math.abs(player.vx) > 0.7) return "run";
  return "ready";
}

export function drawTransformationBody(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement>,
  player: PlayerState,
  x: number,
  feet: number,
  bodyHeight: number,
): boolean {
  const form = player.transformation && forms[player.transformation.id];
  if (
    !form ||
    !player.transformation ||
    player.transformation.ticks <= 0 ||
    player.config.fighter !== form.fighter ||
    !hasAttackArt(images, form.fighter, Object.keys(form.posture))
  )
    return false;
  const pose = transformationPose(player);
  // Crouched and airborne silhouettes are shorter; don't inflate their heads
  // to the upright height. Full source poses remain unwarped.
  return drawAttackArt(
    ctx,
    images,
    form.fighter,
    pose,
    x,
    feet,
    bodyHeight * form.posture[pose],
    player.facing * (form.poseFacing?.[pose] ?? 1),
  );
}

/** A quiet duration gauge also makes the buff legible if optional art is missing. */
export function drawTransformationGauge(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
) {
  if (!player.transformation || player.transformation.ticks <= 0) return;
  const duration = finaleById(player.config.fighter)?.empowerment?.duration;
  if (!duration) return;
  ctx.save();
  ctx.fillStyle = "#111824cc";
  ctx.fillRect(player.x - 24, player.y + 13, 48, 4);
  ctx.fillStyle = "#f7ead0";
  ctx.fillRect(
    player.x - 24,
    player.y + 13,
    48 * Math.min(1, player.transformation.ticks / duration),
    4,
  );
  ctx.restore();
}
