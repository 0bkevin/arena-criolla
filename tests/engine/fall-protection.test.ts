import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "../../shared/engine/engine";
import { RING_OUT_DAMAGE } from "../../shared/engine/damage-values";
import {
  clearFallProtection,
  grantDashInvincibility,
  grantNonDashInvincibility,
  setInvincibility,
} from "../../shared/engine/invincibility";
import { hurt } from "../../shared/engine/combat";
import { resolveStocks } from "../../shared/engine/outcome";
import {
  platformsAtTick,
  STAGES,
  type StageId,
} from "../../shared/roster/roster";

function setup(stage: StageId = "caracas") {
  const state = createMatch(stage, [
    { name: "Uno", fighter: "zavarce", wins: 0 },
    { name: "Dos", fighter: "javier", wins: 0 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => (p.invincible = 0));
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, inputs };
}

function fallAt(
  state: MatchState,
  seat: 0 | 1,
  where: "left" | "right" | "bottom" = "bottom",
) {
  const p = state.players[seat];
  if (where === "left") p.x = WORLD.x - 121;
  else if (where === "right") p.x = WORLD.x + WORLD.width + 121;
  else p.y = WORLD.y + WORLD.height + 141;
  resolveStocks(state);
}

test("a surviving fall preserves energy and transformation and clears stale actions", () => {
  const { state } = setup();
  const p = state.players[1];
  p.energy = 67;
  p.transformation = { id: "test", ticks: 500, damageMultiplier: 1.5 };
  p.superUsed = true;
  p.dash = 9;
  p.blocking = true;
  p.attack = "heavy";
  p.attackTick = 8;
  p.attackHit = true;
  p.history = [{ action: "light", tick: 1 }];
  p.combo = "old combo";
  p.comboTick = 1;
  p.comboBonus = 10;
  p.lastActions.light = 12;
  state.projectiles.push({
    id: 1,
    owner: 1,
    x: p.x,
    y: p.y,
    vx: 0,
    life: 20,
    tether: { catchX: p.x, catchY: p.y, returnSpeed: 1 },
    kind: "test",
    damage: 1,
  });
  state.fieldFinales = [
    {
      id: 2,
      fighter: "dayana",
      owner: 1,
      startedTick: 0,
      tick: 4,
      duration: 100,
      x: p.x,
      y: p.y,
      direction: 1,
      damage: 1,
    },
  ];

  fallAt(state, 1);

  assert.equal(p.hp, 100 - RING_OUT_DAMAGE);
  assert.equal(p.stocks, 2);
  assert.equal(p.energy, 67);
  assert.deepEqual(p.transformation, {
    id: "test",
    ticks: 500,
    damageMultiplier: 1.5,
  });
  assert.equal(p.superUsed, true);
  assert.equal(p.x, 750);
  assert.equal(p.y, 260);
  assert.equal(p.dash, 0);
  assert.equal(p.blocking, false);
  assert.equal(p.attack, null);
  assert.equal(p.attackTick, 0);
  assert.equal(p.combo, "");
  assert.deepEqual(p.history, []);
  assert.equal(p.lastActions.light, 12);
  assert.equal(
    state.projectiles.some((shot) => shot.owner === 1 && shot.tether),
    false,
  );
  assert.equal(
    Boolean(state.fieldFinales?.some((field) => field.owner === 1)),
    false,
  );
  assert.equal(p.invincible, 60);
  assert.equal(p.cooldown, 30);
});

test("safe return immunity expires after 60 active ticks and landing allows movement", () => {
  const { state, inputs } = setup();
  const p = state.players[0];
  fallAt(state, 0);
  inputs[0].right = true;
  stepMatch(state, inputs);
  assert.ok(
    p.x > 330,
    "the fighter can move on the first tick after returning",
  );
  assert.equal(p.fallProtectionTicks, 59);
  for (let i = 1; i < 60; i++) stepMatch(state, inputs);
  assert.equal(p.fallProtectionTicks, undefined);
  assert.equal(p.invincible, 0);
});

test("successful attacks and super charging cancel only fall protection", () => {
  for (const action of ["light", "special", "super", "dash"] as const) {
    const { state, inputs } = setup();
    const p = state.players[0];
    fallAt(state, 0);
    if (action !== "dash")
      for (let i = 0; i < 30; i++) stepMatch(state, inputs);
    p.grounded = true;
    if (action === "special") p.energy = 25;
    if (action === "super") p.energy = 100;
    if (action === "dash") {
      for (let i = 0; i < 30; i++) stepMatch(state, inputs);
      inputs[0].actions.dash++;
    } else if (action === "super") {
      inputs[0].superHeld = true;
      inputs[0].actions.super++;
    } else inputs[0].actions[action]++;
    stepMatch(state, inputs);
    assert.equal(p.fallProtectionTicks, undefined, action);
    if (action === "light" || action === "special")
      assert.equal(p.attack, action);
    if (action === "super") assert.equal(p.superChargeTicks, 1);
    if (action === "dash") assert.equal(p.dashOnlyInvincible, 8);
    else assert.equal(p.invincible, 0, action);
  }
});

test("a rejected attack request leaves fall protection active", () => {
  const { state, inputs } = setup();
  const p = state.players[0];
  fallAt(state, 0);
  for (let i = 0; i < 30; i++) stepMatch(state, inputs);
  p.energy = 0;
  inputs[0].actions.special++;
  stepMatch(state, inputs);
  assert.equal(p.attack, null);
  assert.equal(p.fallProtectionTicks, 29);
  assert.equal(p.invincible, 29);
});

test("cancelling fall protection retains overlapping technique and dash immunity", () => {
  const { state } = setup();
  const p = state.players[0];
  fallAt(state, 0);
  grantNonDashInvincibility(p, 20);
  grantDashInvincibility(p, 75);
  clearFallProtection(p);
  assert.equal(p.invincible, 75);
  assert.equal(p.dashOnlyInvincible, 55);
});

test("replacing fall immunity does not leave metadata that can erase a later dash", () => {
  const { state } = setup();
  const p = state.players[0];
  fallAt(state, 0);
  setInvincibility(p, 8, true);
  clearFallProtection(p);
  assert.equal(p.invincible, 8);
  assert.equal(p.dashOnlyInvincible, 8);
  assert.equal(p.fallProtectionTicks, undefined);
});

test("a protected return rejects a hit, but attacking makes the fighter vulnerable", () => {
  const { state, inputs } = setup();
  const p = state.players[0];
  fallAt(state, 0);
  assert.equal(hurt(state, 1, 6, 4.5, -1, p.x, p.y, "light"), false);
  for (let i = 0; i < 30; i++) stepMatch(state, inputs);
  inputs[0].actions.light++;
  stepMatch(state, inputs);
  const hp = p.hp;
  assert.equal(p.attack, "light");
  assert.equal(hurt(state, 1, 6, 4.5, -1, p.x, p.y, "light"), true);
  assert.ok(p.hp < hp);
});

test("an attack buffered during return ends protection only when the attack starts", () => {
  const { state, inputs } = setup();
  const p = state.players[0];
  fallAt(state, 0);
  for (let i = 0; i < 25; i++) stepMatch(state, inputs);
  inputs[0].actions.light++;
  stepMatch(state, inputs);
  assert.equal(p.attack, null);
  assert.ok(p.bufferedAttack);
  assert.equal(p.invincible, 34);
  for (let i = 0; i < 4; i++) stepMatch(state, inputs);
  assert.equal(p.attack, "light");
  assert.equal(p.invincible, 0);
});

test("stock loss keeps its 110 tick protection, energy penalty, and transformation clear", () => {
  const { state } = setup();
  const p = state.players[1];
  p.hp = RING_OUT_DAMAGE;
  p.energy = 67;
  p.transformation = { id: "test", ticks: 500, damageMultiplier: 1.5 };
  fallAt(state, 1);
  assert.equal(p.stocks, 1);
  assert.equal(p.hp, 100);
  assert.equal(p.energy, 47);
  assert.equal(p.transformation, undefined);
  assert.equal(p.invincible, 110);
  assert.equal(p.fallProtectionTicks, undefined);
});

test("low-HP final-stock falls still end the match", () => {
  const { state } = setup();
  const p = state.players[0];
  p.stocks = 1;
  p.hp = RING_OUT_DAMAGE;
  fallAt(state, 0);
  assert.equal(p.stocks, 0);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 1);
});

test("a final-stock fall just above the damage threshold keeps the match playing", () => {
  for (const seat of [0, 1] as const) {
    const { state } = setup();
    const p = state.players[seat];
    p.stocks = 1;
    p.hp = RING_OUT_DAMAGE + 0.125;
    fallAt(state, seat);
    assert.equal(p.hp, 0.125);
    assert.equal(p.stocks, 1);
    assert.equal(state.phase, "playing");
    assert.equal(state.winner, null);
  }
});

test("a lethal second fall clears return protection even on the final stock", () => {
  const { state } = setup();
  const p = state.players[0];
  p.stocks = 1;
  p.hp = RING_OUT_DAMAGE * 2;
  fallAt(state, 0);
  assert.equal(p.hp, RING_OUT_DAMAGE);
  fallAt(state, 0);
  assert.equal(p.stocks, 0);
  assert.equal(p.fallProtectionTicks, undefined);
  assert.equal(p.invincible, 0);
  assert.equal(state.phase, "finished");
});

test("both seats land safely before return protection expires on every stage", () => {
  for (const stage of STAGES) {
    for (const seat of [0, 1] as const) {
      const { state, inputs } = setup(stage.id);
      const p = state.players[seat];
      fallAt(state, seat);
      let ticks = 0;
      while (!p.grounded && ticks++ < 60) stepMatch(state, inputs);
      assert.ok(p.grounded, `${stage.id} seat ${seat}`);
      assert.ok(p.invincible > 0, `${stage.id} seat ${seat}`);
      assert.equal(p.hp, 100 - RING_OUT_DAMAGE);
      assert.equal(p.stocks, 2);
    }
  }
});

test("the three blast boundaries trigger falls while ordinary platform landings stay safe", () => {
  for (const seat of [0, 1] as const) {
    for (const side of ["left", "right"] as const) {
      const { state } = setup();
      fallAt(state, seat, side);
      assert.equal(
        state.players[seat].hp,
        100 - RING_OUT_DAMAGE,
        `${seat} ${side}`,
      );
    }
    const { state } = setup();
    fallAt(state, seat, "bottom");
    assert.equal(
      state.players[seat].hp,
      100 - RING_OUT_DAMAGE,
      `${seat} bottom`,
    );
  }
  const { state } = setup("merida");
  const index = 2;
  const platform = platformsAtTick(state.stage, 0)[index]!;
  Object.assign(state.players[0], {
    x: platform.x + platform.width / 2,
    y: platform.y,
    grounded: true,
    supportPlatform: index,
  });
  stepMatch(state, [emptyInput(), emptyInput()]);
  assert.equal(state.players[0].hp, 100);
  assert.equal(state.players[0].stocks, 2);
});

test("moving stages return both seats safely; consecutive falls and JSON replay are deterministic", () => {
  for (const stage of ["canaima", "merida"] as const) {
    for (const seat of [0, 1] as const) {
      const { state } = setup(stage);
      fallAt(state, seat, seat === 0 ? "left" : "right");
      assert.equal(
        state.players[seat].hp,
        100 - RING_OUT_DAMAGE,
        `${stage} ${seat}`,
      );
      assert.equal(state.players[seat].x, seat === 0 ? 330 : 750);
      assert.equal(state.players[seat].y, 260);
    }
  }
  const { state } = setup("merida");
  fallAt(state, 0, "left");
  assert.equal(state.players[0].hp, 100 - RING_OUT_DAMAGE);
  fallAt(state, 0, "right");
  assert.equal(state.players[0].hp, 100 - RING_OUT_DAMAGE * 2);
  assert.equal(
    state.effects.filter((effect) => effect.kind === "ringout").length,
    2,
  );

  const restored = JSON.parse(JSON.stringify(state)) as MatchState;
  const replayInputs = [emptyInput(), emptyInput()] as [Input, Input];
  stepMatch(state, replayInputs);
  stepMatch(restored, replayInputs);
  assert.deepEqual(restored, state);
});
