import assert from "node:assert/strict";
import test from "node:test";
import { WORLD, createMatch, emptyInput, stepMatch } from "../shared/engine";
import { TECHNIQUES } from "../shared/techniques";
import { ATTACK_ART, hasAttackArt } from "../src/game/attack-art";
import { BOLIVAR_POSES, bolivarSpecialPose, drawBolivarSpecial } from "../src/game/finales/bolivar";
function setup(side: 0 | 1 = 0, distance = 80, wins = 3, energy = 100) {
  const actor = { name: "Bolívar", fighter: "bolivar" as const, wins },
    rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.invincible = 0;
    p.energy = 100;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * distance;
  target.facing = -source.facing;
  source.energy = energy;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}
test("Bolívar draws once and lands exactly three local sabre strikes with a single energy debit", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side),
      x = r.source.x;
    r.inputs[side].actions.special++;
    r.advance(1);
    assert.equal(r.source.energy, 75);
    const hits: number[] = [];
    let hp = r.target.hp;
    for (let i = 0; i < 75; i++) {
      r.advance(1);
      if (r.target.hp < hp) hits.push(r.source.attackTick);
      hp = r.target.hp;
    }
    assert.deepEqual(hits, [14, 26, 38]);
    assert.equal(r.source.hits, 3);
    assert.equal(r.source.x, x);
    assert.equal(r.source.attack, null);
    assert.equal(r.state.projectiles.length, 0);
  }
  assert.equal(TECHNIQUES.liberator.pulseRangeStep, 0);
  assert.equal(TECHNIQUES.liberator.dash, undefined);
});
test("Sabre respects range, facing, elevation, guard, low energy and interruption", () => {
  for (const side of [0, 1] as const) {
    for (const distance of [120, 210, -90]) {
      const r = setup(side, distance);
      r.inputs[side].actions.special++;
      r.advance(1);
      if (distance < 0) r.source.facing *= -1;
      r.advance(84);
      assert.equal(r.target.hp, 100);
    }
    const blocked = setup(side);
    blocked.inputs[1 - side].block = true;
    blocked.inputs[side].actions.special++;
    blocked.advance(85);
    assert.equal(blocked.target.hp, 100);
    const low = setup(side, 80, 3, 24);
    low.inputs[side].actions.special++;
    low.advance(1);
    assert.equal(low.source.attack, null);
    assert.ok(low.source.energy >= 24 && low.source.energy < 25);
    const elevated = setup(side);
    elevated.target.y = WORLD.floor - 180;
    elevated.target.vy = -8;
    elevated.target.grounded = false;
    elevated.inputs[side].actions.special++;
    elevated.advance(52);
    assert.equal(elevated.source.hits, 0);
    const interrupt = setup(side, 65);
    interrupt.inputs[1 - side].actions.light++;
    interrupt.advance(3);
    interrupt.inputs[side].actions.special++;
    interrupt.advance(85);
    assert.equal(interrupt.source.hits, 0);
    assert.ok(interrupt.source.hp < 100);
  }
});
test("Four sabre phases preserve one blade and fully preflight all fourteen finale poses", () => {
  assert.deepEqual([1, 14, 26, 38, 48].map(bolivarSpecialPose), [
    "draw",
    "slash",
    "cut",
    "thrust",
    "draw",
  ]);
  assert.equal(BOLIVAR_POSES.length, 14);
  const r = setup();
  r.inputs[0].actions.special++;
  r.advance(14);
  assert.equal(
    drawBolivarSpecial({} as CanvasRenderingContext2D, {}, r.source, 177),
    false,
  );
  assert.equal(hasAttackArt({}, "bolivar", BOLIVAR_POSES), false);
  const sheet = ATTACK_ART.bolivar,
    images = {
      [sheet.file]: {
        width: Math.max(
          ...Object.values(sheet.frames).map((f) => f.x + f.width),
        ),
        height: Math.max(
          ...Object.values(sheet.frames).map((f) => f.y + f.height),
        ),
      } as HTMLImageElement,
    };
  assert.equal(hasAttackArt(images, "bolivar", BOLIVAR_POSES), true);
  const saved = sheet.frames["llanero-6"];
  delete sheet.frames["llanero-6"];
  try {
    assert.equal(hasAttackArt(images, "bolivar", BOLIVAR_POSES), false);
  } finally {
    sheet.frames["llanero-6"] = saved;
  }
});
