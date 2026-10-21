import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../shared/engine";
import { combatLabel } from "../src/game/combat-label";

test("combat shows category labels, retains requested character lines, and expires combos", () => {
  const state = createMatch("caracas", [
    { name: "P1", fighter: "nacho", wins: 3 },
    { name: "P2", fighter: "capriles", wins: 3 },
  ]);
  const p = state.players[0];
  assert.equal(combatLabel(p, 0), "");
  p.superChargeTicks = 20;
  assert.equal(combatLabel(p, 0), "Cargando definitiva");
  p.superChargeTicks = 0;
  p.combo = "Old named combo";
  p.comboTick = 100;
  assert.equal(combatLabel(p, 174), "Combo");
  assert.equal(combatLabel(p, 175), "");
  p.attack = "special";
  assert.equal(combatLabel(p, 175), "Ataque especial");
  p.attack = "super";
  assert.equal(combatLabel(p, 175), "Definitiva");
  p.attack = "heavy";
  for (const fighter of ["capriles", "vallenilla"] as const) {
    p.config.fighter = fighter;
    assert.equal(combatLabel(p, 110), p.combo);
  }
});

test("a paid transformation keeps the Definitiva category through recovery without overriding a special", () => {
  const state = createMatch("caracas", [
    { name: "Conde", fighter: "conde", wins: 3 },
    { name: "Rival", fighter: "javier", wins: 3 },
  ]);
  const p = state.players[0];
  p.combo = "La función completa";
  p.comboTick = 10;
  p.attack = null;
  assert.equal(combatLabel(p, 50), "Definitiva");
  p.attack = "special";
  assert.equal(combatLabel(p, 50), "Ataque especial");
  p.attack = null;
  assert.equal(combatLabel(p, 85), "");
});
