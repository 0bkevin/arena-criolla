import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [{ name: "Audit MCM", fighter: "mcm" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "mcm-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "mcm", check, evidence: value })); }
test("Marcha firme catches delayed contact, hops, brakes and respects front/rear guards on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 220); const origin = r.player.x; const impacts: unknown[] = []; const blocks = new Set<number>();
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    let minY = r.player.y, peakSpeed = 0, movedAtStartup = 0;
    for (let n = 1; n < 80; n++) {
      const hp = r.rival.hp; r.advance(1); minY = Math.min(minY, r.player.y); peakSpeed = Math.max(peakSpeed, Math.abs(r.player.vx));
      if (r.player.attackTick === 10) movedAtStartup = r.player.x;
      if (r.rival.hp !== hp) impacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, playerX: r.player.x, targetX: r.rival.x });
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(peakSpeed, 13); assert.ok(minY < WORLD.floor - 25);
    assert.ok((r.player.x - origin) * (side === 0 ? 1 : -1) > 180);
    assert.ok(Math.abs(r.player.vx) < 0.001); assert.equal(r.player.stocks, 2); assert.equal(r.player.grounded, true);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 85.786); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); }
    emit("special", { side, guard, origin, movedAtStartup, finalX: r.player.x, minY, peakSpeed, finalVx: r.player.vx, impacts, blockCount: blocks.size, hp: r.rival.hp, targetEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); assert.equal(r.player.dash, 0); }
});

test("rally travel covers its active window and a distant whiff stops without ringout on both sides", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 180, 270, 278, 279, 280, 300, 345, 400, 620]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(100);
    assert.equal(r.player.stocks, 2); assert.equal(r.player.grounded, true); assert.ok(Math.abs(r.player.vx) < 0.001);
    assert.equal(r.player.hits, gap <= 278 ? 1 : 0);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits, finalX: r.player.x, finalVx: r.player.vx });
  }
});
