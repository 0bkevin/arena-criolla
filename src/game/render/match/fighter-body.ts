import type { FighterDefinition } from "../../../../shared/roster/roster";
import {
  opponentOf,
  type MatchState,
  type PlayerIndex,
  type PlayerState,
} from "../../../../shared/engine/engine";
import { drawAttackArt } from "../../assets/attack-art";
import { drawArenaPerformer } from "../arena-finale-renderer";
import { drawAliSpecial } from "../finales/ali";
import { drawBolivarSpecial } from "../finales/bolivar";
import { drawChataingSpecial, drawMicrophoneCable } from "../finales/chataing";
import { drawCocoSpecial } from "../finales/coco";
import { drawDayanaRunwayBody, drawDayanaSpecial } from "../finales/dayana";
import { drawDeynaSpecial } from "../finales/deyna";
import { drawDorangelBite } from "../finales/dorangel";
import { drawDudamelSpecial } from "../finales/dudamel";
import { drawInakiAction } from "../finales/inaki";
import { drawLloronaSpecial } from "../finales/llorona";
import { drawLorenzoSpecial } from "../finales/lorenzo";
import { drawMaiteFinaleBody } from "../finales/maite";
import { drawMelanioSpecial } from "../finales/melanio";
import { simonSpecialPose } from "../finales/simon";
import type { Assets } from "./match-assets";

/**
 * Paint any special-move or finale artwork that replaces the fighter's
 * ordinary sprite. Returns whether one of them painted the body.
 */
export function drawPaintedBody(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  p: PlayerState,
  i: PlayerIndex,
  def: FighterDefinition,
  bodyHeight: number,
  reducedMotion: boolean,
) {
  const paintedInaki = drawInakiAction(
    ctx,
    assets.finaleProps,
    p,
    bodyHeight,
    reducedMotion,
  );
  const paintedDorangel = drawDorangelBite(
    ctx,
    assets.finaleProps,
    p,
    bodyHeight,
    reducedMotion,
    state.players[opponentOf(i)],
  );
  const paintedArena = drawArenaPerformer(
    ctx,
    assets.finaleProps,
    state,
    p,
    bodyHeight,
    reducedMotion,
  );
  const playingCuatro = def.id === "simon" && p.attack === "special" && !p.stun;
  const paintedCuatro =
    drawAliSpecial(ctx, assets.finaleProps, p, bodyHeight) ||
    (playingCuatro &&
      drawAttackArt(
        ctx,
        assets.finaleProps,
        "simon",
        simonSpecialPose(p.attackTick),
        p.x,
        p.y,
        bodyHeight,
        p.facing,
      ));
  const paintedGreeting =
    !paintedCuatro &&
    drawMaiteFinaleBody(ctx, assets.finaleProps, p, bodyHeight);
  const paintedMicrophone =
    !paintedCuatro &&
    !paintedGreeting &&
    drawChataingSpecial(ctx, state, assets.finaleProps, p, i, bodyHeight);
  const paintedSignal =
    !paintedCuatro &&
    !paintedGreeting &&
    !paintedMicrophone &&
    drawMelanioSpecial(ctx, assets.finaleProps, p, bodyHeight);
  const paintedFootball =
    !paintedSignal && drawDeynaSpecial(ctx, assets.finaleProps, p, bodyHeight);
  const paintedRunway = drawDayanaRunwayBody(
    ctx,
    assets.finaleProps,
    state,
    p,
    bodyHeight,
  );
  const paintedPageant =
    !paintedRunway && drawDayanaSpecial(ctx, assets.finaleProps, p, bodyHeight);
  const paintedLlorona = drawLloronaSpecial(
    ctx,
    assets.finaleProps,
    p,
    bodyHeight,
  );
  const paintedConductor = drawDudamelSpecial(
    ctx,
    assets.finaleProps,
    p,
    bodyHeight,
  );
  const paintedSabre = drawBolivarSpecial(
    ctx,
    assets.finaleProps,
    p,
    bodyHeight,
  );
  const paintedPan = drawLorenzoSpecial(ctx, assets.finaleProps, p, bodyHeight);
  const paintedCoco = drawCocoSpecial(ctx, assets.finaleProps, p, bodyHeight);
  return (
    paintedCoco ||
    paintedLlorona ||
    paintedConductor ||
    paintedSabre ||
    paintedPan ||
    paintedCuatro ||
    paintedGreeting ||
    paintedMicrophone ||
    paintedSignal ||
    paintedFootball ||
    paintedPageant ||
    paintedRunway ||
    paintedArena ||
    paintedDorangel ||
    paintedInaki
  );
}

/** Sprite-fallback cable and contact marker for Chataing's tethered microphone. */
export function drawMicrophoneTether(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  p: PlayerState,
  i: PlayerIndex,
  def: FighterDefinition,
) {
  const tether =
    def.id === "chataing" &&
    state.projectiles.find((shot) => shot.owner === i && shot.tether);
  if (tether) {
    // A failed optional sheet keeps the canonical held mic unique. A neutral
    // contact marker still exposes the exact physical projectile position.
    drawMicrophoneCable(ctx, { x: p.x, y: p.y - 115 }, tether, 14, 2);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#dce8ee";
    ctx.fillStyle = "#353e49";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tether.x, tether.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
