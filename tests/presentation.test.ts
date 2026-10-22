import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS } from "../shared/content";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import {
  PRESENTATIONS,
  INTRO_COUNTDOWN_START,
  INTRO_PLAYER_TICKS,
  INTRO_TOTAL_TICKS,
  entranceProgress,
  introActor,
  normalizedFacing,
} from "../shared/presentation";
import { drawSprite, type SpriteAsset } from "../src/game/assets";

test("both character windows end before the shared countdown", () => {
  assert.equal(introActor(0), 0);
  assert.equal(introActor(INTRO_PLAYER_TICKS - 1), 0);
  assert.equal(introActor(INTRO_PLAYER_TICKS), 1);
  assert.equal(introActor(INTRO_COUNTDOWN_START - 1), 1);
  assert.equal(introActor(INTRO_COUNTDOWN_START), null);
  for (const f of FIGHTERS) {
    assert.equal(entranceProgress(f.id, 0, 0), 0);
    assert.equal(entranceProgress(f.id, INTRO_COUNTDOWN_START, 1), 1);
    assert.equal(normalizedFacing(f.id, PRESENTATIONS[f.id].battleFrame, 1), 1);
    assert.equal(
      normalizedFacing(f.id, PRESENTATIONS[f.id].battleFrame, -1),
      -1,
    );
  }
});
test("left-drawn poses are normalized at the draw call for either side", () => {
  for (const id of ["emilio", "george"] as const) {
    const calls: number[][] = [];
    const ctx = {
      save() {},
      restore() {},
      translate() {},
      scale: (x: number, y: number) => calls.push([x, y]),
      drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    const sprite = {
      image: {},
      bodyHeight: 170,
      cellWidth: 400,
      frames: Array.from({ length: 8 }, () => ({
        x: 0,
        y: 0,
        width: 100,
        height: 170,
        slotX: 0,
        slotY: 0,
      })),
      frameFacing: PRESENTATIONS[id].frameFacing,
    } as unknown as SpriteAsset;
    drawSprite(ctx, sprite, 0, 100, 200, 170, 1);
    drawSprite(ctx, sprite, 0, 100, 200, 170, -1);
    assert.deepEqual(
      calls,
      [
        [-1, 1],
        [1, 1],
      ],
      id,
    );
  }
});
test("entrances lock physics and consume queued attacks without spending match time", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "george", wins: 0 },
    { name: "Dos", fighter: "emilio", wins: 0 },
  ]);
  const inputs = [emptyInput(), emptyInput()] as ReturnType<
    typeof emptyInput
  >[];
  inputs[0].right = true;
  inputs[0].actions.special++;
  inputs[1].actions.light++;
  for (let i = 0; i < INTRO_TOTAL_TICKS; i++)
    stepMatch(state, inputs as [(typeof inputs)[0], (typeof inputs)[1]]);
  assert.equal(state.phase, "playing");
  assert.equal(state.remaining, 120 * 60);
  assert.deepEqual(
    state.players.map((p) => [p.x, p.hp, p.facing, p.attack]),
    [
      [330, 100, 1, null],
      [750, 100, -1, null],
    ],
  );
  stepMatch(state, inputs as [(typeof inputs)[0], (typeof inputs)[1]]);
  assert.equal(state.players[0].attack, null);
  assert.equal(state.players[1].attack, null);
});
test("skip is synchronized through existing inputs and retains the countdown", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "simon", wins: 0 },
    { name: "Dos", fighter: "dudamel", wins: 0 },
  ]);
  const inputs: [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>] =
    [emptyInput(), emptyInput()];
  inputs[1].actions.dash++;
  stepMatch(state, inputs);
  assert.equal(state.tick, INTRO_COUNTDOWN_START);
  assert.equal(state.phase, "intro");
  const peer = JSON.parse(JSON.stringify(state));
  for (let i = INTRO_COUNTDOWN_START; i < INTRO_TOTAL_TICKS; i++) {
    stepMatch(state, inputs);
    stepMatch(peer, inputs);
    assert.deepEqual(state, peer);
  }
  assert.equal(state.phase, "playing");
  assert.equal(state.players[1].dash, 0);
});
