import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type MatchState,
} from "../shared/engine";
import { KNOCKOUT_HOLD_MS, sampleKnockout } from "../src/game/knockout";
import { renderMatch, type Assets } from "../src/game/renderer";
import type { SpriteAsset } from "../src/game/assets";
import { activeRunway } from "../shared/field-finales";

function lastHit(side: 0 | 1, airborne = false) {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "zavarce", wins: 3 },
    { name: "Dos", fighter: "javier", wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach((player, index) =>
    Object.assign(player, {
      x: 400 + index * 80,
      y: airborne ? 224 : 554,
      grounded: !airborne,
      facing: index === 0 ? 1 : -1,
      invincible: 0,
    }),
  );
  state.players[1 - side].hp = 1;
  state.players[1 - side].stocks = 1;
  const inputs = [emptyInput(), emptyInput()] as const;
  inputs[side].actions.heavy++;
  for (let tick = 0; tick < 60 && state.winner === null; tick++)
    stepMatch(state, [...inputs]);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, side);
  return state;
}

for (const side of [0, 1] as const) {
  test(`P${side + 1}'s elevated runway remains solid for its owner during the result delay`, () => {
    const dayana = { name: "Pasarela", fighter: "dayana", wins: 3 } as const;
    const rival = { name: "Rival", fighter: "zavarce", wins: 3 } as const;
    const state = createMatch(
      "caracas",
      side === 0 ? [dayana, rival] : [rival, dayana],
    );
    state.phase = "playing";
    Object.assign(state.players[side], {
      x: side === 0 ? 230 : 850,
      y: 392,
      grounded: true,
      supportPlatform: side === 0 ? 0 : 1,
      facing: side === 0 ? 1 : -1,
      energy: 100,
      invincible: 0,
    });
    Object.assign(state.players[1 - side], {
      x: side === 0 ? 780 : 300,
      hp: 80,
      invincible: 0,
    });
    const inputs = [emptyInput(), emptyInput()] as const;
    inputs[side].actions.super++;
    for (let tick = 0; tick < 109; tick++) stepMatch(state, [...inputs]);
    state.remaining = 1;
    inputs[1 - side].actions.jump++;
    stepMatch(state, [...inputs]);
    assert.equal(state.phase, "finished");
    assert.equal(state.winner, side);
    assert.ok(activeRunway(state, state.players[side]));
    assert.ok(
      side === 0 ? state.players[side].x > 359 : state.players[side].x < 727,
      "the performer is beyond the stage platform and supported by the runway",
    );
    const before = structuredClone(state);
    const landing = sampleKnockout(state, KNOCKOUT_HOLD_MS);
    assert.equal(
      landing.players[side].y,
      392,
      "the runway still supports its owner",
    );
    assert.equal(landing.players[side].grounded, true);
    assert.equal(landing.players[side].supportPlatform, null);
    assert.equal(
      landing.players[1 - side].y,
      554,
      "the rival cannot land on the runway",
    );
    assert.equal(landing.winner, side);
    assert.deepEqual(state, before);
  });

  test(`P${side + 1}'s airborne finishing hit lets the winner land during the result delay`, () => {
    const state = lastHit(side, true);
    const before = structuredClone(state);
    assert.equal(state.players[side].grounded, false);
    assert.ok(state.players[side].y < 392);

    const landing = sampleKnockout(state, KNOCKOUT_HOLD_MS);
    assert.equal(
      landing.players[side].y,
      554,
      "the winner must land instead of remaining suspended at the final hit",
    );
    assert.equal(landing.players[side].grounded, true);
    assert.equal(landing.players[side].vy, 0);
    assert.equal(landing.players[side].supportPlatform, -1);
    assert.equal(landing.players[side].hp, state.players[side].hp);
    assert.equal(landing.players[side].stocks, state.players[side].stocks);
    assert.equal(landing.players[side].energy, state.players[side].energy);
    const rendered = recordedRender(state, KNOCKOUT_HOLD_MS);
    assert.ok(
      rendered.translations.some(
        ([x, y]) => x === landing.players[side].x && y === 554,
      ),
      "the actual renderer draws the winner at the landing position",
    );
    assert.equal(landing.winner, side);
    assert.equal(landing.remaining, state.remaining);
    assert.deepEqual(state, before);
  });

  test(`P${side + 1}'s lethal hit continues the defeat at its combat position without changing the result`, () => {
    const state = lastHit(side);
    const before = structuredClone(state);
    const impact = sampleKnockout(state, 0);
    const fall = sampleKnockout(state, KNOCKOUT_HOLD_MS);
    const loser = 1 - side;
    assert.deepEqual(impact.players, state.players);
    assert.deepEqual(fall.players[side], state.players[side]);
    assert.notEqual(fall.players[loser].x, state.players[loser].x);
    assert.ok(fall.players[loser].y <= 554);
    assert.equal(fall.players[loser].stocks, 0);
    assert.equal(fall.winner, side);
    assert.equal(fall.remaining, state.remaining);
    assert.ok(fall.shake < impact.shake);
    assert.ok(
      fall.effects.every(
        (effect) =>
          effect.life <
          state.effects.find((original) => original.id === effect.id)!.life,
      ),
    );
    assert.deepEqual(state, before);
    assert.deepEqual(sampleKnockout(state, KNOCKOUT_HOLD_MS + 5000), fall);
  });
}

test("fighters retain the engine's five-pixel support margin at platform and floor edges", () => {
  for (const { x, y, platform } of [
    { x: 185, y: 392, platform: 0 },
    { x: 357, y: 392, platform: 0 },
    { x: 26, y: 554, platform: -1 },
    { x: 1054, y: 554, platform: -1 },
  ]) {
    const state = createMatch("caracas", [
      { name: "Uno", fighter: "zavarce", wins: 3 },
      { name: "Dos", fighter: "javier", wins: 3 },
    ]);
    state.phase = "playing";
    state.remaining = 1;
    Object.assign(state.players[0], {
      x,
      y,
      vx: 0,
      vy: 0,
      grounded: true,
      supportPlatform: platform,
    });
    state.players[1].hp = 80;
    stepMatch(state, [emptyInput(), emptyInput()]);
    assert.equal(state.phase, "finished");
    assert.equal(state.winner, 0);
    assert.equal(state.players[0].y, y);
    assert.equal(state.players[0].grounded, true);
    const sampled = sampleKnockout(state, KNOCKOUT_HOLD_MS);
    assert.equal(sampled.players[0].y, y, `fighter stays supported at x=${x}`);
    assert.equal(sampled.players[0].grounded, true);
    assert.equal(sampled.players[0].supportPlatform, platform);
  }
});

test("the knockout retains hitstop and respects reduced motion", () => {
  const state = lastHit(0);
  const held = sampleKnockout(state, (state.hitstop * 1000) / 60);
  assert.deepEqual(held.players, state.players);
  const reduced = sampleKnockout(state, KNOCKOUT_HOLD_MS, true);
  assert.deepEqual(reduced.players, state.players);
  assert.equal(reduced.shake, 0);
});

test("a defeated fighter falls continuously after sliding off a platform", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "zavarce", wins: 3 },
    { name: "Dos", fighter: "javier", wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach((player, index) =>
    Object.assign(player, {
      x: 203.75 + index * 70,
      y: 392,
      grounded: true,
      supportPlatform: 0,
      invincible: 0,
      facing: index === 0 ? 1 : -1,
    }),
  );
  state.players[1].hp = 1;
  state.players[1].stocks = 1;
  const inputs = [emptyInput(), emptyInput()] as const;
  inputs[0].actions.light++;
  for (let tick = 0; tick < 30 && state.winner === null; tick++)
    stepMatch(state, [...inputs]);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 0);

  const beforeEdge = sampleKnockout(state, (73 * 1000) / 60).players[1];
  const afterEdge = sampleKnockout(state, (74 * 1000) / 60).players[1];
  assert.equal(beforeEdge.y, 392);
  assert.ok(
    afterEdge.x > 359,
    "the defeated fighter has crossed the support margin",
  );
  assert.ok(
    afterEdge.y > 392 && afterEdge.y < 393,
    "falling starts at the ledge height",
  );
  let previousY = state.players[1].y;
  for (let frame = 0; frame <= 120; frame++) {
    const player = sampleKnockout(state, (frame * 1000) / 60).players[1];
    assert.ok(
      Math.abs(player.y - previousY) < 20,
      `vertical teleport at frame ${frame}`,
    );
    previousY = player.y;
  }
});

for (const direction of [1, -1]) {
  test(`landing immediately before the ${direction === 1 ? "right" : "left"} ledge preserves the fall's history`, () => {
    const state = createMatch("caracas", [
      { name: "Uno", fighter: "zavarce", wins: 3 },
      { name: "Dos", fighter: "javier", wins: 3 },
    ]);
    state.phase = "playing";
    state.players.forEach((player, index) => {
      const x = 205.0793025733 + index * 70;
      Object.assign(player, {
        x: direction === 1 ? x : 542 - x,
        y: 224.623024,
        vy: 0,
        grounded: false,
        supportPlatform: null,
        invincible: 0,
        facing: index === 0 ? direction : -direction,
      });
    });
    state.players[1].hp = 1;
    state.players[1].stocks = 1;
    const inputs = [emptyInput(), emptyInput()] as const;
    inputs[0].actions.light++;
    for (let tick = 0; tick < 30 && state.winner === null; tick++)
      stepMatch(state, [...inputs]);
    assert.equal(state.phase, "finished");
    assert.equal(state.winner, 0);

    const beforeEdge = sampleKnockout(state, 844.614384615).players[1];
    const afterEdge = sampleKnockout(state, 844.616384615).players[1];
    assert.equal(beforeEdge.y, 392);
    assert.ok(
      direction === 1 ? afterEdge.x > 359 : afterEdge.x < 183,
      "the defeated fighter has crossed the ledge",
    );
    assert.ok(
      afterEdge.y > 392 && afterEdge.y < 392.001,
      "leaving the ledge must retain the preceding landing",
    );
    for (let elapsed = 800; elapsed < 900; elapsed += 0.25) {
      const current = sampleKnockout(state, elapsed).players[1];
      const next = sampleKnockout(state, elapsed + 0.25).players[1];
      assert.ok(Math.abs(next.y - current.y) < 0.25);
    }
  });
}

test("ringouts stay outside the arena and draws retain their outcome", () => {
  const state = lastHit(0);
  Object.assign(state.players[1], { x: 1400, y: 900, vx: 18, vy: 12 });
  const fall = sampleKnockout(state, KNOCKOUT_HOLD_MS);
  assert.ok(fall.players[1].x >= 1400);
  assert.ok(fall.players[1].y >= 900);
  state.winner = "draw";
  state.players[0].stocks = 0;
  assert.equal(sampleKnockout(state, KNOCKOUT_HOLD_MS).winner, "draw");
});

test("a timeout lets both airborne survivors land without changing the outcome", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "zavarce", wins: 3 },
    { name: "Dos", fighter: "javier", wins: 3 },
  ]);
  state.phase = "playing";
  state.remaining = 1;
  state.players.forEach((player, index) =>
    Object.assign(player, {
      x: 400 + index * 80,
      y: 224,
      grounded: false,
      hp: index === 0 ? 100 : 80,
    }),
  );
  stepMatch(state, [emptyInput(), emptyInput()]);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 0);
  assert.ok(state.players.every((player) => player.stocks > 0));
  const before = structuredClone(state);
  const landing = sampleKnockout(state, KNOCKOUT_HOLD_MS);
  assert.ok(
    landing.players.every((player) => player.y === 554 && player.grounded),
  );
  assert.equal(landing.winner, 0);
  assert.equal(landing.remaining, 0);
  for (const index of [0, 1]) {
    for (const key of ["hp", "stocks", "energy", "hits", "peakCombo"] as const)
      assert.equal(landing.players[index][key], state.players[index][key]);
  }
  assert.deepEqual(state, before);
});

function recordedRender(state: MatchState, elapsed: number) {
  const textures = Array.from({ length: 8 }, () => ({}));
  const sprite = {
    image: {},
    frameTextures: textures,
    cellWidth: 400,
    cellHeight: 400,
    baseline: 390,
    bodyHeight: 177,
    portraitCenters: Array(8).fill(200),
    frameFacing: Array(8).fill(1),
    battleFrame: 0,
    frames: textures.map((_, frame) => ({
      x: (frame % 4) * 400,
      y: Math.floor(frame / 4) * 400,
      width: 250,
      height: 350,
      slotX: (frame % 4) * 400,
      slotY: Math.floor(frame / 4) * 400,
    })),
  } as unknown as SpriteAsset;
  const draws: object[] = [];
  const translations: number[][] = [];
  const ctx = new Proxy(
    {
      canvas: { width: 1440, height: 800 },
      createLinearGradient: () => ({ addColorStop() {} }),
      drawImage: (image: object) => draws.push(image),
      translate: (...point: number[]) => translations.push(point),
    },
    { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
  ) as unknown as CanvasRenderingContext2D;
  renderMatch(
    ctx,
    state,
    {
      sprites: { zavarce: sprite, javier: sprite },
      stages: {
        caracas: {
          naturalWidth: 1080,
          naturalHeight: 640,
          width: 1080,
          height: 640,
        },
      },
      finaleProps: {},
    } as unknown as Assets,
    0,
    false,
    { x: 540, zoom: 1 },
    elapsed,
  );
  return { draws, translations, defeated: textures[7] };
}

test("the actual finished-match renderer keeps the eliminated fighter visible in the arena", () => {
  const state = lastHit(0);
  for (const elapsed of [0, 300, KNOCKOUT_HOLD_MS]) {
    const rendered = recordedRender(state, elapsed);
    const victim = sampleKnockout(state, elapsed).players[1];
    assert.ok(rendered.draws.includes(rendered.defeated));
    assert.ok(
      rendered.translations.some(([x, y]) => x === victim.x && y === victim.y),
    );
  }
});
