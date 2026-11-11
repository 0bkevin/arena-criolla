import type { MatchState } from "../../../shared/engine/engine";
import {
  CANONICAL_FINALE_FIGHTERS,
  finaleById,
  type FinaleDefinition,
} from "../../../shared/engine/finales/finales";
import type { SpriteAsset } from "../assets/assets";
import { drawBroadcastScene } from "./capture-finale/broadcast-scene";
import { drawCoffeeScene } from "./capture-finale/coffee-scene";
import { drawDanceScene } from "./capture-finale/dance-scene";
import { drawFolkloreScene } from "./capture-finale/folklore-scene";
import { drawHackScene } from "./capture-finale/hack-scene";
import { drawIconScene } from "./capture-finale/icon-scene";
import { clamp } from "./capture-finale/math";
import { drawMusicScene } from "./capture-finale/music-scene";
import { text } from "./capture-finale/primitives";
import { sceneDirections, type Scene } from "./capture-finale/scene";
import { drawTheaterScene } from "./capture-finale/theater-scene";
import { drawTransportScene } from "./capture-finale/transport-scene";
import { finaleArenaLayout } from "./finale-layout";

/** The latest damage beat reached and its fading visual pulse. */
function damageBeat(profile: FinaleDefinition, tick: number) {
  let beat = -1,
    pulse = 0;
  for (const [i, at] of profile.damageBeats.entries())
    if (tick >= at) {
      beat = i;
      pulse = Math.max(pulse, clamp(1 - (tick - at) / 20));
    }
  return { beat, pulse };
}
/** Each capture finale paints the scene of its fighter or family. */
function drawCaptureScene(scene: Scene) {
  const { profile } = scene;
  if ((CANONICAL_FINALE_FIGHTERS as readonly string[]).includes(profile.id))
    drawIconScene(scene);
  else if (profile.id === "capriles") drawCoffeeScene(scene);
  else if (profile.family === "dance") drawDanceScene(scene);
  else if (profile.family === "technology") drawHackScene(scene);
  else if (profile.family === "transport") drawTransportScene(scene);
  else if (profile.family === "music") drawMusicScene(scene);
  else if (profile.family === "broadcast") drawBroadcastScene(scene);
  else if (profile.family === "theater") drawTheaterScene(scene);
  else if (profile.family === "folklore") drawFolkloreScene(scene);
}

/** Draw temporary actors and props inside the arena camera already on the context. */
export function drawFinale(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  sprites: Record<string, SpriteAsset>,
  props: Record<string, HTMLImageElement>,
  reducedMotion = false,
  _viewport = { width: 1080, height: 640 },
) {
  const finale = state.finale,
    profile = finale && finaleById(finale.fighter);
  const layout = finaleArenaLayout(state);
  if (!finale || !profile || profile.mode !== "capture" || !layout) return;
  const tick = clamp(finale.tick, 0, finale.duration);
  const { beat, pulse } = damageBeat(profile, tick);
  const scene: Scene = {
    ctx,
    state,
    profile,
    sprites,
    props,
    tick,
    motion: reducedMotion ? 0 : 1,
    pulse,
    beat,
    actor: finale.fighter,
    rival: state.players[finale.target].config.fighter,
    layout,
  };
  ctx.save();
  const previousDirection = sceneDirections.get(ctx);
  sceneDirections.set(ctx, layout.direction);
  ctx.translate(layout.originX, layout.originY);
  ctx.scale(layout.scale * layout.direction, layout.scale);
  ctx.translate(-540, -516);
  ctx.imageSmoothingEnabled = true;
  drawCaptureScene(scene);
  text(ctx, "DEFINITIVA", 540, 150, 25, "#ffe5a3");
  ctx.restore();
  if (previousDirection === undefined) sceneDirections.delete(ctx);
  else sceneDirections.set(ctx, previousDirection);
}
