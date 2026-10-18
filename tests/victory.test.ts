import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS, type FighterId } from "../shared/content";
import { CHOREOGRAPHIES, REST } from "../shared/choreography";
import { PRESENTATIONS } from "../shared/presentation";
import { createMatch } from "../shared/engine";
import { deformRigPoint } from "../src/game/gesture-rig";
import type { SpriteAsset } from "../src/game/assets";
import {
  sampleDefeat,
  sampleVictory,
  VICTORIES,
  victoryById,
} from "../src/game/victory";
import { drawVictory } from "../src/game/victory-renderer";

const sampleTimes = [0, 210, 700, 1400, 2100, 2800, 3500];
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const animationSignature = (id: FighterId) =>
  JSON.stringify(
    sampleTimes.map((time) => {
      const pose = sampleVictory(id, time);
      return {
        frame: pose.frame,
        gesture: Object.fromEntries(
          Object.entries(pose.gesture).map(([key, value]) => [
            key,
            round(value),
          ]),
        ),
        dx: round(pose.dx),
        dy: round(pose.dy),
        rotate: round(pose.rotate),
      };
    }),
  );

test("all 51 built-in fighters have unique, finite, bounded victory motion", () => {
  assert.equal(FIGHTERS.length, 51);
  assert.deepEqual(
    Object.keys(VICTORIES).sort(),
    FIGHTERS.map((f) => f.id).sort(),
  );
  const signatures = new Set<string>();

  for (const fighter of FIGHTERS) {
    const profile = victoryById(fighter.id);
    assert.ok(profile.name.length > 0, `${fighter.id}: missing animation name`);
    signatures.add(animationSignature(fighter.id));

    for (let elapsed = 0; elapsed <= 3500; elapsed += 50) {
      const pose = sampleVictory(fighter.id, elapsed);
      for (const [key, value] of Object.entries(pose.gesture)) {
        assert.ok(Number.isFinite(value), `${fighter.id}: nonfinite ${key}`);
        if (key === "at") continue;
        const limit = key.endsWith("X")
          ? 0.055
          : key.endsWith("Y")
            ? 0.075
            : 0.32;
        assert.ok(
          Math.abs(value) <= limit + 1e-9,
          `${fighter.id}: ${key}=${value}`,
        );
      }
      for (const [key, value] of Object.entries({
        dx: pose.dx,
        dy: pose.dy,
        rotate: pose.rotate,
      })) {
        assert.ok(Number.isFinite(value), `${fighter.id}: nonfinite ${key}`);
      }
      assert.ok(Math.abs(pose.dx) <= 0.12, `${fighter.id}: excessive travel`);
      assert.ok(Math.abs(pose.dy) <= 0.16, `${fighter.id}: excessive lift`);
      assert.ok(
        Math.abs(pose.rotate) <= 0.12,
        `${fighter.id}: excessive twist`,
      );
    }
  }

  assert.equal(
    signatures.size,
    FIGHTERS.length,
    "sampled motions must be unique, not only their labels",
  );
});

test("victory and defeat settle at 3500ms and hold instead of replaying", () => {
  for (const fighter of FIGHTERS) {
    const atEnd = sampleVictory(fighter.id, 3500);
    for (const afterEnd of [3501, 4200, 7000, 14000])
      assert.deepEqual(sampleVictory(fighter.id, afterEnd), atEnd, fighter.id);
  }
  const defeatedAtEnd = sampleDefeat(3500);
  for (const afterEnd of [3501, 4200, 7000, 14000])
    assert.deepEqual(sampleDefeat(afterEnd), defeatedAtEnd);

  // Both actors move during the curtain call and reach a stable endpoint.
  assert.notDeepEqual(sampleVictory("nacho", 1400), sampleVictory("nacho", 0));
  assert.notDeepEqual(sampleDefeat(1400), sampleDefeat(0));
});

test("jump celebrations prepare on the ground and land before the final hold", () => {
  const jumpers = FIGHTERS.filter(
    (fighter) => victoryById(fighter.id).frame === 4,
  );
  assert.ok(jumpers.length > 0);
  for (const fighter of jumpers) {
    assert.equal(sampleVictory(fighter.id, 0).frame, 0, fighter.id);
    assert.equal(sampleVictory(fighter.id, 1400).frame, 4, fighter.id);
    assert.equal(sampleVictory(fighter.id, 2800).frame, 0, fighter.id);
    assert.equal(sampleVictory(fighter.id, 3500).frame, 0, fighter.id);
  }
});

test("reduced motion keeps both actors static and community fighters use the fallback", () => {
  for (const fighter of FIGHTERS) {
    const pose = sampleVictory(fighter.id, 1400, true);
    assert.deepEqual(pose.gesture, { at: pose.progress, ...REST }, fighter.id);
    assert.equal(pose.dx, 0, fighter.id);
    assert.equal(pose.dy, 0, fighter.id);
    assert.equal(pose.rotate, 0, fighter.id);
  }
  assert.deepEqual(sampleDefeat(1400, true), { dx: 0, dy: 0, rotate: 0 });
  assert.equal(
    victoryById("custom_community-test").name,
    "Un saludo a la arena",
  );
  assert.deepEqual(
    sampleVictory("custom_community-test", 3500),
    sampleVictory("custom_another_id", 3500),
  );
});

test("instrument and handheld prop victories use the rigid neutral frame", () => {
  for (const [id, presentation] of Object.entries(PRESENTATIONS)) {
    if (["guitar", "cuatro", "baton", "phone"].includes(presentation.prop))
      assert.equal(
        victoryById(id as FighterId).frame,
        0,
        `${id} (${presentation.prop})`,
      );
  }
});

test("sampled victory poses keep their rig mesh upright and within the body", () => {
  const delta = 0.0001;
  for (const fighter of FIGHTERS) {
    const rig = CHOREOGRAPHIES[fighter.id];
    const frame = victoryById(fighter.id).frame;
    for (const elapsed of [1050, 1400, 1750, 2100]) {
      const gesture = sampleVictory(fighter.id, elapsed).gesture;
      for (let y = 0.03; y < 0.9; y += 0.1)
        for (let x = -0.28; x < 0.3; x += 0.1) {
          const p = deformRigPoint({ x, y }, rig, gesture, frame);
          const a = deformRigPoint({ x: x + delta, y }, rig, gesture, frame);
          const b = deformRigPoint({ x, y: y + delta }, rig, gesture, frame);
          const determinant =
            ((a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y)) /
            (delta * delta);
          assert.ok(
            Number.isFinite(determinant) && determinant > 0.035,
            `${fighter.id}: inverted mesh at ${elapsed}/${frame}/${x}/${y}`,
          );
          assert.ok(
            Number.isFinite(p.x) && Number.isFinite(p.y),
            `${fighter.id}: nonfinite mesh point`,
          );
          assert.ok(
            Math.hypot(p.x - x, p.y - y) < 0.25,
            `${fighter.id}: excessive mesh deformation`,
          );
        }
    }
  }
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

  drawVictory(ctx, state, assets, 3500, true);

  assert.ok(
    drawnImages.includes(loserSprite.image),
    "loser sprite must be drawn despite zero stocks",
  );
  const actorTranslations = translations.filter(([, y]) => y > 600);
  assert.ok(
    actorTranslations.some(([x]) => Math.abs(x - 830) < 1),
    "loser is staged at the right screen edge",
  );
  assert.ok(
    actorTranslations.some(([x]) => Math.abs(x - 350) < 1),
    "winner remains in the spotlight",
  );
  assert.ok(
    actorTranslations.every(
      ([x, y]) => x >= 0 && x <= 1000 && y >= 0 && y <= 800,
    ),
  );
});
