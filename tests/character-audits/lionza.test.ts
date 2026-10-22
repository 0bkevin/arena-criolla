import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit María Lionza", fighter: "lionza" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "lionza-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "lionza", check, evidence: value })); }
test("María Lionza manual dash moves forward, grants brief invincibility, and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 600); const start = r.player.x;
    r.inputs[side].actions.dash++; r.advance(1);
    assert.equal(r.player.dash, 12); assert.equal(r.player.invincible, 8); assert.equal(r.player.cooldown, 30); close(r.player.vx, side === 0 ? 14 : -14);
    r.advance(40); assert.equal(r.player.dash, 0); assert.equal(r.player.invincible, 0); assert.equal(r.player.cooldown, 0); assert.ok((r.player.x - start) * (side === 0 ? 1 : -1) > 140); assert.ok(Math.abs(r.player.vx) < 0.001);
    emit("dash", { side, start, finalX: r.player.x, finalVx: r.player.vx, cooldown: r.player.cooldown });
  }
});
test("Danta de Sorte travels along the floor, hits once, blocks once, and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; vx: number; y: number; life: number; kind: string; damage: number; groundOnly: boolean }>();
    const impacts: { tick: number; hp: number; vx: number }[] = [];
    const blocks = new Set<number>(); const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 170; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const shot of r.state.projectiles) {
        assert.equal(shot.y, WORLD.floor - 42); assert.equal(shot.vx, side === 0 ? 6 : -6);
        assert.equal(shot.groundOnly, true); assert.equal(shot.vy, 0);
        if (!shots.has(shot.id)) shots.set(shot.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: shot.vx, y: shot.y, life: shot.life, kind: shot.kind, damage: shot.damage, groundOnly: shot.groundOnly ?? false });
      }
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, vx: r.rival.vx });
      for (const effect of r.state.effects) if (effect.kind === "block" && effect.owner === side) blocks.add(effect.id);
    }
    assert.equal(shots.size, 1); const shot = [...shots.values()][0];
    assert.equal(shot.tick, 21); assert.equal(shot.life, 91); assert.equal(shot.kind, "wildspirit"); close(shot.damage, 19.95);
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); assert.equal(impacts.length, 0); }
    else { close(r.rival.hp, 79.4515); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); assert.equal(Math.sign(impacts[0].vx), side === 0 ? 1 : -1); }
    emit("special", { side, guard, energyAfterCost: 75, shots: [...shots.values()], impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, finalPlayerX: r.player.x, finalTargetX: r.rival.x, targetStocks: r.rival.stocks });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); assert.equal(r.state.projectiles.length, 0);
    emit("special-energy-gate", { side, startingEnergy: energy, attack: r.player.attack, energy: r.player.energy });
  }
});

test("Danta de Sorte expires at its bounded lifetime when it misses on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 650); let appeared = 0, removed = 0, maximumAge = 0, lastX = 0;
    r.inputs[side].actions.special++;
    for (let n = 0; n < 170; n++) {
      const count = r.state.projectiles.length; r.advance(1);
      if (r.state.projectiles.length) {
        const shot = r.state.projectiles[0]; appeared ||= n + 1; maximumAge = Math.max(maximumAge, shot.age ?? 0); lastX = shot.x;
        assert.equal(shot.life, 92 - (shot.age ?? 0)); assert.equal(shot.y, WORLD.floor - 42);
        close(shot.x, (side === 0 ? 180 : 900) + (side === 0 ? 1 : -1) * (48 + 6 * (shot.age ?? 0)));
      }
      if (count && !r.state.projectiles.length) removed = n + 1;
    }
    assert.equal(appeared, 21); assert.equal(removed, 112); assert.equal(maximumAge, 91); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.state.projectiles.length, 0);
    emit("bounded-expiry", { side, gap: 650, appeared, removed, maximumAge, lastX, hp: r.rival.hp, hits: r.player.hits });
  }
});

test("a timely rival jump avoids the grounded spirit completely on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280); r.inputs[side].actions.special++; r.advance(42);
    r.inputs[1 - side].actions.jump++; let crossedWhileAirborne = false;
    for (let n = 0; n < 128; n++) {
      r.advance(1);
      const shot = r.state.projectiles[0];
      if (shot && Math.abs(shot.x - r.rival.x) < 42) { assert.equal(r.rival.grounded, false); crossedWhileAirborne = true; }
      assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    }
    assert.equal(crossedWhileAirborne, true); assert.equal(r.rival.grounded, true); assert.equal(r.state.projectiles.length, 0);
    emit("jump-evasion", { side, jumpInputTick: 43, crossedWhileAirborne, hp: r.rival.hp, hits: r.player.hits, finalY: r.rival.y });
  }
});

test("grounded-spirit range probes preserve real contact and bounded misses", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 520, 620, 650]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(170);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, stocks: r.rival.stocks });
    assert.equal(r.player.hits, gap >= 650 ? 0 : 1);
  }
});

test("Danta de Sorte rejects an airborne start without cost and cannot emit after its caster jumps during startup", () => {
  for (const side of [0, 1] as const) {
    for (const delayed of [false, true]) {
      const r = setup(side, 280); r.inputs[side].actions.jump++;
      if (delayed) r.advance(10);
      r.inputs[side].actions.special++; r.advance(1);
      assert.equal(r.player.grounded, false); assert.equal(r.player.attack, null); close(r.player.energy, 100);
      r.advance(150); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100);
      emit("airborne-start-gate", { side, delayed, attack: r.player.attack, energy: r.player.energy, hp: r.rival.hp, hits: r.player.hits });
    }
    for (const jumpTick of [2, 11, 21]) {
      const r = setup(side, 280); r.inputs[side].actions.special++; r.advance(1);
      assert.equal(r.player.attack, "special"); close(r.player.energy, 75);
      r.advance(jumpTick - 2); r.inputs[side].actions.jump++;
      for (let n = 0; n < 150; n++) { r.advance(1); assert.equal(r.state.projectiles.length, 0); }
      assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.player.attack, null);
      emit("jump-during-startup-gate", { side, jumpTick, hp: r.rival.hp, hits: r.player.hits, energy: r.player.energy, projectiles: r.state.projectiles.length });
    }
  }
});
