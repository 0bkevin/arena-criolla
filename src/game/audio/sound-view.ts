import { WORLD } from "../../../shared/engine/arena";

// The visible slice of the arena, so panning follows the camera.
let soundView = { left: WORLD.left, right: WORLD.right };

export function setSoundView(left: number, right: number) {
  if (Number.isFinite(left) && Number.isFinite(right) && right > left)
    soundView = { left, right };
}

export function resetSoundView() {
  soundView = { left: WORLD.left, right: WORLD.right };
}

export const stereoPosition = (x = 540) =>
  Math.max(
    -0.8,
    Math.min(
      0.8,
      (x - (soundView.left + soundView.right) / 2) /
        ((soundView.right - soundView.left) / 2),
    ),
  );
