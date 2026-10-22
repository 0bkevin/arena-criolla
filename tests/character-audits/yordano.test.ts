import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 400, wins = 3) {
  const configs = [{ name: "Audit Yordano", fighter: "yordano" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }];
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]], "yordano-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 230 : 850; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "yordano", check, evidence })); }
test("Manantial emits all three mirrored arcing drops, hits idle, blocks front guard and defeats rear guard", () => {
  const mirrored: Record<string, unknown>[] = [];
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 400), origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle"; if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; attackTick: number; vx: number; vy: number; y: number; gravity: number; damage: number; kind: string }>();
    const impacts: { tick: number; hp: number; y: number }[] = [], blocks = new Set<number>();
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75); const energyAfterCost = r.player.energy;
    for (let n = 1; n < 160; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, vx: p.vx, vy: p.vy ?? 0, y: p.y, gravity: p.gravity ?? 0, damage: p.damage, kind: p.kind });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, y: r.rival.y });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    const emissions = [...shots.values()]; assert.equal(shots.size, 3); assert.deepEqual(emissions.map(p => p.attackTick), [13, 26, 39]);
    assert.deepEqual(emissions.map(p => p.tick), [13, 26, 39]);
    assert.ok(emissions.every(p => p.vx === (side === 0 ? 7.2 : -7.2) && Math.abs(p.vy + 8.7) < 1e-8 && p.y === 470.3 && p.gravity === 0.3 && p.damage === 7 && p.kind === "fountain"));
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0);
    close(r.rival.hp, guard === "front" ? 100 : guard === "idle" ? 78.37 : 92.79);
    assert.equal(r.player.hits, guard === "front" ? 0 : guard === "idle" ? 3 : 1); assert.equal(blocks.size, guard === "front" ? 3 : 0);
    const evidence = { guard, emissions: emissions.map(({ vx, ...p }) => ({ ...p, speed: Math.abs(vx) })), impacts, hp: r.rival.hp, hits: r.player.hits, blocks: blocks.size };
    if (side === 0) mirrored.push(evidence); else assert.deepEqual(evidence, mirrored[["idle", "front", "rear"].indexOf(guard)]);
    emit("special", { side, gap: 400, energyAfterCost, ...evidence, attackerEnergy: r.player.energy, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("all three drops follow the same parabola and expire after descending without ground-only restrictions", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 230); r.inputs[side].actions.special++;
    const trajectories = new Map<number, { age: number; x: number; y: number; vy: number }[]>();
    for (let n = 0; n < 145; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) {
        const age = p.age ?? 0, sign = side === 0 ? 1 : -1;
        close(p.x, r.player.x + sign * (48 + age * 7.2)); close(p.y, WORLD.floor - 75 - age * 9 + 0.15 * age * (age + 1)); close(p.vy ?? 0, -9 + age * 0.3);
        assert.notEqual(p.groundOnly, true);
        const points = trajectories.get(p.id) ?? []; points.push({ age, x: p.x, y: p.y, vy: p.vy ?? 0 }); trajectories.set(p.id, points);
      }
    }
    assert.equal(trajectories.size, 3); assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.hp, 100);
    for (const points of trajectories.values()) { assert.ok(points.some(p => p.vy < 0)); assert.ok(points.some(p => p.vy > 0)); assert.equal(points.at(-1)!.age, 64); }
    emit("arc", { side, gap: 230, apexY: Math.min(...[...trajectories.values()][0].map(p => p.y)), lastAge: [...trajectories.values()][0].at(-1)!.age, drops: trajectories.size, hp: r.rival.hp });
  }
});

test("Manantial covers a real jumping target at 230 pixels on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 230); r.inputs[side].actions.special++; r.inputs[1 - side].actions.jump++;
    const impacts: { tick: number; hp: number; y: number; grounded: boolean }[] = [];
    for (let n = 0; n < 145; n++) { const hp = r.rival.hp; r.advance(1); if (hp !== r.rival.hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, y: r.rival.y, grounded: r.rival.grounded }); }
    assert.equal(r.player.hits, 1); close(r.rival.hp, 92.79); assert.equal(impacts[0].tick, 32); assert.equal(impacts[0].grounded, false); assert.ok(impacts[0].y < WORLD.floor - 100);
    emit("anti-air", { side, gap: 230, impacts });
  }
});
