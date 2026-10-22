import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTACK_ART,
  drawAttackArt,
  hasAttackArt,
  type AttackArtFrame,
  type AttackArtSheet,
} from "../src/game/attack-art";

const frame: AttackArtFrame = {
  x: 32,
  y: 16,
  width: 96,
  height: 160,
  anchorX: 24,
  anchorY: 150,
  bodyHeight: 140,
};
const loaded = {
  width: 256,
  height: 256,
  naturalWidth: 256,
  naturalHeight: 256,
  complete: true,
} as HTMLImageElement;

function withSheet(run: (sheet: AttackArtSheet) => void) {
  const previous = ATTACK_ART.capriles;
  const sheet = {
    file: "validation-fixture",
    frames: { ready: { ...frame }, exit: { ...frame, x: 160 } },
  };
  ATTACK_ART.capriles = sheet;
  try {
    run(sheet);
  } finally {
    if (previous) ATTACK_ART.capriles = previous;
    else delete ATTACK_ART.capriles;
  }
}

function rejectWithoutPainting(
  images: Record<string, HTMLImageElement>,
  pose = "ready",
) {
  assert.equal(hasAttackArt(images, "capriles", [pose]), false);
  const forbidden = () => {
    throw Error("Unavailable or malformed artwork must not touch canvas state");
  };
  const context = new Proxy(
    {},
    { get: forbidden, set: forbidden },
  ) as CanvasRenderingContext2D;
  assert.equal(
    drawAttackArt(context, images, "capriles", pose, 100, 555, 70),
    false,
  );
}

test("complete-scene preflight checks every requested pose against intrinsic loaded dimensions", () => {
  withSheet((sheet) => {
    const images = { [sheet.file]: loaded };
    assert.equal(hasAttackArt(images, "capriles", ["ready", "exit"]), true);
    assert.equal(hasAttackArt(images, "capriles", ["ready", "absent"]), false);
    assert.equal(hasAttackArt(images, "capriles", []), false);
    assert.equal(hasAttackArt(images, "capriles", Array<string>(1)), false);
    // CSS/layout dimensions do not change the bitmap's source-coordinate space.
    assert.equal(
      hasAttackArt(
        {
          [sheet.file]: { ...loaded, width: 0, height: 0 } as HTMLImageElement,
        },
        "capriles",
        ["ready", "exit"],
      ),
      true,
    );
    sheet.frames.exit.width = 97;
    assert.equal(hasAttackArt(images, "capriles", ["ready", "exit"]), false);
    assert.equal(hasAttackArt(images, "capriles", ["ready"]), true);
    delete ATTACK_ART.capriles;
    rejectWithoutPainting(images);
  });
});

test("missing, unloaded, incomplete and intrinsically undersized images draw nothing", () => {
  withSheet((sheet) => {
    rejectWithoutPainting({});
    rejectWithoutPainting({ [sheet.file]: loaded }, "absent");
    for (const image of [
      { width: 0, height: 256 },
      { width: 256, height: 0 },
      { ...loaded, naturalWidth: 0, naturalHeight: 0 },
      { ...loaded, complete: false },
      {
        ...loaded,
        width: 9999,
        height: 9999,
        naturalWidth: 64,
        naturalHeight: 64,
      },
      { width: NaN, height: 256 },
      { width: 256, height: Infinity },
    ])
      rejectWithoutPainting({ [sheet.file]: image as HTMLImageElement });
  });
});

test("nonfinite, nonpositive and out-of-bounds frame geometry never touches canvas", () => {
  withSheet((sheet) => {
    const images = { [sheet.file]: loaded };
    const invalid: Partial<AttackArtFrame>[] = [
      { x: -1 },
      { y: -1 },
      { width: 0 },
      { height: 0 },
      { x: 200 },
      { y: 150 },
      { anchorX: -1 },
      { anchorX: 97 },
      { anchorY: -1 },
      { anchorY: 161 },
      { bodyHeight: 0 },
      { bodyHeight: -1 },
      { bodyHeight: 161 },
    ];
    for (const field of [
      "x",
      "y",
      "width",
      "height",
      "anchorX",
      "anchorY",
      "bodyHeight",
    ])
      for (const value of [NaN, Infinity, -Infinity, null, "32"])
        invalid.push({ [field]: value });
    for (const patch of invalid) {
      sheet.frames.ready = { ...frame, ...patch };
      rejectWithoutPainting(images);
    }
  });
});
