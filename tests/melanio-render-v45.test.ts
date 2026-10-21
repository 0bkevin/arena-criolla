import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type MatchState,
  type PlayerConfig,
} from "./helpers/charged-finale-engine";
import { TECHNIQUES } from "../shared/techniques";
import { renderMatch, type Assets } from "../src/game/renderer";
import type { SpriteAsset } from "../src/game/assets";
import { drawPresentation } from "../src/game/presentation-renderer";
import entrances from "../shared/entrance-assets.json";
import { sampleEntranceAction } from "../shared/entrance-actions";
import { sampleGesture } from "../shared/choreography";

function setup(melanioSide: 0 | 1 = 0) {
  const melanio = { name: "Melanio", fighter: "melanio" as const, wins: 3 };
  const rival = { name: "Rival", fighter: "javier" as const, wins: 0 };
  const configs: [PlayerConfig, PlayerConfig] =
    melanioSide === 0 ? [melanio, rival] : [rival, melanio];
  const state = createMatch("caracas", configs);
  state.phase = "playing";
  for (const player of state.players) {
    player.y = 554;
    player.grounded = true;
    player.invincible = 0;
    player.stun = 0;
    const isMelanio = player.config.fighter === "melanio";
    player.x = isMelanio
      ? melanioSide === 0
        ? 360
        : 840
      : melanioSide === 0
        ? 840
        : 360;
    player.facing = isMelanio
      ? melanioSide === 0
        ? 1
        : -1
      : melanioSide === 0
        ? -1
        : 1;
  }
  state.players[melanioSide].energy = 100;
  return state;
}

function spriteAsset(): {
  sprite: SpriteAsset;
  frameByTexture: Map<object, number>;
} {
  const textures = Array.from({ length: 8 }, () => ({}));
  const frameByTexture = new Map<object, number>(
    textures.map((texture, frame) => [texture, frame]),
  );
  return {
    sprite: {
      image: {} as HTMLImageElement,
      frameTextures: textures as unknown as (HTMLCanvasElement | undefined)[],
      cellWidth: 512,
      cellHeight: 512,
      baseline: 500,
      bodyHeight: 177,
      portraitCenters: Array(8).fill(256),
      frameFacing: Array(8).fill(1),
      battleFrame: 0,
      frames: Array.from({ length: 8 }, (_, frame) => ({
        x: (frame % 4) * 512,
        y: Math.floor(frame / 4) * 512,
        width: 430,
        height: 450,
        slotX: (frame % 4) * 512,
        slotY: Math.floor(frame / 4) * 512,
      })),
    },
    frameByTexture,
  };
}

function renderMelanioFrame(state: MatchState): number {
  const melanio = spriteAsset();
  const rival = spriteAsset();
  const gradient = { addColorStop() {} };
  let frame: number | undefined;
  const context = new Proxy(
    {
      canvas: { width: 1200, height: 800 },
      createLinearGradient: () => gradient,
      drawImage: (image: CanvasImageSource) => {
        const candidate = melanio.frameByTexture.get(image as object);
        if (candidate !== undefined) frame = candidate;
      },
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
  const assets = {
    sprites: { melanio: melanio.sprite, javier: rival.sprite },
    stages: { caracas: {} as HTMLImageElement },
  } as unknown as Assets;
  renderMatch(context, state, assets, state.tick * (1000 / 60));
  assert.notEqual(frame, undefined, "renderMatch must draw Melanio's sprite");
  return frame!;
}

test("Melanio combat states select the matching real atlas pose", () => {
  const state = setup();
  const p = state.players[0];

  p.vx = 2;
  state.tick = 0;
  assert.equal(renderMelanioFrame(state), 2, "first run contact pose");
  state.tick = 7;
  assert.equal(renderMelanioFrame(state), 3, "opposite run contact pose");
  p.vx = -2;
  p.facing = -1;
  state.tick = 0;
  assert.equal(
    renderMelanioFrame(state),
    2,
    "left-facing run keeps source pose",
  );

  p.vx = 0;
  p.facing = 1;
  p.grounded = false;
  assert.equal(
    renderMelanioFrame(state),
    4,
    "airborne state selects tucked jump",
  );
  p.grounded = true;
  p.blocking = true;
  assert.equal(renderMelanioFrame(state), 1, "block selects forearm guard");
  p.blocking = false;
  p.stun = 2;
  assert.equal(renderMelanioFrame(state), 7, "hurt selects recoil pose");
  p.stun = 0;

  p.attack = "light";
  p.attackTick = 3;
  assert.equal(renderMelanioFrame(state), 1, "light windup protects the face");
  p.attackTick = 5;
  assert.equal(
    renderMelanioFrame(state),
    5,
    "light release selects straight punch",
  );
  p.attack = "heavy";
  p.attackTick = 5;
  assert.equal(renderMelanioFrame(state), 0, "heavy windup holds ready guard");
  p.attackTick = 6;
  assert.equal(renderMelanioFrame(state), 6, "heavy release selects high kick");

  p.attack = "super";
  p.attackTick = 3;
  assert.equal(renderMelanioFrame(state), 1, "super startup selects guard");
  p.attackTick = 5;
  assert.equal(
    renderMelanioFrame(state),
    5,
    "super release selects punch pose",
  );
  p.attack = null;
  p.dash = 8;
  p.vx = 2;
  assert.equal(
    renderMelanioFrame(state),
    2,
    "dash trail and fighter use the run pose",
  );
});

test("Melanio's painted entrance folds his arms once, uses one complete body and settles into guard", () => {
  const sprite = spriteAsset().sprite;
  const bitmap = {
    width: entrances.melanio.width,
    height: entrances.melanio.height,
  } as HTMLImageElement;
  sprite.entrance = { ...entrances.melanio, image: bitmap };
  for (const kind of ["intro", "selection"] as const)
    for (const facing of [-1, 1]) {
      const visited = new Set<number>();
      for (const progress of [0.04, 0.12, 0.26, 0.34, 0.44, 0.6, 0.82]) {
        const calls: unknown[][] = [];
        const ctx = new Proxy(
          {
            globalAlpha: 1,
            drawImage(...args: unknown[]) {
              calls.push(args);
            },
          },
          { get: (t, k) => Reflect.get(t, k) ?? (() => {}) },
        ) as unknown as CanvasRenderingContext2D;
        drawPresentation(
          ctx,
          sprite,
          "melanio",
          progress,
          0,
          0,
          375,
          facing,
          kind,
        );
        assert.equal(
          calls.length,
          1,
          "one painted body, without a second deformed face or arm",
        );
        assert.equal(calls[0][0], bitmap);
        const frame = sampleEntranceAction("melanio", progress)!.current.frame;
        visited.add(frame);
        const crop = entrances.melanio.frames[frame];
        assert.deepEqual(calls[0].slice(1, 5), [
          crop.x,
          crop.y,
          crop.width,
          crop.height,
        ]);
      }
      assert.equal(
        visited.size,
        6,
        "all six distinct painted poses are reachable",
      );
    }
  assert.equal(sampleEntranceAction("melanio", 0.6)!.current.phase, "hold");
  for (const progress of [0.9, 1, 2])
    assert.equal(sampleEntranceAction("melanio", progress), null);
  assert.deepEqual(
    sampleGesture("melanio", 1, true),
    sampleGesture("melanio", 2, true),
  );
});

test("Melanio signal windup, release and recovery render correctly from either player side", () => {
  for (const side of [0, 1] as const) {
    const state = setup(side);
    const input = [emptyInput(), emptyInput()] as [
      ReturnType<typeof emptyInput>,
      ReturnType<typeof emptyInput>,
    ];
    input[side].actions.special++;
    stepMatch(state, input);
    const p = state.players[side];
    assert.equal(p.attack, "special");
    assert.equal(p.attackTick, 1);

    for (let tick = 1; tick < TECHNIQUES.signal.startup - 1; tick++)
      stepMatch(state, input);
    assert.equal(p.attackTick, 20);
    assert.equal(
      renderMelanioFrame(state),
      1,
      `side ${side}: last windup frame remains guarded`,
    );

    stepMatch(state, input);
    assert.equal(p.attackTick, 21);
    assert.equal(
      state.projectiles.length,
      1,
      `side ${side}: release creates one signal pulse`,
    );
    assert.equal(
      renderMelanioFrame(state),
      5,
      `side ${side}: release uses the punch extension`,
    );

    for (let tick = 0; tick < 8; tick++) stepMatch(state, input);
    assert.equal(p.attackTick, 29);
    assert.equal(
      renderMelanioFrame(state),
      0,
      `side ${side}: recovery settles to ready guard`,
    );
    p.grounded = false;
    assert.equal(
      renderMelanioFrame(state),
      4,
      `side ${side}: airborne recovery keeps the tucked jump`,
    );
    p.grounded = true;
    p.vx = p.facing * 2;
    assert.equal(
      renderMelanioFrame(state),
      2,
      `side ${side}: recovery follows ongoing run movement`,
    );
    p.stun = 2;
    assert.equal(
      renderMelanioFrame(state),
      7,
      `side ${side}: hurt recoil overrides the release pose`,
    );
  }
});
