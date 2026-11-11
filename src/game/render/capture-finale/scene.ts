import type { FighterId } from "../../../../shared/roster/roster";
import type { MatchState } from "../../../../shared/engine/engine";
import type { FinaleDefinition } from "../../../../shared/engine/finales/finales";
import type { SpriteAsset } from "../../assets/assets";
import type { FinaleArenaLayout } from "../finale-layout";

export interface Scene {
  ctx: CanvasRenderingContext2D;
  state: MatchState;
  profile: FinaleDefinition;
  sprites: Record<string, SpriteAsset>;
  props: Record<string, HTMLImageElement>;
  tick: number;
  motion: number;
  pulse: number;
  beat: number;
  actor: FighterId;
  rival: FighterId;
  layout: FinaleArenaLayout;
}
export const sceneDirections = new WeakMap<CanvasRenderingContext2D, number>();
