import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress, entranceProgress } from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

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

test("Momoy preserves folklore identity, cane presentation, one-shot timing and all eight facings", () => {
  const f = fighterById("momoy");
  assert.equal(f.name, "El Momoy"); assert.equal(f.ability, "roots"); assert.equal(f.special, "Raíces del páramo");
  assert.deepEqual(f.combos, ["Paso de musgo", "Raíz y rama", "Guardián de la laguna"]);
  assert.equal(TECHNIQUES.roots.snare, 38); assert.equal(TECHNIQUES.roots.groundOnly, true);
  assert.equal(presentationById("momoy").prop, "cane"); assert.equal(presentationById("momoy").battleFrame, 0);
  for (const elapsed of [2800, 5600, 11200]) assert.equal(selectionProgress("momoy", elapsed), 1);
  for (const side of [0, 1]) { assert.equal(entranceProgress("momoy", side * 180 + 180, side), 1); assert.equal(entranceProgress("momoy", side * 180 + 360, side), 1); }
  for (let frame = 0; frame < 8; frame++) for (const facing of [1, -1]) assert.equal(normalizedFacing("momoy", frame, facing), facing);
  emit("presentation", { intro: presentationById("momoy").introName, choreography: CHOREOGRAPHIES.momoy.name });
});

test("Momoy walks and faces both directions, jumps twice, rejects a third jump and lands on P1/P2", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side); r.player.x = 540; r.rival.x = 920;
    const start = r.player.x;
    r.inputs[side].right = true; r.advance(24); const right = r.player.x;
    assert.ok(right > start + 95); assert.equal(r.player.facing, 1);
    r.inputs[side].right = false; r.inputs[side].left = true; r.advance(24); const left = r.player.x;
    assert.ok(left < right - 85); assert.equal(r.player.facing, -1);
    r.inputs[side].left = false; r.advance(10);
    r.inputs[side].actions.jump++; r.advance(10); const firstY = r.player.y;
    assert.equal(r.player.jumps, 1); assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); const secondVy = r.player.vy;
    r.inputs[side].actions.jump++; r.advance(1); assert.equal(r.player.jumps, 2); assert.ok(r.player.vy > secondVy);
    r.advance(100); assert.equal(r.player.grounded, true); assert.equal(r.player.y, WORLD.floor); assert.equal(r.player.jumps, 0);
    emit("movement", { side, start, right, left, firstY, finalY: r.player.y });
  }
});

test("Momoy light and heavy connect once and respect a facing guard on both sides", () => {
  for (const side of [0, 1] as const) for (const action of ["light", "heavy"] as const) for (const guard of [false, true]) {
    const r = setup(side, 80); r.inputs[1 - side].block = guard;
    r.inputs[side].actions[action]++; r.advance(action === "light" ? 8 : 13);
    close(r.rival.hp, guard ? 100 : 100 - damage(action === "light" ? 7 : 13));
    assert.equal(r.player.hits, guard ? 0 : 1);
    assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
    assert.ok(r.state.effects.some(e => e.kind === (guard ? "block" : "hit") && e.impact === action));
    r.advance(40); assert.equal(r.player.hits, guard ? 0 : 1);
    emit("ordinary-attack", { side, action, guard, hp: r.rival.hp, hits: r.player.hits });
  }
});

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

test("Momoy connects chased combos, recognizes unlocks and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) { r.inputs[side].actions.light++; r.advance(23); }
      r.inputs[side].actions.heavy++; r.advance(11);
      assert.equal(r.player.combo, wins ? "Raíz y rama" : "Paso de musgo"); assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - damage(13, wins ? 7 : 3));
      emit("combo-gate", { side, wins, combo: r.player.combo, hp: r.rival.hp, hits: r.player.hits });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0);
      const attacks = advanced ? ["light", "light", "heavy"] as const : ["light", "heavy"] as const;
      for (const action of attacks) {
        for (let n = 0; n < 80 && (r.player.cooldown || Math.abs(r.rival.x - r.player.x) > 80 || !r.rival.grounded); n++) {
          const dx = r.rival.x - r.player.x; r.inputs[side].left = dx < -70; r.inputs[side].right = dx > 70; r.advance(1);
        }
        r.inputs[side].left = false; r.inputs[side].right = false; r.advance(8);
        r.inputs[side].actions[action]++; r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length); assert.equal(r.player.combo, advanced ? "Raíz y rama" : "Paso de musgo");
      emit("connected-combo", { side, combo: r.player.combo, hits: r.player.hits, hp: r.rival.hp, elapsed: r.state.tick - INTRO_TOTAL_TICKS });
    }
    for (const [wins, energy] of [[0, 100], [1, 100], [2, 89], [2, 90], [2, 100], [3, 100]] as const) {
      const r = setup(side, 200, wins); r.player.energy = energy; r.inputs[side].actions.super++; r.advance(9);
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (energy < 90) { assert.equal(r.player.attack, null); assert.equal(r.rival.hp, 100); }
      else { assert.equal(r.player.combo, "Guardián de la laguna"); assert.equal(r.player.comboBonus, 12); assert.equal(r.player.hits, 1); close(r.rival.hp, 100 - damage(28, 12)); }
      emit("super-gate", { side, wins, energy, hp: r.rival.hp, attackerEnergy: r.player.energy, combo: r.player.combo });
    }
  }
});

test("Momoy intro locks movement and attacks until tick 510 and faces the rival", () => {
  for (const side of [0, 1] as const) {
    const state = createMatch("poliedro", side === 0 ? [{ name: "Momoy", fighter: "momoy", wins: 3 }, { name: "Javier", fighter: "javier", wins: 3 }] : [{ name: "Javier", fighter: "javier", wins: 3 }, { name: "Momoy", fighter: "momoy", wins: 3 }]);
    const inputs: [Input, Input] = [emptyInput(), emptyInput()]; inputs[side].right = true; inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro"); assert.equal(state.players[side].x, start); assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs); assert.equal(state.phase, "playing"); assert.equal(state.players[0].facing, 1); assert.equal(state.players[1].facing, -1);
  }
});

function cpuFight() {
  const r = setup(0, 420); let cpu = emptyInput(); const started = new Set<string>(), landed = new Set<string>();
  // Exercise the special explicitly; later AI choices depend on arena geometry.
  r.inputs[0].actions.special++;
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85; r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block = n >= 180 && r.rival.attack === "heavy" && Math.abs(dx) < 190 && r.state.tick % 100 < 30;
    if (n >= 180 && !r.player.cooldown && !r.player.stun && !r.inputs[0].block) {
      const action = Math.abs(dx) < 265 && Math.abs(dx) > 165 && r.player.energy >= 25 && r.rival.grounded && r.player.grounded ? "special" : Math.abs(dx) < 230 && r.player.energy >= 90 ? "super" : Math.abs(dx) < 145 ? (r.state.tick % 3 ? "light" : "heavy") : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if ((r.rival.y < r.player.y - 60 || r.player.x < WORLD.left + 50 || r.player.x > WORLD.right - 50) && r.player.jumps < 2 && r.state.tick % 34 === 0) r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal"); r.inputs[1] = cpu; r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects) if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hp >= 0 && p.hp <= 100);
  }
  assert.equal(r.state.phase, "finished"); assert.ok(r.player.hits > 0); assert.ok(r.rival.hits > 0); assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("A complete Momoy bout against normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(), second = cpuFight(); assert.deepEqual(first, second);
  emit("cpu-fight", { winner: first.state.winner, tick: first.state.tick, remaining: first.state.remaining, started: first.started, landed: first.landed, players: first.state.players.map(p => ({ fighter: p.config.fighter, hp: p.hp, stocks: p.stocks, hits: p.hits, peakCombo: p.peakCombo })) });
});
