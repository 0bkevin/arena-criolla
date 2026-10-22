import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 180, wins = 3) {
  const configs = [{ name: "Audit Maite", fighter: "maite" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "maite-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900; rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "maite", check, evidence: value })); }
test("Luz de escenario hits idle, respects front guard and defeats rear guard at proper range on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 180), origin = r.player.x;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const impacts: unknown[] = [], blocks = new Set<number>();
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy; close(energyAfterCost, 75);
    for (let n = 1; n < 100; n++) {
      const hp = r.rival.hp; r.advance(1);
      if (hp !== r.rival.hp) impacts.push({ call: n + 1, tick: r.state.tick, hp: r.rival.hp, gap: r.rival.x - r.player.x });
      for (const e of r.state.effects) if (e.owner === side && e.kind === "block") blocks.add(e.id);
    }
    assert.equal(r.player.x, origin); assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    if (guard === "front") { assert.equal(r.rival.hp, 100); assert.equal(blocks.size, 1); assert.equal(r.player.hits, 0); }
    else { close(r.rival.hp, 100 - 16 * 0.94 * 1.03); assert.equal(r.player.hits, 1); assert.equal(blocks.size, 0); assert.equal(impacts.length, 1); }
    emit("special", { side, guard, origin, finalX: r.player.x, energyAfterCost, impacts, blocks: blocks.size, hp: r.rival.hp, hits: r.player.hits, defenderEnergy: r.rival.energy });
  }
  for (const side of [0, 1] as const) { const r = setup(side); r.player.energy = 24; r.inputs[side].actions.special++; r.advance(1); assert.equal(r.player.attack, null); }
});

test("spotlight range, rear exclusion and vertical reach exercise actual engine collisions", () => {
  for (const side of [0, 1] as const) for (const gap of [80, 250, 299, 300, 301]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(20);
    assert.equal(r.player.hits, gap < 300 ? 1 : 0);
    close(r.rival.hp, gap < 300 ? 100 - 16 * 0.94 * 1.03 : 100);
    emit("range-probe", { side, gap, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) {
    // Freeze the actor's grounded facing by starting the attack before moving the rival behind her.
    const fixedRear = setup(side, 180); fixedRear.inputs[side].actions.special++; fixedRear.advance(1); fixedRear.rival.x = fixedRear.player.x + (side === 0 ? -180 : 180); fixedRear.advance(19); assert.equal(fixedRear.player.hits, 0);
    const air = setup(side, 180); air.inputs[1 - side].actions.jump++; air.inputs[side].actions.special++; air.advance(15);
    assert.equal(air.player.hits, 1); assert.ok(!air.rival.grounded);
    emit("vertical-and-rear", { side, jumpTargetHp: air.rival.hp, jumpTargetY: air.rival.y, fixedRearHp: fixedRear.rival.hp });
  }
});
