import test from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, cpuInput, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
type Side = 0 | 1;
function setup(side: Side = 0, gap = 120, wins = 3) {
  const configs = [
    { name: "Audit Capriles", fighter: "capriles" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("caracas", side === 0 ? [...configs] : [configs[1], configs[0]], "capriles-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  state.players[0].x = 540 - gap / 2;
  state.players[1].x = 540 + gap / 2;
  const player = state.players[side], rival = state.players[1 - side];
  player.energy = 100;
  rival.energy = 60;
  return { state, inputs, advance, player, rival, side };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const emit = (check: string, evidence: unknown) => console.log(JSON.stringify({ character: "capriles", check, evidence }));
for (const side of [0, 1] as const) {
  test(`Capriles P${side + 1}: sprint hits idle, respects facing guard, and defeats a turned guard`, () => {
    for (const guard of ["idle", "facing", "away"] as const) {
      const run = setup(side, 120);
      run.inputs[1 - side].block = guard !== "idle";
      if (guard === "away") run.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      run.inputs[side].actions.special++;
      run.advance(8);
      assert.equal(run.rival.hp, 100);
      assert.equal(run.player.dash, 0);
      run.advance(1);
      assert.equal(run.player.attack, "special");
      assert.equal(run.player.attackTick, 9);
      assert.equal(run.player.dash, TECHNIQUES.sprint.dash!.ticks);
      assert.equal(run.player.invincible, TECHNIQUES.sprint.dash!.invincibility);
      close(run.player.vx, (side === 0 ? 1 : -1) * 16);
      assert.equal(run.state.projectiles.length, 0);
      // A retreating target must actually be reached during the dash.
      for (let frame = 0; frame < 12 && !run.player.attackHit; frame++) run.advance(1);
      if (guard === "facing") {
        assert.equal(run.rival.hp, 100);
        assert.equal(run.player.hits, 0);
        assert.ok(run.rival.energy < 51);
        assert.ok(run.state.effects.some(e => e.kind === "block"));
      } else {
        close(100 - run.rival.hp, 16 * 0.88 * 1.03);
        assert.equal(run.player.hits, 1);
      }
      emit("special", { side, guard, hp: run.rival.hp, energy: run.player.energy, rivalEnergy: run.rival.energy, dash: run.player.dash, vx: run.player.vx, hits: run.player.hits });
    }
    const locked = setup(side);
    locked.player.energy = 24;
    locked.inputs[side].actions.special++;
    locked.advance(1);
    assert.equal(locked.player.attack, null);
  });

  test(`Capriles P${side + 1}: combo names from zero wins and definitive energy gates`, () => {
    for (const wins of [0, 1]) {
      const run = setup(side, 140, wins);
      run.inputs[side].actions.light++; run.advance(23);
      run.inputs[side].actions.light++; run.advance(23);
      run.inputs[side].actions.heavy++; run.advance(11);
      assert.equal(run.player.combo, "Hay un camino");
      assert.equal(run.player.comboBonus, 7);
      close(100 - run.rival.hp, (13 * 0.88 + 7) * 1.03);
      assert.equal(run.player.hits, 1);
      emit("combo-gate", { side, wins, name: run.player.combo, bonus: run.player.comboBonus, hits: run.player.hits, hp: run.rival.hp, note: "setup lights are outside range; heavy lands" });
    }
    for (const wins of [0, 1, 2, 3]) {
      const run = setup(side, 200, wins);
      run.inputs[side].actions.super++; run.advance(9);
      if (run.state.finale) run.advance(run.state.finale.duration);
      assert.equal(run.player.combo, "Meta tricolor");
      assert.equal(run.player.comboBonus, 12);
      close(100 - run.rival.hp, (28 * 0.88 + 12) * 1.03);
      assert.equal(run.player.hits, 1);
      assert.ok(run.player.energy < 39);
      emit("super-gate", { side, wins, hp: run.rival.hp, energy: run.player.energy, combo: run.player.combo });
    }
    const depleted = setup(side, 200, 3);
    depleted.player.energy = 89;
    depleted.inputs[side].actions.super++; depleted.advance(1);
    assert.equal(depleted.player.attack, null);
  });
}
test("P2 Capriles CPU selects and connects his own sprint special in range", () => {
  const run = setup(1, 120, 0);
  run.state.tick = 600;
  run.player.energy = 50;
  run.inputs[1] = cpuInput(run.state, run.inputs[1], "hard");
  assert.equal(run.inputs[1].actions.special, 1);
  run.advance(9);
  assert.equal(run.player.attack, "special");
  assert.equal(run.player.hits, 1);
  close(run.rival.hp, 85.4976);
  emit("cpu-special", { hp: run.rival.hp, actorX: run.player.x, dash: run.player.dash, hits: run.player.hits });
});
