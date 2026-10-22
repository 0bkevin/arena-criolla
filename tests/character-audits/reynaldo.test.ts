import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Reynaldo", fighter: "reynaldo" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "reynaldo-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "reynaldo", check, evidence: value })); }
test("Lazo sabanero pulls and briefly slows idle/rear guards while forward guard prevents both on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 200);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; vx: number; damage: number; kind: string; slowTicks: number; returnAfter: number }>();
    const impacts: { tick: number; hp: number; vx: number; slowTicks: number; stun: number; gap: number }[] = [];
    const slowMovement: { tick: number; slowTicks: number; stun: number; vx: number; grounded: boolean }[] = [];
    const blocks = new Set<number>();
    let maxSlow = 0;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 130; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, damage: p.damage, kind: p.kind, slowTicks: p.slowTicks ?? 0, returnAfter: p.returnAfter ?? 0 });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx, slowTicks: r.rival.slowTicks, stun: r.rival.stun, gap: Math.abs(r.rival.x - r.player.x) });
      maxSlow = Math.max(maxSlow, r.rival.slowTicks);
      if (r.rival.slowTicks && !r.rival.stun && !r.state.hitstop) slowMovement.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, slowTicks: r.rival.slowTicks, stun: r.rival.stun, vx: r.rival.vx, grounded: r.rival.grounded });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 1); assert.equal([...shots.values()][0].tick, 17);
    const shot = [...shots.values()][0]; assert.equal(shot.vx, side === 0 ? 10 : -10); close(shot.damage, 11.66); assert.equal(shot.kind, "lasso"); assert.equal(shot.slowTicks, 25); assert.equal(shot.returnAfter, 28);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.rival.slowTicks, 0);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 1); assert.equal(maxSlow, 0); assert.equal(impacts.length, 0); }
    else {
      close(r.rival.hp, 100 - 11 * 1.06 * 1.03); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1);
      const impact = impacts[0]; assert.equal(impact.slowTicks, 25); assert.equal(Math.sign(impact.vx), side === 0 ? -1 : 1); assert.ok(slowMovement.length > 0);
    }
    emit("special", { side, guard, shots: [...shots.values()], impacts, blocks: blocks.size, maxSlow, slowMovement, finalHp: r.rival.hp, targetX: r.rival.x });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.state.projectiles.length, 0); }
});

test("an unobstructed lasso reverses once at age 28 and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 450); r.inputs[side].actions.special++;
    const samples: { tick: number; age: number; x: number; vx: number; life: number }[] = [];
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) if ([1, 27, 28, 29, 54].includes(p.age ?? 0)) samples.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, age: p.age ?? 0, x: p.x, vx: p.vx, life: p.life });
    }
    assert.deepEqual(samples.map(p => p.age), [1, 27, 28, 29, 54]);
    for (const p of samples) assert.equal(p.vx, (p.age < 28 ? 10 : -10) * (side === 0 ? 1 : -1));
    assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(r.state.projectiles.length, 0);
    emit("returning-lasso", { side, playerX: r.player.x, rivalX: r.rival.x, samples });
  }
});

test("a missed outbound lasso can connect from behind on return and be blocked facing its incoming direction", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 450); r.inputs[side].actions.special++;
    for (let n = 0; n < 42; n++) r.advance(1);
    const shot = r.state.projectiles[0]; assert.ok(shot); assert.equal(shot.age, 26);
    r.rival.x = r.player.x + (side === 0 ? 150 : -150);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    let impact: { tick: number; direction: number; vx: number; slowTicks: number } | null = null;
    const blocks = new Set<number>();
    let maxSlow = 0;
    for (let n = 0; n < 45; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (r.rival.hp < hp) impact = { tick: r.state.tick - INTRO_TOTAL_TICKS, direction: r.state.effects.find(e => e.kind === "hit" && e.owner === side)?.direction ?? 0, vx: r.rival.vx, slowTicks: r.rival.slowTicks };
      maxSlow = Math.max(maxSlow, r.rival.slowTicks);
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    if (guard === "rear") { assert.equal(impact, null); assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0); assert.equal(blocks.size, 1); assert.equal(maxSlow, 0); }
    else {
      assert.ok(impact); assert.equal(impact.direction, side === 0 ? -1 : 1); assert.equal(Math.sign(impact.vx), side === 0 ? -1 : 1); assert.equal(impact.slowTicks, 25);
      assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - 11 * 1.06 * 1.03); assert.equal(blocks.size, 0);
    }
    emit("return-hit", { side, guard, relocationTick: 42, gap: 150, impact, blocks: blocks.size, maxSlow });
  }
});

test("lasso slowdown applies a 0.6 movement-speed multiplier after hit stun ends", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 200); r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) { r.advance(1); if (r.rival.slowTicks > 1 && r.rival.stun === 0 && !r.state.hitstop) break; }
    assert.equal(r.rival.grounded, true); assert.ok(r.rival.slowTicks > 1); assert.equal(r.rival.stun, 0);
    const control = structuredClone(r.state); control.players[1 - side].slowTicks = 0;
    const direction = side === 0 ? 1 : -1;
    r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const vxBefore = r.rival.vx;
    const speed = fighterById(r.rival.config.fighter).speed;
    stepMatch(r.state, r.inputs); stepMatch(control, r.inputs);
    close(r.rival.vx, vxBefore + (direction * speed * 0.6 - vxBefore) * 0.35);
    close(control.players[1 - side].vx, vxBefore + (direction * speed - vxBefore) * 0.35);
    emit("slow-multiplier", { side, tick: r.state.tick - INTRO_TOTAL_TICKS, slowTicks: r.rival.slowTicks, slowedVx: r.rival.vx, controlVx: control.players[1 - side].vx, multiplier: 0.6 });
  }
});
