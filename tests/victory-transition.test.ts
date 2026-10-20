import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../shared/engine";
import atlas from "../shared/sprite-geometry.json";
import entrances from "../shared/entrance-assets.json";
import { presentationById } from "../shared/presentation";
import { ATTACK_ART } from "../src/game/attack-art";
import type { SpriteAsset } from "../src/game/assets";
import type { Assets } from "../src/game/renderer";
import { playVictoryTransition } from "../src/game/victory-transition";

type Matrix = [number, number, number, number, number, number];
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];

function recordingCanvas() {
  let matrix = identity();
  const stack: Matrix[] = [];
  const draws: { image: CanvasImageSource; crop: number[]; matrix: Matrix }[] =
    [];
  const clears: { rect: number[]; matrix: Matrix }[] = [];
  const transform = (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => {
    const [aa, bb, cc, dd, ee, ff] = matrix;
    matrix = [
      aa * a + cc * b,
      bb * a + dd * b,
      aa * c + cc * d,
      bb * c + dd * d,
      aa * e + cc * f + ee,
      bb * e + dd * f + ff,
    ];
  };
  const methods = {
    globalAlpha: 1,
    save: () => stack.push([...matrix]),
    restore: () => {
      matrix = stack.pop()!;
    },
    resetTransform: () => {
      matrix = identity();
    },
    setTransform: (...next: Matrix) => {
      matrix = next;
    },
    transform,
    translate: (x: number, y: number) => transform(1, 0, 0, 1, x, y),
    scale: (x: number, y: number) => transform(x, 0, 0, y, 0, 0),
    rotate: (angle: number) =>
      transform(
        Math.cos(angle),
        Math.sin(angle),
        -Math.sin(angle),
        Math.cos(angle),
        0,
        0,
      ),
    clearRect: (...rect: number[]) =>
      clears.push({ rect, matrix: [...matrix] }),
    drawImage: (image: CanvasImageSource, ...crop: number[]) =>
      draws.push({ image, crop, matrix: [...matrix] }),
  };
  const ctx = new Proxy(methods, {
    get(target, key) {
      return key in target ? Reflect.get(target, key) : () => {};
    },
  }) as unknown as CanvasRenderingContext2D;
  const canvas = { width: 400, height: 500, getContext: () => ctx };
  return { canvas, draws, clears, matrix: () => matrix };
}

class RecordedAnimation {
  cancelled = false;
  finishes = 0;
  private resolve!: () => void;
  private reject!: () => void;
  finished = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
  cancel() {
    this.cancelled = true;
    this.reject();
  }
  finish() {
    this.finishes++;
    this.resolve();
  }
}

function fixture(painted = true) {
  const animations: RecordedAnimation[] = [];
  const carry = recordingCanvas();
  const textures: ReturnType<typeof recordingCanvas>[] = [];
  const events = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const element = (
    children: Record<string, unknown> = {},
    extra: Record<string, unknown> = {},
  ) => ({
    querySelector: (selector: string) => children[selector] ?? null,
    getBoundingClientRect: () => ({
      left: 100,
      top: 80,
      width: 400,
      height: 500,
    }),
    animate: () => {
      const animation = new RecordedAnimation();
      animations.push(animation);
      return animation;
    },
    ...extra,
  });
  const figure = element({ ".portrait": element() });
  const screen = element(
    {
      ".victory-screen-scenery": element(),
      ".victory-screen-slash": element(),
      ".victory-screen-title": element({ span: element(), strong: element() }),
      ".victory-screen-figure": figure,
      ".victory-screen-carry": element({}, carry.canvas),
    },
    { querySelectorAll: () => [element()] },
  ) as unknown as HTMLElement;
  const arena = element(
    {},
    { width: 1440, height: 800 },
  ) as unknown as HTMLCanvasElement;
  const announcement = element({
    span: element(),
    strong: element(),
  }) as unknown as HTMLElement;
  const image = {
    width: 4096,
    height: 4096,
    complete: true,
  } as HTMLImageElement;
  const paintedImage = {
    width: 4096,
    height: 4096,
    complete: true,
  } as HTMLImageElement;
  const file = atlas.sprites.find((entry) => entry.id === "kevin")!.files[0];
  const profile = presentationById("kevin");
  const sprite: SpriteAsset = {
    image,
    cellWidth: file.width / 4,
    cellHeight: file.height / 2,
    baseline: file.components[0].maxY + 1,
    bodyHeight: file.components[0].maxY - file.components[0].minY,
    frames: file.components.map((frame, index) => ({
      x: frame.minX,
      y: frame.minY,
      width: frame.maxX - frame.minX + 1,
      height: frame.maxY - frame.minY + 1,
      slotX: ((index % 4) * file.width) / 4,
      slotY: (Math.floor(index / 4) * file.height) / 2,
    })),
    portraitCenters: file.components.map(() => file.width / 8),
    frameFacing: profile.frameFacing,
    battleFrame: profile.battleFrame,
    entrance: { ...entrances.kevin, image },
  };
  const assets = {
    sprites: { kevin: sprite },
    stages: {},
    finaleProps: painted ? { [ATTACK_ART.kevin.file]: paintedImage } : {},
  } as Assets;
  const globals = {
    window: events,
    matchMedia: () => reduced,
    getComputedStyle: () => ({ opacity: "0.9" }),
    document: {
      createElement: () => {
        const texture = recordingCanvas();
        textures.push(texture);
        return texture.canvas;
      },
    },
  };
  const originals = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  let completions = 0;
  const start = (side: 0 | 1 = 0) => {
    const state = createMatch("caracas", [
      { name: "Coco", fighter: "kevin", wins: 3 },
      { name: "Coco rival", fighter: "kevin", wins: 3 },
    ]);
    state.phase = "finished";
    state.winner = side;
    return playVictoryTransition(
      screen,
      arena,
      announcement,
      state,
      assets,
      () => completions++,
    );
  };
  const restore = () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
  return {
    start,
    restore,
    carry,
    textures,
    image,
    paintedImage,
    animations,
    events,
    reduced,
    completions: () => completions,
  };
}

test("the transition carries Coco's painted celebration on either winning side", () => {
  const f = fixture();
  try {
    for (const side of [0, 1] as const) {
      const clean = f.start(side);
      const draw = f.carry.draws.at(-1)!;
      const crop = ATTACK_ART.kevin.frames.celebrate;
      assert.equal(draw.image, f.paintedImage);
      assert.deepEqual(draw.crop.slice(0, 4), [
        crop.x,
        crop.y,
        crop.width,
        crop.height,
      ]);
      assert.equal(Math.sign(draw.matrix[0]), side === 0 ? 1 : -1);
      clean();
    }
  } finally {
    f.restore();
  }
});

test("missing celebration artwork retains the sprite fallback through the transition", () => {
  const f = fixture(false);
  try {
    const clean = f.start();
    assert.ok(
      f.textures.some((texture) =>
        texture.draws.some((draw) => draw.image === f.image),
      ),
    );
    assert.ok(f.carry.draws.length > 0);
    assert.ok(f.carry.draws.every((draw) => draw.image !== f.paintedImage));
    clean();
  } finally {
    f.restore();
  }
});

test("effect replay clears the previous carry painting and never accumulates transforms", () => {
  const f = fixture();
  try {
    f.start()();
    const first = f.carry.draws.at(-1);
    const clean = f.start();
    assert.deepEqual(f.carry.draws.at(-1), first);
    assert.deepEqual(f.carry.matrix(), identity());
    assert.equal(f.carry.clears.length, 2);
    assert.ok(
      f.carry.clears.every(
        (clear) =>
          JSON.stringify(clear.matrix) === JSON.stringify(identity()) &&
          JSON.stringify(clear.rect) === JSON.stringify([0, 0, 400, 500]),
      ),
    );
    clean();
  } finally {
    f.restore();
  }
});

test("unmount cancels the transition without activating a discarded result", async () => {
  const f = fixture();
  try {
    const clean = f.start();
    clean();
    f.events.dispatchEvent(new Event("resize"));
    f.reduced.dispatchEvent(new Event("change"));
    await Promise.resolve();
    assert.equal(f.completions(), 0);
    assert.ok(
      f.animations.every(
        (animation) => animation.cancelled && animation.finishes === 0,
      ),
    );
  } finally {
    f.restore();
  }
});

test("resizing settles the result once and releases every animation", async () => {
  const f = fixture();
  try {
    const clean = f.start();
    f.events.dispatchEvent(new Event("resize"));
    f.events.dispatchEvent(new Event("resize"));
    f.reduced.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(f.completions(), 1);
    assert.ok(
      f.animations.every(
        (animation) => animation.cancelled && animation.finishes === 1,
      ),
    );
    clean();
  } finally {
    f.restore();
  }
});
