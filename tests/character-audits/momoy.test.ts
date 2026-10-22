import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 200, wins = 3) {
  const configs = [{ name: "Audit Momoy", fighter: "momoy" as const, wins }, { name: "Audit Javier", fighter: "javier" as const, wins: 3 }] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "momoy-v28-audit");
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
function emit(check: string, evidence: unknown) { console.log(JSON.stringify({ character: "momoy", check, evidence })); }
const damage = (base: number, bonus = 0) => (base * fighterById("momoy").damage + bonus) * fighterById("javier").armor;
test("Roots snare idle and rear guards, respect front guards, and enforce energy/range on P1/P2", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 200);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    r.advance(17);
    close(r.rival.hp, guard === "front" ? 100 : 100 - damage(12));
    assert.equal(r.rival.rootTicks, guard === "front" ? 0 : 38);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1);
    if (guard !== "front") { assert.equal(r.rival.grounded, true); assert.equal(r.rival.vx, 0); assert.equal(r.rival.vy, 0); }
    else assert.ok(r.state.effects.some(e => e.kind === "block" && e.impact === "special"));
    emit("special-contact", { side, guard, tick: r.state.tick - INTRO_TOTAL_TICKS, hp: r.rival.hp, rootTicks: r.rival.rootTicks, stun: r.rival.stun, x: r.rival.x });
    r.advance(90); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.rival.rootTicks, 0);
  }
  for (const side of [0, 1] as const) for (const energy of [24, 25]) {
    const r = setup(side); r.player.energy = energy; r.inputs[side].actions.special++; r.advance(1);
    assert.equal(r.player.attack, energy === 24 ? null : "special");
    emit("special-energy-gate", { side, energy, attack: r.player.attack, remainingEnergy: r.player.energy });
  }
  for (const side of [0, 1] as const) for (const gap of [80, 200, 264, 265, 300]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(18);
    assert.equal(r.player.hits, gap < 265 ? 1 : 0);
    emit("range", { side, gap, hp: r.rival.hp, roots: r.rival.rootTicks });
  }
});

test("Grounded roots immobilize both directions and dash; a fresh jump after hit recovery breaks them", () => {
  for (const side of [0, 1] as const) for (const direction of ["left", "right"] as const) {
    const r = setup(side); const target = 1 - side;
    r.inputs[side].actions.special++; r.advance(18);
    const rootedX = r.rival.x;
    r.inputs[target][direction] = true;
    r.inputs[target].actions.jump++; r.advance(4);
    assert.equal(r.rival.grounded, true); assert.ok(r.rival.rootTicks > 0); assert.equal(r.rival.jumps, 0);
    while (r.rival.stun > 0) { r.advance(1); assert.equal(r.rival.x, rootedX); assert.equal(r.rival.vx, 0); }
    r.inputs[target].actions.dash++; r.advance(1); assert.equal(r.rival.dash, 0); assert.equal(r.rival.x, rootedX);
    r.advance(4); assert.equal(r.rival.x, rootedX); const beforeJump = { tick: r.state.tick - INTRO_TOTAL_TICKS, roots: r.rival.rootTicks, stun: r.rival.stun };
    assert.ok(r.rival.rootTicks > 0);
    r.inputs[target].actions.jump++; r.advance(1);
    assert.equal(r.rival.rootTicks, 0); assert.equal(r.rival.grounded, false); assert.equal(r.rival.jumps, 1); assert.ok(r.rival.y < WORLD.floor); assert.ok(r.rival.vy < 0);
    r.advance(12); assert.notEqual(r.rival.x, rootedX);
    emit("root-escape", { side, direction, rootedX, beforeJump, escapedX: r.rival.x, escapedY: r.rival.y });
  }
});

test("Roots miss when either actor jumps near contact and clear on stock respawn on P1/P2", () => {
  for (const side of [0, 1] as const) for (const jumper of ["actor", "target"] as const) {
    const r = setup(side); r.inputs[side].actions.special++; r.advance(16);
    r.inputs[jumper === "actor" ? side : 1 - side].actions.jump++; r.advance(2);
    assert.equal(r.player.hits, 0); assert.equal(r.rival.hp, 100); assert.equal(r.rival.rootTicks, 0);
    assert.ok(Math.abs(r.player.y - r.rival.y) < TECHNIQUES.roots.height);
    emit("ground-gate", { side, jumper, actorY: r.player.y, targetY: r.rival.y, hp: r.rival.hp });
  }
  for (const side of [0, 1] as const) {
    const r = setup(side); r.inputs[side].actions.special++; r.advance(18); assert.equal(r.rival.rootTicks, 38);
    r.rival.hp = 0;
    for (let n = 0; n < 8 && r.rival.stocks === 2; n++) r.advance(1);
    assert.equal(r.rival.stocks, 1); assert.equal(r.rival.rootTicks, 0); assert.equal(r.rival.hp, 100); assert.equal(r.rival.stun, 0); assert.ok(r.rival.invincible > 0);
    emit("stock-reset", { side, tick: r.state.tick - INTRO_TOTAL_TICKS, stocks: r.rival.stocks, rootTicks: r.rival.rootTicks, hp: r.rival.hp, x: r.rival.x, y: r.rival.y });
  }
});
