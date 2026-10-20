import { fieldFinaleBounds } from "../../shared/field-finales";
import { WORLD } from "../../shared/arena";
import { fighterById } from "../../shared/content";
import type { MatchState } from "../../shared/engine";

export interface ArenaCamera {
  x: number;
  zoom: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const FLOOR_ANCHOR = 0.86;

export function cameraBounds(
  camera: ArenaCamera,
  width: number,
  height: number,
) {
  const viewWidth = width / camera.zoom;
  const viewHeight = height / camera.zoom;
  return {
    x: camera.x - viewWidth / 2,
    y: WORLD.floor - viewHeight * FLOOR_ANCHOR,
    width: viewWidth,
    height: viewHeight,
  };
}

/** A shared camera follows the action, with enough room for both bodies and jumps. */
export function advanceArenaCamera(
  previous: ArenaCamera | undefined,
  state: MatchState,
  width: number,
  height: number,
  elapsed = 1000 / 60,
  reducedMotion = false,
): ArenaCamera {
  const overview = { x: WORLD.x + WORLD.width / 2, zoom: 1 };
  if (reducedMotion) return overview;
  if (state.phase === "finished" && previous) return previous;
  const players = state.players.filter((player) => player.stocks > 0);
  if (!players.length) return overview;
  // Stop tracking beyond the recovery zone so a knockout cannot drag the shot away.
  const positions = players.map((player) =>
    clamp(player.x, WORLD.x - 120, WORLD.x + WORLD.width + 120),
  );
  const fields = fieldFinaleBounds(state);
  const left = Math.min(...positions, ...fields.map((field) => field.left));
  const right = Math.max(...positions, ...fields.map((field) => field.right));
  const head = Math.min(
    ...players.map((player) =>
      Math.max(
        WORLD.y - 160,
        player.y - (fighterById(player.config.fighter).displayHeight ?? 177),
      ),
    ),
  );
  const padding = 96;
  const fitZoom = Math.min(
    width / (right - left + padding * 2),
    (height * FLOOR_ANCHOR) / Math.max(1, WORLD.floor - head + 64),
  );
  const targetZoom = Math.min(2, width / 1000, fitZoom);
  const dt = clamp(elapsed, 0, 100);
  const zoom = previous
    ? Math.min(
        fitZoom,
        previous.zoom +
          (targetZoom - previous.zoom) * (1 - Math.exp(-dt / 280)),
      )
    : targetZoom;
  const viewWidth = width / zoom;
  const trackingLeft = Math.min(WORLD.x, left - padding);
  const trackingRight = Math.max(WORLD.x + WORLD.width, right + padding);
  const targetX =
    viewWidth >= trackingRight - trackingLeft
      ? (trackingLeft + trackingRight) / 2
      : clamp(
          (left + right) / 2,
          trackingLeft + viewWidth / 2,
          trackingRight - viewWidth / 2,
        );
  let x = previous
    ? previous.x + (targetX - previous.x) * (1 - Math.exp(-dt / 140))
    : targetX;
  // A fast dash or respawn must remain visible while the rest of the pan eases in.
  x = clamp(x, right + 64 - viewWidth / 2, left - 64 + viewWidth / 2);
  return { x, zoom };
}
