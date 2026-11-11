import { stageById } from "../../../../shared/roster/roster";
import type { MatchState } from "../../../../shared/engine/engine";
import {
  advanceArenaCamera,
  cameraBounds,
  type ArenaCamera,
} from "../../viewport/arena-camera";
import { drawArenaFinaleLayer } from "../arena-finale-renderer";
import { drawImpact } from "../effects-renderer";
import { drawDayanaRunway } from "../finales/dayana";
import { drawDeynaSquad } from "../finales/deyna";
import { drawDudamelImpact } from "../finales/dudamel";
import { drawLloronaImpact } from "../finales/llorona";
import { drawStage } from "../stage-renderer";
import type { Assets } from "./match-assets";

export type ArenaBounds = ReturnType<typeof cameraBounds>;

/** Apply the arena camera (and hit shake) and return the visible world area. */
export function applyArenaCamera(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  width: number,
  height: number,
  time: number,
  reducedMotion: boolean,
  camera?: ArenaCamera,
) {
  const framing =
    camera ??
    advanceArenaCamera(undefined, state, width, height, 0, reducedMotion);
  const bounds = cameraBounds(framing, width, height);
  ctx.scale(framing.zoom, framing.zoom);
  ctx.translate(-bounds.x, -bounds.y);
  if (!reducedMotion && state.shake > 0.3)
    ctx.translate(
      Math.sin(time * 0.07) * state.shake,
      Math.cos(time * 0.08) * state.shake * 0.4,
    );
  return bounds;
}

/** The stage and every field-finale layer painted behind projectiles and fighters. */
export function drawBackLayers(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  bounds: ArenaBounds,
  reducedMotion: boolean,
) {
  const bg = assets.stages[state.stage];
  const stage = stageById(state.stage);
  drawStage(ctx, stage, bg, state.tick, bounds);
  for (const field of state.fieldFinales ?? []) {
    if (field.fighter === "deyna")
      drawDeynaSquad(ctx, assets.finaleProps, field, "back");
    else if (field.fighter === "dayana")
      drawDayanaRunway(ctx, assets.finaleProps, field);
  }
  drawArenaFinaleLayer(ctx, assets.finaleProps, state, "back", reducedMotion);
}

/** Field-finale layers that pass in front of the fighters. */
export function drawFrontLayers(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  reducedMotion: boolean,
) {
  for (const field of state.fieldFinales ?? [])
    if (field.fighter === "deyna")
      drawDeynaSquad(ctx, assets.finaleProps, field, "front");
  drawArenaFinaleLayer(ctx, assets.finaleProps, state, "front", reducedMotion);
}

/** A faint full-view flash on the first frame of a heavy or super hit. */
export function drawHitFlash(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  bounds: ArenaBounds,
  width: number,
  height: number,
) {
  if (
    state.hitstop > 0 &&
    state.effects.some(
      (e) =>
        e.kind === "hit" &&
        (e.impact === "heavy" || e.impact === "super") &&
        e.life === e.duration,
    )
  ) {
    ctx.fillStyle = "#fff2d90c";
    ctx.fillRect(bounds.x, bounds.y, width, height);
  }
}

export function drawEffects(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
) {
  state.effects.forEach((e) => {
    drawImpact(ctx, e);
    drawLloronaImpact(ctx, state, assets.finaleProps, e);
    drawDudamelImpact(ctx, state, e);
  });
}
