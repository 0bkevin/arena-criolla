import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit La Llorona", fighter: "llorona" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "llorona-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "llorona", check, evidence: value })); }
test("La Llorona manual dash moves forward, grants brief invincibility, and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 600); const start = r.player.x;
    r.inputs[side].actions.dash++; r.advance(1);
    assert.equal(r.player.dash, 12); assert.equal(r.player.invincible, 8); assert.equal(r.player.cooldown, 30); close(r.player.vx, side === 0 ? 14 : -14);
    r.advance(40); assert.equal(r.player.dash, 0); assert.equal(r.player.invincible, 0); assert.equal(r.player.cooldown, 0); assert.ok((r.player.x - start) * (side === 0 ? 1 : -1) > 140); assert.ok(Math.abs(r.player.vx) < 0.001);
    emit("dash", { side, start, finalX: r.player.x, finalVx: r.player.vx, cooldown: r.player.cooldown });
  }
});
test("Marea en pena pulls only damaging contact, respects front guard and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; vx: number; life: number; kind: string; damage: number; pulls: boolean }>();
    const impacts: { tick: number; hp: number; x: number; vx: number; stun: number }[] = [];
    const blocks = new Set<number>(); const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    let blockVx: number | null = null;
    for (let n = 1; n < 170; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, life: p.life, kind: p.kind, damage: p.damage, pulls: p.pulls ?? false });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, x: r.rival.x, vx: r.rival.vx, stun: r.rival.stun });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side && !blocks.has(e.id)) { blocks.add(e.id); blockVx = r.rival.vx; }
    }
    assert.equal(shots.size, 1); const shot = [...shots.values()][0];
    assert.equal(shot.tick, 15); assert.equal(shot.life, 67); assert.equal(shot.vx, side === 0 ? 7 : -7); assert.equal(shot.kind, "undertow"); assert.equal(shot.pulls, true); close(shot.damage, 11.52);
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") {
      assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); assert.equal(impacts.length, 0); assert.equal(Math.sign(blockVx ?? 0), side === 0 ? 1 : -1); assert.equal(r.rival.stun, 0);
    } else {
      close(r.rival.hp, 88.1344); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); assert.equal(Math.sign(impacts[0].vx), side === 0 ? -1 : 1); close(Math.abs(impacts[0].vx), 7.92288);
      assert.equal(r.rival.stun, 0); assert.equal(r.rival.rootTicks, 0); assert.equal(r.rival.slowTicks, 0);
      if (guard === "idle") assert.ok(Math.abs(r.rival.vx) < 1e-7);
    }
    emit("special", { side, guard, energyAfterCost: 75, shots: [...shots.values()], impacts, blockCount: blocks.size, blockVx, hp: r.rival.hp, hits: r.player.hits, origin, finalPlayerX: r.player.x, finalTargetX: r.rival.x, finalTargetVx: r.rival.vx, finalStun: r.rival.stun, targetStocks: r.rival.stocks });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); assert.equal(r.state.projectiles.length, 0);
    emit("special-energy-gate", { side, startingEnergy: energy, attack: r.player.attack, energy: r.player.energy });
  }
});

test("Marea en pena expires after its bounded lifetime when it misses, with no persistent pull", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 600); let appeared = 0, removed = 0, maximumAge = 0, lastX = 0;
    r.inputs[side].actions.special++;
    for (let n = 0; n < 170; n++) {
      const count = r.state.projectiles.length; r.advance(1);
      if (r.state.projectiles.length) { appeared ||= n + 1; maximumAge = Math.max(maximumAge, r.state.projectiles[0].age ?? 0); lastX = r.state.projectiles[0].x; }
      if (count && !r.state.projectiles.length) removed = n + 1;
    }
    assert.equal(appeared, 15); assert.equal(removed, 82); assert.equal(maximumAge, 67); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.rival.vx, 0); assert.equal(r.state.projectiles.length, 0);
    emit("bounded-expiry", { side, startingX: side === 0 ? 180 : 900, gap: 600, appeared, removed, maximumAge, lastX, hp: r.rival.hp, hits: r.player.hits, targetVx: r.rival.vx });
  }
});
