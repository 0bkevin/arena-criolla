import type { EntranceAsset, SpriteAsset } from "./assets";

/** One stable scale fits the entire greeting, including raised hands and its final guard. */
export function selectionBodyHeight(
  sprite: Pick<
    SpriteAsset,
    "frames" | "battleFrame" | "cellWidth" | "bodyHeight" | "baseline"
  > & { entrance?: Omit<EntranceAsset, "image"> },
  width = 400,
  maximum = 375,
) {
  const entrance = sprite.entrance;
  if (!entrance) return maximum;
  let radius = 0;
  let top = 0;
  for (const frame of entrance.frames) {
    const body = frame.bodyHeight ?? entrance.bodyHeight;
    const anchor = frame.anchorX ?? entrance.anchorX - frame.x + frame.slotX;
    const baseline = frame.anchorY ?? entrance.baseline - frame.y + frame.slotY;
    radius = Math.max(radius, anchor / body, (frame.width - anchor) / body);
    top = Math.max(top, baseline / body);
  }
  const guard = sprite.frames[sprite.battleFrame];
  const guardLeft = sprite.cellWidth / 2 - guard.x + guard.slotX;
  radius = Math.max(
    radius,
    guardLeft / sprite.bodyHeight,
    (guard.width - guardLeft) / sprite.bodyHeight,
  );
  top = Math.max(
    top,
    (sprite.baseline - guard.y + guard.slotY) / sprite.bodyHeight,
  );
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(top) ||
    top <= 0
  )
    return maximum;
  return Math.min(maximum, (width / 2 - 16) / radius, 475 / top);
}
