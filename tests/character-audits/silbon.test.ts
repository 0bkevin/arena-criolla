import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Silbón", fighter: "silbon" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "silbon-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "silbon", check, evidence: value })); }
test("Silbido errante spends 25 energy, hits once against idle/rear guard, and respects front guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Set<number>(), blocks = new Set<number>();
    const impacts: unknown[] = [], origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    let emission: unknown;
    for (let n = 1; n < 140; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) {
        shots.add(p.id); emission = { tick: r.state.tick - INTRO_TOTAL_TICKS, x: p.x, y: p.y, vx: p.vx, age: p.age, life: p.life, damage: p.damage, kind: p.kind };
        assert.equal(p.kind, "whistle"); close(p.vx, (side === 0 ? 1 : -1) * 4.22); close(p.damage, 13 * 1.03);
        assert.equal(r.state.tick - INTRO_TOTAL_TICKS, 13);
      }
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, facing: r.rival.facing, blocking: r.rival.blocking });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 1); assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 100 - 13 * 1.03 * 1.03); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); }
    emit("special", { side, guard, emission, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits, finalX: r.player.x });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035);
  }
});

test("the whistle accelerates to 12, oscillates by 28, and expires at age 85 without reversing on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 760); r.rival.invincible = 1000;
    r.inputs[side].actions.special++;
    const trace: unknown[] = []; let seen = false, observations = 0, lastX = 0, expiryTick = 0;
    for (let n = 1; n <= 115; n++) {
      r.advance(1); const shot = r.state.projectiles[0];
      if (shot) {
        seen = true; observations++;
        const age = shot.age ?? 0, direction = side === 0 ? 1 : -1;
        close(shot.vx, direction * Math.min(12, 4 + age * 0.22));
        close(shot.y, (shot.originY ?? 0) + Math.sin(age * Math.PI * 2 / 32) * 28);
        assert.equal(shot.life, 85 - age); assert.equal(shot.direction, direction); assert.equal(shot.owner, side);
        assert.ok(Math.abs(shot.vx) <= 12); if (observations > 1) assert.ok((shot.x - lastX) * direction > 0);
        lastX = shot.x;
        if ([1, 8, 16, 24, 32, 36, 37, 64, 84].includes(age)) trace.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, age, x: shot.x, y: shot.y, vx: shot.vx, life: shot.life });
      } else if (seen && !expiryTick) expiryTick = r.state.tick - INTRO_TOTAL_TICKS;
    }
    assert.equal(observations, 84); assert.equal(expiryTick, 97); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100);
    emit("whistle-cap-wave-expiry", { side, observations, expiryTick, trace });
  }
});

test("a timed jump evades the whistle on both sides and range probes use real collision", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280); r.inputs[side].actions.special++; r.advance(12); r.inputs[1 - side].actions.jump++; r.advance(120);
    assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(r.state.projectiles.length, 0);
    emit("jump-evade", { side, jumpTick: 13, hp: r.rival.hp, landed: r.rival.grounded });
  }
  for (const gap of [25, 80, 120, 520, 620, 760, 820]) {
    const r = setup(0, gap); r.inputs[0].actions.special++; r.advance(150);
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x));
    emit("range-probe", { gap, hp: r.rival.hp, hits: r.player.hits, stocks: r.rival.stocks });
  }
});
