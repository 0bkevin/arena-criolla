import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [{ name: "Audit Norkys", fighter: "norkys" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }];
  const state = createMatch("poliedro", side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]], "norkys-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side], direction = side === 0 ? 1 : -1;
  player.x = side === 0 ? 420 : 660; rival.x = player.x + direction * gap;
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side, direction };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "norkys", check, evidence })); }
test("pivot leaps backward at startup, emits exactly two pulses and brakes within a bounded displacement on either side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 350), start = r.player.x, pulses: number[] = []; let lowest = WORLD.floor;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    const effects = new Set(r.state.effects.map(e => e.id));
    for (let n = 1; n < 120; n++) {
      r.advance(1); lowest = Math.min(lowest, r.player.y);
      for (const e of r.state.effects) if (!effects.has(e.id)) { effects.add(e.id); if (e.kind === "special" && e.owner === side) pulses.push(r.player.attackTick); }
      if (r.player.attackTick === 8 && r.player.attack === "special") { close(r.player.vx, -7 * r.direction); close(r.player.vy, -12.48); assert.equal(r.player.grounded, false); }
    }
    assert.deepEqual(pulses, [8, 23]); assert.equal(r.state.projectiles.length, 0);
    close((r.player.x - start) * r.direction, -73.83212589080193);
    assert.ok(lowest < WORLD.floor - 150); assert.ok(Math.abs(r.player.vx) < 0.001); assert.equal(r.player.grounded, true);
    assert.equal(r.player.stocks, 2); assert.equal(r.rival.hp, 100);
    emit("retreat-and-braking", { side, pulses, displacement: r.player.x - start, apexY: lowest, finalVx: r.player.vx, finalY: r.player.y });
  }
});

test("frontal pivot blocks twice against a front guard and punishes idle or rear guard on either side", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; const blocks = new Set<number>(), contacts: unknown[] = [];
    for (let n = 0; n < 120; n++) { const hp = r.rival.hp; r.advance(1); if (hp !== r.rival.hp) contacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp }); for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id); }
    close(r.rival.hp, guard === "front" ? 100 : 92.172); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(blocks.size, guard === "front" ? 2 : 0);
    emit("frontal-pivot", { side, guard, hp: r.rival.hp, hits: r.player.hits, blocks: blocks.size, contacts, explanation: "First-hit knockback moves a frontal opponent beyond the second radial pulse; a close guarded opponent remains in range." });
  }
});

test("both pivot pulses damage an opponent behind Norkys, with directional guards on either player side", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, -80); r.inputs[side][side === 0 ? "right" : "left"] = true;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "left" : "right"] = true;
    r.inputs[side].actions.special++; const blocks = new Set<number>(), contacts: { tick: number; attackTick: number; hp: number; vx: number }[] = [];
    // Capture both pulses before the retreat-side target can ring out and respawn.
    for (let n = 0; n < 40; n++) { const hp = r.rival.hp; r.advance(1); r.inputs[side].left = false; r.inputs[side].right = false; if (hp !== r.rival.hp) contacts.push({ tick: r.state.tick - INTRO_TOTAL_TICKS, attackTick: r.player.attackTick, hp: r.rival.hp, vx: r.rival.vx }); for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id); }
    close(r.rival.hp, guard === "front" ? 100 : 84.344); assert.equal(r.player.hits, guard === "front" ? 0 : 2); assert.equal(blocks.size, guard === "front" ? 2 : 0);
    if (guard !== "front") { assert.deepEqual(contacts.map(c => c.attackTick), [8, 23]); assert.ok(Math.abs(contacts[1].vx) > Math.abs(contacts[0].vx) * 2); }
    emit("rear-radial-pulses", { side, guard, hits: r.player.hits, hp: r.rival.hp, blocks: blocks.size, contacts });
  }
});

test("pivot respects energy and range gates on either side", () => {
  for (const side of [0, 1] as const) {
    const low = setup(side, 80); low.player.energy = 24; low.inputs[side].actions.special++; low.advance(1); assert.equal(low.player.attack, null); assert.equal(low.rival.hp, 100);
    const far = setup(side, 160); far.inputs[side].actions.special++; far.advance(120); assert.equal(far.player.hits, 0); assert.equal(far.rival.hp, 100);
  }
});
