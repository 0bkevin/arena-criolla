import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Florentino", fighter: "florentino" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "florentino-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "florentino", check, evidence: value })); }
test("Florentino manual dash moves forward, grants brief invincibility, and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 600); const start = r.player.x;
    r.inputs[side].actions.dash++; r.advance(1);
    assert.equal(r.player.dash, 12); assert.equal(r.player.invincible, 8); assert.equal(r.player.cooldown, 30); close(r.player.vx, side === 0 ? 14 : -14);
    r.advance(40); assert.equal(r.player.dash, 0); assert.equal(r.player.invincible, 0); assert.equal(r.player.cooldown, 0); assert.ok((r.player.x - start) * (side === 0 ? 1 : -1) > 140); assert.ok(Math.abs(r.player.vx) < 0.001);
    emit("dash", { side, start, finalX: r.player.x, finalVx: r.player.vx, cooldown: r.player.cooldown });
  }
});
test("Copla certera emits one forward note, respects front guard and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const shots = new Map<number, { tick: number; vx: number; life: number; kind: string; damage: number; homing: number }>();
    const impacts: { tick: number; hp: number; x: number; vx: number; stun: number }[] = [];
    const blocks = new Set<number>(); const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 170; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx: p.vx, life: p.life, kind: p.kind, damage: p.damage, homing: p.homing ?? 0 });
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, x: r.rival.x, vx: r.rival.vx, stun: r.rival.stun });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size, 1); const shot = [...shots.values()][0];
    assert.equal(shot.tick, 14); assert.equal(shot.life, 73); assert.equal(shot.vx, side === 0 ? 8 : -8); assert.equal(shot.kind, "verse"); assert.equal(shot.homing, 2.8); close(shot.damage, 10.67);
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); assert.equal(impacts.length, 0); }
    else { close(r.rival.hp, 89.0099); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); assert.equal(Math.sign(impacts[0].vx), side === 0 ? 1 : -1); }
    emit("special", { side, guard, energyAfterCost: 75, shots: [...shots.values()], impacts, blockCount: blocks.size, hp: r.rival.hp, hits: r.player.hits, origin, finalPlayerX: r.player.x, finalTargetX: r.rival.x, finalStun: r.rival.stun, targetStocks: r.rival.stocks });
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special"); if (energy === 25) close(r.player.energy, 0.035); assert.equal(r.state.projectiles.length, 0);
    emit("special-energy-gate", { side, startingEnergy: energy, attack: r.player.attack, energy: r.player.energy });
  }
});

test("Copla certera tracks only height, keeps its original horizontal direction after a rival crosses behind and expires", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 720), direction = side === 0 ? 1 : -1;
    r.rival.invincible = 1000;
    let appeared = 0, removed = 0, maximumAge = 0, previousX = r.player.x + direction * 48, previousY = WORLD.floor - 75;
    const tracking: { tick: number; age: number; x: number; y: number; targetX: number; targetY: number; life: number; vx: number }[] = [];
    r.inputs[side].actions.special++;
    for (let n = 0; n < 120; n++) {
      if (n === 15) r.inputs[1 - side].actions.jump++;
      if (n === 25) r.rival.x = r.player.x - direction * 80;
      if (n === 32) r.inputs[1 - side].actions.jump++;
      const count = r.state.projectiles.length; r.advance(1);
      const shot = r.state.projectiles[0];
      if (shot) {
        appeared ||= n + 1; maximumAge = Math.max(maximumAge, shot.age ?? 0);
        close(shot.x, previousX + direction * 8);
        close(shot.y, previousY + Math.max(-2.8, Math.min(2.8, r.rival.y - 75 - previousY)));
        assert.equal(shot.vx, direction * 8); assert.equal(shot.direction, direction); assert.equal(shot.owner, side); assert.equal(shot.life, 74 - (shot.age ?? 0));
        previousX = shot.x; previousY = shot.y;
        if ([1, 10, 20, 40, 60, 73].includes(shot.age ?? 0)) tracking.push({ tick: n + 1, age: shot.age ?? 0, x: shot.x, y: shot.y, targetX: r.rival.x, targetY: r.rival.y, life: shot.life, vx: shot.vx });
      }
      if (count && !r.state.projectiles.length) removed = n + 1;
    }
    assert.equal(appeared, 14); assert.equal(removed, 87); assert.equal(maximumAge, 73); assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.state.projectiles.length, 0);
    assert.ok(tracking.some(p => p.y < WORLD.floor - 75)); assert.ok(tracking.some(p => (p.targetX - r.player.x) * direction < 0));
    emit("vertical-tracking-fixed-direction-and-expiry", { side, gap: 720, rivalJumpInputTicks: [16, 33], rivalCrossedBehindAtTick: 26, appeared, removed, maximumAge, tracking, finalHp: r.rival.hp });
  }
});
