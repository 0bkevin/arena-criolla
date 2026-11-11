import {
  fighterById,
  type FighterDefinition,
} from "../../../../shared/roster/roster";
import {
  PLAYERS,
  opponentOf,
  type MatchState,
  type PlayerIndex,
  type PlayerState,
} from "../../../../shared/engine/engine";
import { introActor } from "../../../../shared/engine/intro";
import { entranceProgress } from "../../presentation/presentation";
import { drawSprite, type SpriteAsset } from "../../assets/assets";
import { KNOCKOUT_RECOIL_MS } from "../../match/knockout";
import { dorangelHeatReaction } from "../finales/dorangel";
import { drawPresentation } from "../presentation-renderer";
import {
  drawTransformationBody,
  drawTransformationGauge,
} from "../transformation-art";
import { drawMicrophoneTether, drawPaintedBody } from "./fighter-body";
import { fighterFrame } from "./fighter-frame";
import {
  drawAttackArc,
  drawFighterTags,
  drawGuard,
  drawSpecialEffects,
} from "./fighter-overlays";
import type { Assets } from "./match-assets";

export function drawFighters(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  time: number,
  reducedMotion: boolean,
  knockoutElapsed: number,
) {
  // A held forearm belongs behind the attacker's gripping hands, on either side.
  const bodyOrder: readonly PlayerIndex[] =
    state.players[1].rootKind === "bite" ? [1, 0] : PLAYERS;
  bodyOrder.forEach((i) =>
    drawFighter(ctx, state, assets, i, time, reducedMotion, knockoutElapsed),
  );
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  i: PlayerIndex,
  time: number,
  reducedMotion: boolean,
  knockoutElapsed: number,
) {
  const p = state.players[i];
  const def = fighterById(p.config.fighter);
  const bodyHeight = def.displayHeight ?? 177;
  const sprite = assets.sprites[p.config.fighter];
  if (p.stocks <= 0) {
    if (state.phase === "finished")
      drawKnockedOut(
        ctx,
        p,
        sprite,
        bodyHeight,
        reducedMotion,
        knockoutElapsed,
      );
    return;
  }
  ctx.save();
  ctx.fillStyle = "#090c1670";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 4, 42, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (state.phase === "intro") {
    const active = introActor(state.tick) === i;
    drawPresentation(
      ctx,
      sprite,
      def.id,
      active ? entranceProgress(def.id, state.tick, i) : 1,
      p.x,
      p.y,
      bodyHeight,
      p.facing,
      "intro",
      reducedMotion,
    );
    ctx.restore();
    return;
  }
  if (p.invincible > 15 && Math.floor(time / 75) % 2 === 0)
    ctx.globalAlpha = 0.45;
  drawFighterBody(
    ctx,
    state,
    assets,
    p,
    i,
    def,
    sprite,
    bodyHeight,
    time,
    reducedMotion,
  );
  drawTransformationGauge(ctx, p);
  drawAttackArc(ctx, p);
  drawSpecialEffects(ctx, state, assets, p, i, def, sprite, bodyHeight);
  drawGuard(ctx, p, def);
  drawFighterTags(ctx, state, p, i, bodyHeight);
  ctx.restore();
}

/** The eliminated fighter stays visible, recoiling, during the result delay. */
function drawKnockedOut(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  sprite: SpriteAsset,
  bodyHeight: number,
  reducedMotion: boolean,
  knockoutElapsed: number,
) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (!reducedMotion)
    ctx.rotate(
      Math.sign(p.vx || -p.facing) *
        Math.min(1, knockoutElapsed / KNOCKOUT_RECOIL_MS) *
        0.8,
    );
  drawSprite(ctx, sprite, 7, 0, 0, bodyHeight, p.facing);
  ctx.restore();
}

/** The fighter's body: dash afterimages, then special artwork or the sprite. */
function drawFighterBody(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  p: PlayerState,
  i: PlayerIndex,
  def: FighterDefinition,
  sprite: SpriteAsset,
  bodyHeight: number,
  time: number,
  reducedMotion: boolean,
) {
  let frame = fighterFrame(state, p, def, sprite);
  const heatReaction = dorangelHeatReaction(state, p, reducedMotion);
  if (heatReaction?.frame !== undefined) frame = heatReaction.frame;
  if (p.rootKind === "bite" && p.rootTicks > 0) frame = 5;
  const bodyFacing =
    p.rootKind === "bite"
      ? state.players[opponentOf(i)].x > p.x
        ? 1
        : -1
      : p.facing;
  const idleBob =
    !reducedMotion &&
    !heatReaction &&
    !p.attack &&
    p.grounded &&
    !p.stun &&
    !p.blocking
      ? Math.sin(time / 240 + i) * 1.5
      : 0;
  const drawBody = (x: number, feet: number) => {
    if (
      !drawTransformationBody(ctx, assets.finaleProps, p, x, feet, bodyHeight)
    )
      drawSprite(ctx, sprite, frame, x, feet, bodyHeight, bodyFacing);
  };
  ctx.save();
  if (heatReaction) {
    // Knees and boots stay inside the bowl even in a wide canonical stance.
    const top = p.y - bodyHeight - 40;
    ctx.beginPath();
    ctx.rect(p.x - 200, top, 400, heatReaction.lipY - top);
    ctx.clip();
  }
  if (p.dash > 0 && !reducedMotion) {
    const opacity = ctx.globalAlpha;
    ctx.globalAlpha = opacity * 0.16;
    drawBody(p.x - p.facing * 44, p.y);
    ctx.globalAlpha = opacity * 0.28;
    drawBody(p.x - p.facing * 22, p.y);
    ctx.globalAlpha = opacity;
  }
  if (
    !drawPaintedBody(ctx, state, assets, p, i, def, bodyHeight, reducedMotion)
  ) {
    drawBody(p.x, p.y + idleBob + (heatReaction?.lift ?? 0));
    drawMicrophoneTether(ctx, state, p, i, def);
  }
  ctx.restore();
}
