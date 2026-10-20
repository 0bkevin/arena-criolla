import type { FighterId } from "../../../shared/content";
import type { MatchState } from "../../../shared/engine";
import type { FinaleDefinition } from "../../../shared/finales";
import type { SpriteAsset } from "../assets";
import type { FinaleViewportBounds } from "../finale-viewport";

export type FinalePose =
  | "stand"
  | "seat"
  | "talk"
  | "sip"
  | "dance"
  | "type"
  | "perform"
  | "recoil"
  | "hurt";
/** Character sequences share the existing arena camera, anchoring and bitmap loader. */
export interface FinaleView {
  ctx: CanvasRenderingContext2D;
  state: MatchState;
  profile: FinaleDefinition;
  actor: FighterId;
  rival: FighterId;
  tick: number;
  pulse: number;
  beat: number;
  motion: number;
  images: Record<string, HTMLImageElement>;
  sprites: Record<string, SpriteAsset>;
  /** Present when the current canvas transform is available; coordinates match point(). */
  viewport?: FinaleViewportBounds;
  point(x: number, y: number): { x: number; y: number };
  body(
    id: FighterId,
    x: number,
    feet: number,
    height: number,
    facing: number,
    mode?: FinalePose,
    offset?: number,
  ): void;
  art(
    pose: string,
    x: number,
    feet: number,
    height: number,
    facing?: number,
    alpha?: number,
  ): boolean;
  text(
    value: string,
    x: number,
    y: number,
    size?: number,
    color?: string,
  ): void;
  bubble(
    value: string | readonly string[],
    x: number,
    y: number,
    width: number,
  ): void;
  ring(
    x: number,
    y: number,
    radius: number,
    color?: string,
    squash?: number,
  ): void;
  damage(y?: number): void;
}
export type FinaleSequence = (view: FinaleView) => boolean;
