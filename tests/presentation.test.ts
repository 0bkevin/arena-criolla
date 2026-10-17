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
  samplePose,
} from "../shared/presentation";
import { drawSprite, type SpriteAsset } from "../src/game/assets";
import {
  DEFAULT_ENTRANCE_FIGHTERS,
  ENTRANCE_ACTIONS,
} from "../shared/entrance-actions";
import { CHOREOGRAPHIES } from "../shared/choreography";
import type { FighterId } from "../shared/content";

test("every fighter has a themed or default entrance and an audited combat stance", () => {
  assert.deepEqual(
    Object.keys(PRESENTATIONS).sort(),
    FIGHTERS.map((f) => f.id).sort(),
  );
  assert.equal(
    new Set(Object.values(PRESENTATIONS).map((p) => p.introName)).size,
    FIGHTERS.length - DEFAULT_ENTRANCE_FIGHTERS.length + 1,
  );
  assert.equal(
    new Set(
      Object.entries(PRESENTATIONS).map(([id, p]) =>
        JSON.stringify({
          poses: p.introBeats,
          gesture: CHOREOGRAPHIES[id as FighterId].beats,
          action: ENTRANCE_ACTIONS[id as FighterId],
        }),
      ),
    ).size,
    FIGHTERS.length,
  );
  assert.equal(
    new Set(
      Object.entries(PRESENTATIONS).map(([id, p]) =>
        JSON.stringify({
          poses: p.selectionBeats,
          gesture: CHOREOGRAPHIES[id as FighterId].beats,
          action: ENTRANCE_ACTIONS[id as FighterId],
        }),
      ),
    ).size,
    FIGHTERS.length,
  );
  for (const fighter of FIGHTERS) {
    const profile = PRESENTATIONS[fighter.id];
    assert.equal(profile.frameFacing.length, 8, fighter.id);
    assert.ok(
      profile.frameFacing.every((d) => d === 1 || d === -1),
      fighter.id,
    );
    assert.ok(
      profile.durationMs <= (INTRO_PLAYER_TICKS * 1000) / 60,
      fighter.id,
    );
    for (const beats of [profile.introBeats, profile.selectionBeats]) {
      assert.ok(beats.length >= 5, fighter.id);
      assert.equal(beats[0].at, 0);
      assert.equal(beats.at(-1)!.at, 1);
      assert.equal(beats[0].frame, profile.battleFrame);
      assert.equal(beats.at(-1)!.frame, profile.battleFrame);
      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i];
        assert.ok(
          Number.isInteger(beat.frame) && beat.frame >= 0 && beat.frame <= 4,
          `${fighter.id}: greetings must not use attack or hurt frames`,
        );
        assert.ok(!i || beat.at > beats[i - 1].at, fighter.id);
        assert.ok(Object.values(beat).every(Number.isFinite), fighter.id);
      }
      for (let n = 0; n <= 100; n++)
        assert.ok(
          Object.values(samplePose(beats, n / 100)).every(Number.isFinite),
          fighter.id,
        );
      assert.deepEqual(samplePose(beats, 1), beats.at(-1));
    }
  }
});
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
  assert.equal(state.remaining, 90 * 60);
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
