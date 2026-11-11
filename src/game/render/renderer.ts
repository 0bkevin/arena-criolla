import type { MatchState } from "../../../shared/engine/engine";
import { finaleById } from "../../../shared/engine/finales/finales";
import { INTRO_COUNTDOWN_START } from "../../../shared/engine/intro";
import type { ArenaCamera } from "../viewport/arena-camera";
import { drawFinale } from "./finale-renderer";
import { drawIntroCinematic } from "./intro-renderer";
import {
  applyArenaCamera,
  drawBackLayers,
  drawEffects,
  drawFrontLayers,
  drawHitFlash,
} from "./match/arena-layers";
import { drawFighters } from "./match/fighters";
import type { Assets } from "./match/match-assets";
import { drawProjectiles } from "./match/projectiles";
import { sampleKnockout } from "../match/knockout";

export type { Assets } from "./match/match-assets";
export function renderMatch(
  ctx: CanvasRenderingContext2D,
  match: MatchState,
  assets: Assets,
  time: number,
  reducedMotion = false,
  camera?: ArenaCamera,
  knockoutElapsed = 0,
) {
  const state =
    match.phase === "finished"
      ? sampleKnockout(match, knockoutElapsed, reducedMotion)
      : match;
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (state.phase === "intro" && state.tick < INTRO_COUNTDOWN_START) {
    drawIntroCinematic(ctx, state, assets.sprites, reducedMotion, {
      width,
      height,
    });
    return;
  }
  ctx.save();
  const bounds = applyArenaCamera(
    ctx,
    state,
    width,
    height,
    time,
    reducedMotion,
    camera,
  );
  drawBackLayers(ctx, state, assets, bounds, reducedMotion);
  drawProjectiles(ctx, state, assets, time, reducedMotion);
  if (
    state.phase === "playing" &&
    state.finale &&
    finaleById(state.finale.fighter)?.mode === "capture"
  ) {
    drawFinale(ctx, state, assets.sprites, assets.finaleProps, reducedMotion);
    ctx.restore();
    return;
  }
  drawFighters(ctx, state, assets, time, reducedMotion, knockoutElapsed);
  drawFrontLayers(ctx, state, assets, reducedMotion);
  drawHitFlash(ctx, state, bounds, width, height);
  drawEffects(ctx, state, assets);
  ctx.restore();
}
