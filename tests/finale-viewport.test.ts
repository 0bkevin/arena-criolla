import test from "node:test";
import assert from "node:assert/strict";
import {
  clampFinaleArtX,
  finaleArtXRange,
  finaleViewportBounds,
} from "../src/game/finale-viewport";
import {
  ATTACK_ART,
  drawAttackArt,
  type AttackArtFrame,
} from "../src/game/attack-art";

function context(
  width: number,
  height: number,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
) {
  return {
    canvas: { width, height },
    getTransform: () => matrix,
  } as unknown as CanvasRenderingContext2D;
}

test("viewport bounds reverse the complete camera transform and backing-pixel scale", () => {
  const ordinary = finaleViewportBounds(
    context(1500, 900, {
      a: 1.5,
      b: 0,
      c: 0,
      d: 1.5,
      e: -150,
      f: -75,
    }),
  );
  const highDensity = finaleViewportBounds(
    context(3000, 1800, {
      a: 3,
      b: 0,
      c: 0,
      d: 3,
      e: -300,
      f: -150,
    }),
  );
  assert.deepEqual(ordinary, { left: 100, top: 50, right: 1100, bottom: 650 });
  assert.deepEqual(
    highDensity,
    ordinary,
    "DPR changes no local visible bounds",
  );
});

test("viewport edges remain ordered when the arena is mirrored", () => {
  assert.deepEqual(
    finaleViewportBounds(
      context(1600, 900, {
        a: -2,
        b: 0,
        c: 0,
        d: 2,
        e: 1200,
        f: -60,
      }),
    ),
    { left: -200, top: 30, right: 600, bottom: 480 },
  );
});

const frame: AttackArtFrame = {
  x: 20,
  y: 20,
  width: 300,
  height: 500,
  anchorX: 100,
  anchorY: 450,
  bodyHeight: 400,
};
const viewport = { left: 20, top: 0, right: 500, bottom: 640 };

test("full-pose anchor intervals preserve body scale and asymmetric anchors on both facings", () => {
  assert.deepEqual(finaleArtXRange(viewport, frame, 200, 1), {
    minX: 78,
    maxX: 392,
    fits: true,
  });
  assert.deepEqual(finaleArtXRange(viewport, frame, 200, -1), {
    minX: 128,
    maxX: 442,
    fits: true,
  });
  assert.equal(clampFinaleArtX(viewport, frame, 200, 1, 0), 78);
  assert.equal(clampFinaleArtX(viewport, frame, 200, 1, 700), 392);
  assert.equal(clampFinaleArtX(viewport, frame, 200, -1, 0), 128);
  assert.equal(clampFinaleArtX(viewport, frame, 200, -1, 700), 442);
  assert.equal(clampFinaleArtX(viewport, frame, 200, 1, 250), 250);
  assert.equal(
    frame.width * (200 / frame.bodyHeight!),
    150,
    "the painted width stays unchanged",
  );
});

test("a pose wider than the viewport reports an impossible interval without shrinking it", () => {
  const wide = { ...frame, width: 1000, anchorX: 500, bodyHeight: 100 };
  const small = { left: 0, top: 0, right: 300, bottom: 640 };
  assert.deepEqual(finaleArtXRange(small, wide, 200), {
    minX: 1008,
    maxX: -708,
    fits: false,
  });
  assert.equal(clampFinaleArtX(small, wide, 200, 1, 40), 150);
});

test("published showgirl art stays fully visible at either ledge under real arena scale and DPR", () => {
  const sheet = ATTACK_ART.renny,
    painted = sheet.frames.present;
  for (const direction of [-1, 1])
    for (const dpr of [1, 2]) {
      // Normal camera/arena transforms for a 120-world-unit capture at a ledge.
      let matrix = {
        a: direction * 0.8496 * dpr,
        b: 0,
        c: 0,
        d: 0.8496 * dpr,
        e: (direction === 1 ? 756.576 : 683.424) * dpr,
        f: 249.6064 * dpr,
      };
      const rectangles: { left: number; right: number; width: number }[] = [];
      const stack: { matrix: typeof matrix; alpha: number }[] = [];
      const ctx = {
        canvas: { width: 1440 * dpr, height: 800 * dpr },
        globalAlpha: 1,
        getTransform: () => matrix,
        save() {
          stack.push({ matrix: { ...matrix }, alpha: ctx.globalAlpha });
        },
        restore() {
          const saved = stack.pop()!;
          matrix = saved.matrix;
          ctx.globalAlpha = saved.alpha;
        },
        translate(x: number, y: number) {
          matrix.e += matrix.a * x + matrix.c * y;
          matrix.f += matrix.b * x + matrix.d * y;
        },
        scale(x: number, y: number) {
          matrix.a *= x;
          matrix.b *= x;
          matrix.c *= y;
          matrix.d *= y;
        },
        drawImage(
          _image: unknown,
          _sx: number,
          _sy: number,
          _sw: number,
          _sh: number,
          x: number,
          y: number,
          width: number,
        ) {
          const start = matrix.a * x + matrix.c * y + matrix.e,
            end = matrix.a * (x + width) + matrix.c * y + matrix.e;
          rectangles.push({
            left: Math.min(start, end),
            right: Math.max(start, end),
            width,
          });
        },
      } as unknown as CanvasRenderingContext2D;
      const bounds = finaleViewportBounds(ctx),
        desired = 806.7,
        bounded = clampFinaleArtX(bounds, painted, 388, -1, desired);
      const images = {
        [sheet.file]: { width: 1024, height: 1024 } as HTMLImageElement,
      };
      drawAttackArt(ctx, images, "renny", "present", desired, 516, 388, -1);
      drawAttackArt(ctx, images, "renny", "present", bounded, 516, 388, -1);
      assert.ok(
        rectangles[0].left < 0 || rectangles[0].right > 1440 * dpr,
        "the old desired position clips the published art",
      );
      assert.ok(
        rectangles[1].left >= 0 && rectangles[1].right <= 1440 * dpr,
        "translation retains the full painted frame",
      );
      assert.equal(
        rectangles[1].width,
        rectangles[0].width,
        "containment preserves body scale",
      );
    }
});

test("missing, invalid and noninvertible canvas transforms leave mock positions unchanged", () => {
  const unavailable = [
    {} as CanvasRenderingContext2D,
    { canvas: { width: 1440, height: 800 } } as CanvasRenderingContext2D,
    context(0, 800, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    context(1440, 800, { a: 0, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    context(1440, 800, { a: NaN, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  ];
  for (const ctx of unavailable) {
    const bounds = finaleViewportBounds(ctx);
    assert.equal(bounds, undefined);
    assert.deepEqual(finaleArtXRange(bounds, frame, 200), {
      minX: -Infinity,
      maxX: Infinity,
      fits: true,
    });
    assert.equal(clampFinaleArtX(bounds, frame, 200, 1, -500), -500);
    assert.equal(clampFinaleArtX(bounds, frame, 200, -1, 1700), 1700);
  }
});
