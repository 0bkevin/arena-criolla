import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 80, wins = 3, opponent = "javier") {
  const configs = [{ name: "Audit Amanda", fighter: "amanda", wins }, { name: "Audit rival", fighter: opponent, wins: 3 }];
  const state = createMatch("poliedro", (side === 0 ? configs : [...configs].reverse()) as Parameters<typeof createMatch>[1], "amanda-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 300 : 780;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "amanda", check, evidence: value })); }
test("Telón de respuesta consumes 25 energy, strikes once after startup, obeys guard and strict 130 range", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side);
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const startX = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    r.advance(30); assert.equal(r.rival.hp, 100); assert.equal(r.player.attackTick, 31);
    r.advance(1); close(r.rival.hp, guard === "front" ? 100 : 100 - 8 * 1.05 * 1.03);
    assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.player.countered, false);
    r.advance(40); assert.equal(r.player.hits, guard === "front" ? 0 : 1); assert.equal(r.player.attack, null); assert.equal(r.player.x, startX);
    emit("special-idle", { side, guard, hp: r.rival.hp, energy: r.player.energy, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) for (const gap of [129, 130, 131]) {
    const r = setup(side, gap); r.inputs[side].actions.special++; r.advance(34);
    assert.equal(r.player.hits, gap < 130 ? 1 : 0);
    emit("special-range", { side, gap, hp: r.rival.hp, hits: r.player.hits });
  }
  for (const side of [0, 1] as const) {
    const low = setup(side); low.player.energy = 24; low.inputs[side].actions.special++; low.advance(1);
    assert.equal(low.player.attack, null); assert.equal(low.player.hits, 0);
    const rear = setup(side, 70); rear.inputs[side][side === 0 ? "left" : "right"] = true; rear.inputs[side].actions.special++; rear.advance(34);
    assert.equal(rear.player.facing, side === 0 ? -1 : 1); assert.equal(rear.rival.hp, 100);
  }
});

// These are genuine rival light attacks scheduled through inputs, not injected damage.
function timedCounter(side: 0 | 1, contactAt: number) {
  const r = setup(side);
  if (contactAt < 6) { r.inputs[1 - side].actions.light++; r.advance(6 - contactAt); r.inputs[side].actions.special++; r.advance(contactAt); }
  else { r.inputs[side].actions.special++; r.advance(contactAt - 6); r.inputs[1 - side].actions.light++; r.advance(6); }
  return r;
}

test("curtain counter window probes exact incoming-contact ticks 5, 6, 7, 25, 26 and 27 on both sides", () => {
  for (const side of [0, 1] as const) for (const contactAt of [5, 6, 7, 25, 26, 27]) {
    const r = timedCounter(side, contactAt);
    // Both players' clocks must advance before either player's contact is resolved.
    const observedWindow = contactAt >= 6 && contactAt <= 26;
    assert.equal(r.player.countered, observedWindow);
    close(r.player.hp, observedWindow ? 100 : 100 - 7 * fighterById("javier").damage * 0.94);
    close(r.rival.hp, observedWindow ? 100 - 17 * 1.05 * 1.03 : 100);
    emit("counter-window", { side, contactAt, expectedCounter: contactAt >= 6 && contactAt <= 26, observedCounter: r.player.countered, hp: r.player.hp, rivalHp: r.rival.hp, attackTick: r.player.attackTick, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
  }
});

test("curtain counters frontal heavy, rejects rear strikes and spends its response only once per activation", () => {
  for (const side of [0, 1] as const) {
    const front = setup(side); front.inputs[side].actions.special++; front.inputs[1 - side].actions.heavy++; front.advance(11);
    assert.equal(front.player.countered, true); assert.equal(front.player.hp, 100); close(front.rival.hp, 81.6145);
    assert.equal(front.player.hits, 1); assert.equal(Math.sign(front.rival.vx), side === 0 ? 1 : -1);
    const back = setup(side); back.inputs[side].actions.special++; back.advance(1);
    back.rival.x = back.player.x + (side === 0 ? -80 : 80);
    back.inputs[1 - side].actions.light++; back.advance(6);
    assert.equal(back.player.countered, false); close(back.player.hp, 93.6174); assert.equal(back.rival.hp, 100);
    emit("counter-direction", { side, frontal: { hp: front.player.hp, rivalHp: front.rival.hp, hits: front.player.hits }, rear: { hp: back.player.hp, rivalHp: back.rival.hp, facing: back.player.facing } });
    const once = setup(side, 420, 3, "renny"); once.inputs[1 - side].actions.special++; once.advance(48);
    once.inputs[side].actions.special++;
    const blocks = new Set<number>(); let firstCounterTick = 0;
    for (let n = 0; n < 75; n++) {
      once.advance(1);
      if (once.player.countered && !firstCounterTick) firstCounterTick = once.state.tick - INTRO_TOTAL_TICKS;
      for (const e of once.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(blocks.size, 1); assert.equal(firstCounterTick, 54); assert.equal(once.player.hits, 0);
    close(once.player.hp, 100 - 8 * 0.94); assert.equal(once.rival.hits, 1);
    emit("single-counter", { side, blocks: blocks.size, firstCounterTick, hp: once.player.hp, rivalHp: once.rival.hp, hits: once.player.hits });
  }
});

test("real Renny projectiles test counter endpoints 5, 6, 26 and 27 equally on both sides", () => {
  for (const side of [0, 1] as const) for (const contactAt of [5, 6, 26, 27]) {
    const r = setup(side, 420, 3, "renny"); r.inputs[1 - side].actions.special++;
    r.advance(54 - contactAt); r.inputs[side].actions.special++; r.advance(contactAt);
    const active = contactAt >= 6 && contactAt <= 26;
    assert.equal(r.player.countered, active); close(r.player.hp, active ? 100 : 100 - 8 * 0.94);
    assert.equal(r.rival.hp, 100); assert.equal(r.player.hits, 0);
    emit("projectile-counter-window", { side, contactAt, active, hp: r.player.hp, countered: r.player.countered, attackTick: r.player.attackTick });
  }
});

test("projectile interception has an inclusive counter window and strict 220-pixel retaliation distance", () => {
  for (const side of [0, 1] as const) for (const gap of [219, 220, 221, 420]) {
    const r = setup(side, gap, 3, "renny"); r.inputs[1 - side].actions.special++;
    const travel = Math.ceil((gap - 48 - 42 + 0.0001) / 7.5);
    // First Renny pulse exists on frame 10 and immediately moves once that frame.
    const arrival = 9 + travel;
    r.advance(arrival - 12); r.inputs[side].actions.special++; r.advance(12);
    assert.equal(r.player.countered, true); assert.equal(r.player.hp, 100);
    close(r.rival.hp, gap < 220 ? 100 - 17 * 1.05 * fighterById("renny").armor : 100);
    assert.equal(r.player.hits, gap < 220 ? 1 : 0);
    emit("counter-range", { side, gap, arrival, amandaTick: r.player.attackTick, countered: r.player.countered, hp: r.player.hp, rivalHp: r.rival.hp, hits: r.player.hits });
  }
});
