import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { FIGHTERS } from "../shared/content";
import {
  ENTRANCE_ACTIONS,
  sampleEntranceAction,
  sampleEntranceBall,
} from "../shared/entrance-actions";
import { presentationById } from "../shared/presentation";
import entrances from "../shared/entrance-assets.json";
import attacks from "../shared/attack-assets.json";
import { drawEntranceAction } from "../src/game/entrance-renderer";
import { selectionBodyHeight } from "../src/game/entrance-framing";
import { introCamera } from "../src/game/intro-renderer";
import { drawPresentation } from "../src/game/presentation-renderer";
import type { EntranceAsset, SpriteAsset } from "../src/game/assets";

const added = [
  "simon",
  "conde",
  "ali",
  "gualberto",
  "lele",
  "silbon",
  "llorona",
  "sayona",
  "lionza",
  "florentino",
  "diablo",
  "knoche",
  "momoy",
  "tiotigre",
  "tioconejo",
  "enrique",
  "jesus",
  "carlos",
  "victor",
  "juan",
  "lorenzo",
  "carolina",
  "dayana",
  "deyna",
  "bolivar",
  "edgar",
  "melanio",
] as const;
const manifest = entrances as Record<
  string,
  Omit<EntranceAsset, "image"> & { file: string; width: number; height: number }
>;
function fixture(id: (typeof added)[number]) {
  const a = manifest[id];
  return {
    image: {} as HTMLImageElement,
    cellWidth: 512,
    cellHeight: 512,
    bodyHeight: 430,
    baseline: 480,
    portraitCenters: Array(8).fill(256),
    frameFacing: Array(8).fill(1),
    battleFrame: 0,
    frames: Array.from({ length: 8 }, () => ({
      x: 0,
      y: 0,
      width: 240,
      height: 430,
      slotX: 0,
      slotY: 0,
    })),
    entrance: {
      ...a,
      image: { width: a.width, height: a.height } as HTMLImageElement,
    },
  } as SpriteAsset;
}
function recording() {
  const calls: unknown[][] = [];
  const ctx = new Proxy(
    {
      globalAlpha: 1,
      drawImage(...args: unknown[]) {
        calls.push(args);
      },
    },
    { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
test("every built-in fighter has a complete painted entrance registered for selection and versus", () => {
  const expected = FIGHTERS.map((f) => f.id).sort();
  assert.deepEqual(Object.keys(entrances).sort(), expected);
  assert.deepEqual(Object.keys(ENTRANCE_ACTIONS).sort(), expected);
  for (const f of FIGHTERS) {
    const a = manifest[f.id];
    for (const frame of ENTRANCE_ACTIONS[f.id]!.frames)
      assert.ok(a.frames[frame.frame], f.id);
    assert.ok(presentationById(f.id).durationMs <= 3000, f.id);
  }
});
test("new entrance crops retain real transparency, native detail and lossless transfer", async () => {
  for (const id of added) {
    const a = manifest[id],
      bytes = await fs.readFile(`public/assets/${a.file}.webp`);
    assert.ok(bytes.includes(Buffer.from("VP8L")), `${id}: lossless WebP`);
    assert.ok(
      bytes.length < 3 * 1024 * 1024,
      `${id}: only the selected entrance is fetched`,
    );
    const image = sharp(bytes),
      meta = await image.metadata();
    assert.equal(meta.width, a.width, id);
    assert.equal(meta.height, a.height, id);
    assert.ok(meta.hasAlpha, id);
    assert.ok(meta.width! <= 2048 && meta.height! <= 2048, id);
    for (const frame of a.frames) {
      assert.ok(
        frame.x >= 0 &&
          frame.y >= 0 &&
          frame.x + frame.width <= meta.width! &&
          frame.y + frame.height <= meta.height!,
        id,
      );
      assert.ok(
        frame.width >= 100 && frame.height >= 300,
        `${id}: detailed full-body pose`,
      );
      const stats = await image
        .clone()
        .extract({
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        })
        .stats();
      assert.ok(stats.channels[3].max > 200, id);
      assert.equal(stats.channels[3].min, 0, `${id}: transparent margin`);
    }
  }
  assert.equal(
    manifest.dayana.file,
    attacks.dayana.file,
    "the reviewed gown art is reused without a duplicate download",
  );
  assert.equal(manifest.dayana.frames.length, 8);
});
test("painted entrances play on either side, release once, and reduced motion uses the combat stance", () => {
  for (const id of added)
    for (const facing of [-1, 1]) {
      const sprite = fixture(id);
      for (const p of [0, 0.08, 0.2, 0.35, 0.5, 0.72, 0.85, 0.9, 1, 2]) {
        const { ctx, calls } = recording();
        assert.equal(
          drawEntranceAction(ctx, sprite, id, p, 375, facing),
          true,
          id,
        );
        assert.ok(calls.length >= 1 && calls.length <= 2, id);
        if (p >= 0.9)
          assert.equal(
            calls[0][0],
            sprite.image,
            `${id}: returned to combat guard`,
          );
        for (const args of calls)
          assert.ok(
            args
              .slice(1)
              .every((n) => typeof n === "number" && Number.isFinite(n)),
            id,
          );
      }
      const { ctx, calls } = recording();
      drawPresentation(
        ctx,
        sprite,
        id,
        0.5,
        200,
        491,
        375,
        facing,
        "selection",
        true,
      );
      assert.equal(calls.length, 1, id);
      assert.equal(calls[0][0], sprite.image, id);
    }
});
test("a missing crop or football declines before painting a partial entrance", () => {
  for (const id of ["dayana", "deyna", "lorenzo"] as const) {
    const sprite = fixture(id);
    sprite.entrance!.frames = sprite.entrance!.frames.slice(0, 1);
    const ctx = new Proxy(
      {},
      {
        get() {
          throw Error("partial entrance paint");
        },
      },
    ) as CanvasRenderingContext2D;
    assert.equal(drawEntranceAction(ctx, sprite, id, 0.5, 375, 1), false);
  }
  const sprite = fixture("deyna");
  delete sprite.entrance!.ball;
  const { ctx, calls } = recording();
  assert.equal(drawEntranceAction(ctx, sprite, "deyna", 0.4, 375, 1), false);
  assert.equal(calls.length, 0);
});
test("Dayana makes one turn, holds distinct runway poses and never inherits the football", () => {
  const action = ENTRANCE_ACTIONS.dayana!;
  assert.equal(action.turns, 1);
  assert.equal(action.ball, undefined);
  assert.equal(
    action.frames.filter((f) => f.frame === 3).length,
    1,
    "the back view occurs once",
  );
  assert.equal(
    new Set(action.frames.filter((f) => f.phase === "pose").map((f) => f.frame))
      .size,
    3,
  );
  for (const p of [0, 0.1, 0.5, 0.9, 1, 100])
    assert.equal(sampleEntranceBall("dayana", p), null);
});
test("Deyna's single painted football follows finite instep contacts and remains visible in the full-body versus shot", () => {
  const action = ENTRANCE_ACTIONS.deyna!,
    a = manifest.deyna;
  assert.ok(a.ball);
  assert.ok(a.fullBody);
  for (const contact of action.ball!) {
    const p = sampleEntranceBall("deyna", contact.at)!;
    assert.equal(p.x, contact.x);
    assert.equal(p.y, contact.y);
  }
  for (let i = 3; i < 90; i++) {
    const p = sampleEntranceBall("deyna", i / 100)!;
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(p.alpha >= 0 && p.alpha <= 1);
    const { ctx, calls } = recording();
    drawEntranceAction(ctx, fixture("deyna"), "deyna", i / 100, 375, 1);
    assert.equal(calls.length, 2);
  }
  for (const p of [-1, 0, 0.9, 1, 10])
    assert.equal(sampleEntranceBall("deyna", p), null);
  for (const id of ["dayana", "deyna"] as const)
    for (const side of [0, 1] as const) {
      const camera = introCamera(fixture(id), 0, side, 100, false, id);
      assert.ok(camera.feet <= 600);
      assert.ok(camera.feet - camera.height >= 80);
      assert.ok(camera.height >= 400);
    }
  assert.equal(sampleEntranceAction("deyna", 1), null);
});

test("one stable selection scale keeps every new silhouette inside its portrait for both facings", () => {
  for (const id of added) {
    const sprite = fixture(id),
      height = selectionBodyHeight(sprite);
    assert.ok(height > 150 && height <= 375, id);
    for (const frame of sprite.entrance!.frames) {
      const body = frame.bodyHeight ?? sprite.entrance!.bodyHeight;
      const anchor =
        frame.anchorX ?? sprite.entrance!.anchorX - frame.x + frame.slotX;
      for (const facing of [-1, 1]) {
        const a = 200 - (facing * anchor * height) / body;
        const b = a + (facing * frame.width * height) / body;
        assert.ok(Math.min(a, b) >= 15.99, `${id}: left silhouette margin`);
        assert.ok(Math.max(a, b) <= 384.01, `${id}: right silhouette margin`);
      }
    }
  }
});
