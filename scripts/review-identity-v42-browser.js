// Run from the development review page in a real browser, using game renderers.
import { preloadAssets, drawSprite } from "/src/game/assets.ts";
import { drawPresentation } from "/src/game/presentation-renderer.ts";
import { drawVictory } from "/src/game/victory-renderer.ts";
import { drawIntroCinematic } from "/src/game/intro-renderer.ts";
import { createMatch } from "/shared/engine.ts";
import { fighterById } from "/shared/content.ts";

export const reviewed = ["javier", "nacho"];

function bounds(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1,
    pixels = 0;
  for (let p = 0; p < width * height; p++) {
    if (data[p * 4 + 3] < 40) continue;
    const x = p % width,
      y = Math.floor(p / width);
    pixels++;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    pixels,
    complete:
      pixels > 10_000 &&
      minX > 2 &&
      minY > 2 &&
      maxX < width - 3 &&
      maxY < height - 3,
  };
}

export async function reviewIdentityV42() {
  const assets = await preloadAssets(
    [...reviewed, "renny", "zavarce"],
    ["caracas"],
  );
  const canvas = document.createElement("canvas");
  canvas.width = 520;
  canvas.height = 560;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const poses = [],
    entrances = [],
    victories = [],
    cinematics = [];
  for (const id of reviewed) {
    const sprite = assets.sprites[id];
    for (const facing of [1, -1]) {
      for (let frame = 0; frame < 8; frame++) {
        ctx.clearRect(0, 0, 520, 560);
        drawSprite(ctx, sprite, frame, 260, 485, 355, facing);
        poses.push({ id, facing, frame, ...bounds(canvas) });
      }
      for (let n = 0; n <= 10; n++) {
        ctx.clearRect(0, 0, 520, 560);
        drawPresentation(
          ctx,
          sprite,
          id,
          n / 10,
          260,
          485,
          355,
          facing,
          "intro",
        );
        entrances.push({ id, facing, progress: n / 10, ...bounds(canvas) });
      }
    }
  }
  canvas.width = 1280;
  canvas.height = 720;
  for (const id of reviewed)
    for (const side of [0, 1]) {
      const state = createMatch("caracas", [
        { name: "Uno", fighter: side === 0 ? id : "zavarce", wins: 3 },
        { name: "Dos", fighter: side === 1 ? id : "zavarce", wins: 3 },
      ]);
      for (const tick of [0, 90, 180, 270, 359]) {
        ctx.clearRect(0, 0, 1280, 720);
        state.tick = tick;
        drawIntroCinematic(ctx, state, assets.sprites, false, {
          width: 1280,
          height: 720,
        });
        cinematics.push({ id, side, tick, rendered: true });
      }
      state.phase = "finished";
      state.winner = side;
      for (const elapsedMs of [0, 700, 1400, 2800, 3500]) {
        ctx.clearRect(0, 0, 1280, 720);
        drawVictory(ctx, state, assets, elapsedMs, false);
        victories.push({ id, side, elapsedMs, rendered: true });
      }
    }
  const failures = [...poses, ...entrances].filter((s) => !s.complete);
  const results = {
    poses: {
      checked: poses.length,
      passed: poses.filter((s) => s.complete).length,
      samples: poses,
    },
    entrances: {
      checked: entrances.length,
      passed: entrances.filter((s) => s.complete).length,
      samples: entrances,
    },
    cinematics,
    victories,
    failures,
  };
  window.__identityV42 = {
    assets,
    results,
    drawSprite,
    drawPresentation,
    drawVictory,
    createMatch,
    fighterById,
  };
  if (failures.length) throw new Error(JSON.stringify(failures));
  return window.__identityV42;
}
