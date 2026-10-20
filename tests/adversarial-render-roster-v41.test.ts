import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";
import { renderMatch, type Assets } from "../src/game/renderer";
import type { SpriteAsset } from "../src/game/assets";

function fakeSprite() {
  const textures = Array.from({ length: 8 }, (_, frame) => ({ frame }));
  const sprite: SpriteAsset = {
    image: {} as HTMLImageElement,
    frameTextures: textures as unknown as (HTMLCanvasElement | undefined)[],
    cellWidth: 400,
    cellHeight: 400,
    baseline: 390,
    bodyHeight: 177,
    portraitCenters: Array(8).fill(200),
    frameFacing: Array(8).fill(1),
    battleFrame: 0,
    frames: Array.from({ length: 8 }, (_, frame) => ({
      x: (frame % 4) * 400,
      y: Math.floor(frame / 4) * 400,
      width: 250,
      height: 350,
      slotX: (frame % 4) * 400,
      slotY: Math.floor(frame / 4) * 400,
    })),
  };
  return { sprite, textures };
}

function startBolivarSpecial(attackerIndex: 0 | 1) {
  const state = createMatch("caracas", [
    {
      name: "P1",
      fighter: attackerIndex === 0 ? "bolivar" : "zavarce",
      wins: 0,
    },
    {
      name: "P2",
      fighter: attackerIndex === 1 ? "bolivar" : "zavarce",
      wins: 0,
    },
  ]);
  state.phase = "playing";
  state.players.forEach((player) => {
    player.invincible = 0;
    player.y = 554;
    player.grounded = true;
  });
  const bolivar = state.players[attackerIndex];
  const rival = state.players[1 - attackerIndex];
  bolivar.x = attackerIndex === 0 ? 360 : 840;
  rival.x = attackerIndex === 0 ? 840 : 360;
  bolivar.facing = attackerIndex === 0 ? 1 : -1;
  rival.facing = -bolivar.facing;
  bolivar.energy = 50;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[attackerIndex].actions.special++;
  stepMatch(state, inputs);
  return { state, inputs, bolivar };
}

function renderedFrame(state: MatchState, attackerIndex: 0 | 1): number {
  const bolivarAsset = fakeSprite();
  const rivalAsset = fakeSprite();
  const frameByTexture = new Map<object, number>(
    bolivarAsset.textures.map((texture, frame) => [texture, frame]),
  );
  let frame: number | undefined;
  const gradient = { addColorStop() {} };
  const context = new Proxy(
    {
      canvas: { width: 1200, height: 800 },
      createLinearGradient: () => gradient,
      drawImage: (image: CanvasImageSource) => {
        const candidate = frameByTexture.get(image as unknown as object);
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
    sprites: {
      bolivar: bolivarAsset.sprite,
      zavarce: rivalAsset.sprite,
    },
    stages: { caracas: {} as HTMLImageElement },
  } as unknown as Assets;
  renderMatch(context, state, assets, state.tick * (1000 / 60));
  assert.notEqual(
    frame,
    undefined,
    "Bolívar must be drawn from a frame texture",
  );
  return frame!;
}

test("Bolívar's sabre fallback preserves canonical guard, recovery and stun in both directions", () => {
  for (const attackerIndex of [0, 1] as const) {
    const { state, inputs, bolivar } = startBolivarSpecial(attackerIndex);
    assert.equal(bolivar.attack, "special");
    assert.equal(bolivar.dash, 0, "special should begin in startup");
    const startupFrame = renderedFrame(state, attackerIndex);

    for (let tick = 0; tick < 38; tick++) {
      stepMatch(state, inputs);
      assert.equal(bolivar.dash, 0, "sabre does not create the retired dash");
      assert.equal(
        renderedFrame(state, attackerIndex),
        0,
        "missing attack atlas keeps canonical guard",
      );
    }
    assert.equal(startupFrame, 0, "startup fallback holds ready guard");

    for (let tick = 0; tick < 90 && bolivar.attack; tick++)
      stepMatch(state, inputs);
    assert.equal(bolivar.attack, null, "special should finish its recovery");
    assert.equal(
      renderedFrame(state, attackerIndex),
      0,
      "recovery returns to ready guard",
    );

    // Legal settled states retain their own pose selection after this special.
    bolivar.blocking = true;
    assert.equal(
      renderedFrame(state, attackerIndex),
      1,
      "block keeps guard pose 1",
    );
    bolivar.blocking = false;
    bolivar.stun = 2;
    assert.equal(
      renderedFrame(state, attackerIndex),
      7,
      "stun keeps hurt pose 7",
    );
  }
});
