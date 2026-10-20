import type { SpriteAsset } from "./assets";
import { fighterById } from "../../shared/content";
import type { MatchState } from "../../shared/engine";
import { victoryById } from "./victory";
import { ATTACK_ART, type AttackArtFrame } from "./attack-art";

/** Shared by the arena and the result handoff so the winner never teleports. */
export function victoryActorLayout(
  state: MatchState,
  sprite: SpriteAsset,
  side: number,
  width: number,
  height: number,
) {
  const winner = typeof state.winner === "number" ? state.winner : null;
  const won = side === winner;
  const id = state.players[side].config.fighter;
  const profile = won ? victoryById(id) : null;
  const unit = Math.min(height, width / 1.45);
  return {
    x:
      width *
      (winner === null
        ? side === 0
          ? 0.34
          : 0.66
        : won
          ? side === 0
            ? 0.35
            : 0.65
          : side === 0
            ? 0.17
            : 0.83),
    feet: height * 0.88,
    facing: side === 0 ? 1 : -1,
    bodyHeight: victoryBodyHeight(
      sprite,
      unit *
        (won ? 0.61 : winner === null ? 0.43 : 0.27) *
        ((fighterById(id).displayHeight ?? 177) / 177),
      width,
      height,
      won
        ? [0, profile!.frame, sprite.battleFrame]
        : [winner === null ? sprite.battleFrame : 7],
      profile?.paintedPose
        ? ATTACK_ART[id]?.frames[profile.paintedPose]
        : undefined,
    ),
  };
}

/** Leave room for the whole painted silhouette, its gesture and its jump. */
export function victoryBodyHeight(
  sprite: Pick<SpriteAsset, "frames" | "cellWidth" | "bodyHeight" | "baseline">,
  requestedHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  frames: number[],
  paintedFrame?: AttackArtFrame,
) {
  let radius = 0;
  let top = 0;
  for (const index of frames) {
    const frame = sprite.frames[index];
    const left =
      (sprite.cellWidth / 2 - frame.x + frame.slotX) / sprite.bodyHeight;
    radius = Math.max(radius, left, frame.width / sprite.bodyHeight - left);
    top = Math.max(
      top,
      (sprite.baseline - frame.y + frame.slotY) / sprite.bodyHeight,
    );
  }
  if (paintedFrame) {
    const body = paintedFrame.bodyHeight ?? paintedFrame.height;
    radius = Math.max(
      radius,
      paintedFrame.anchorX / body,
      (paintedFrame.width - paintedFrame.anchorX) / body,
    );
    top = Math.max(top, (paintedFrame.anchorY ?? paintedFrame.height) / body);
  }
  return Math.min(
    requestedHeight,
    (canvasWidth * 0.18) / (radius + 0.18),
    (canvasHeight * 0.78) / (top + 0.24),
  );
}
