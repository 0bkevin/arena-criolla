import test from "node:test";
import assert from "node:assert/strict";
import { REST } from "../shared/choreography";
import { createMatch } from "../shared/engine";
import type { SpriteAsset } from "../src/game/assets";
import { sampleDefeat, sampleVictory, victoryById } from "../src/game/victory";
import { drawVictory } from "../src/game/victory-renderer";
import { VICTORY_DURATION_MS } from "../src/game/victory-types";

const at = (progress: number) => progress * VICTORY_DURATION_MS;

test("reduced motion keeps both actors static and community fighters use the fallback", () => {
  for (const id of ["ali", "custom_community-test"] as const) {
    const pose = sampleVictory(id, at(0.4), true);
    assert.deepEqual(pose.gesture, { at: pose.progress, ...REST }, id);
    assert.equal(pose.dx, 0, id);
    assert.equal(pose.dy, 0, id);
    assert.equal(pose.rotate, 0, id);
  }
  assert.deepEqual(sampleDefeat(at(0.4), true), { dx: 0, dy: 0, rotate: 0 });
  assert.ok(victoryById("custom_community-test"));
  assert.deepEqual(
    sampleVictory("custom_community-test", at(1)),
    sampleVictory("custom_another_id", at(1)),
  );
});

function spriteAsset(): SpriteAsset {
  const image = {} as HTMLImageElement;
  return {
    image,
    cellWidth: 100,
    cellHeight: 100,
    baseline: 90,
    bodyHeight: 80,
    portraitCenters: Array(8).fill(50),
    frameFacing: Array(8).fill(1),
    battleFrame: 1,
    frames: Array.from({ length: 8 }, (_, index) => ({
      x: (index % 4) * 100 + 20,
      y: Math.floor(index / 4) * 100 + 10,
      width: 60,
      height: 80,
      slotX: (index % 4) * 100,
      slotY: Math.floor(index / 4) * 100,
    })),
  };
}

test("drawVictory stages a ringed-out zero-stock loser on screen", () => {
  const winnerId = "ali";
  const loserId = "gualberto";
  const state = createMatch("caracas", [
    { name: "Winner", fighter: winnerId, wins: 0 },
    { name: "Loser", fighter: loserId, wins: 0 },
  ]);
  state.phase = "finished";
  state.winner = 0;
  state.players[1].stocks = 0;
  state.players[1].x = -10000;
  state.players[1].y = -10000;
  state.effects.push({
    id: 1,
    x: -10000,
    y: -10000,
    kind: "ringout",
    color: "#fff",
    duration: 40,
    life: 40,
  });
  const winnerSprite = spriteAsset();
  const loserSprite = spriteAsset();
  const assets = {
    sprites: { [winnerId]: winnerSprite, [loserId]: loserSprite },
  } as Parameters<typeof drawVictory>[2];

  const translations: [number, number][] = [];
  const drawnImages: CanvasImageSource[] = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    {
      canvas: { width: 1000, height: 800 },
      createLinearGradient: () => gradient,
      translate: (x: number, y: number) => translations.push([x, y]),
      drawImage: (image: CanvasImageSource) => drawnImages.push(image),
    },
    {
      get(target, key) {
        return key in target ? target[key as keyof typeof target] : () => {};
      },
      set(target, key, value) {
        Reflect.set(target, key, value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;

  drawVictory(ctx, state, assets, at(1), true);

  assert.ok(
    drawnImages.includes(loserSprite.image),
    "loser sprite must be drawn despite zero stocks",
  );
  const actorTranslations = translations.filter(([, y]) => y > 600);
  assert.ok(drawnImages.includes(winnerSprite.image));
  assert.ok(actorTranslations.length >= 2);
  assert.ok(
    actorTranslations.every(
      ([x, y]) => x >= 0 && x <= 1000 && y >= 0 && y <= 800,
    ),
  );
});
