import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 80, wins = 3) {
  const configs = [
    { name: "Audit Oscar", fighter: "oscar" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch(
    "poliedro",
    side === 0 ? [...configs] : [configs[1], configs[0]],
    "oscar-v28-audit",
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    rival = state.players[1 - side];
  player.x = side === 0 ? 400 : 680;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const emit = (check: string, evidence: unknown) =>
  console.log(JSON.stringify({ character: "oscar", check, evidence }));
test("Giro del sonero costs 25 energy, lifts once and hits front and rear rivals while respecting their facing guard", () => {
  for (const side of [0, 1] as const)
    for (const location of ["front", "behind"] as const)
      for (const guard of ["idle", "front", "rear"] as const) {
        const r = setup(side),
          direction = side === 0 ? 1 : -1;
        if (location === "behind") r.rival.x = r.player.x - direction * 80;
        // Movement establishes the intentional attack facing before the real special starts.
        r.inputs[side][direction === 1 ? "right" : "left"] = true;
        r.inputs[1 - side].block = guard !== "idle";
        if (guard !== "idle") {
          const targetFacing =
            Math.sign(r.player.x - r.rival.x) * (guard === "front" ? 1 : -1);
          r.inputs[1 - side][targetFacing === 1 ? "right" : "left"] = true;
        }
        r.inputs[side].actions.special++;
        r.advance(1);
        close(r.player.energy, 75);
        r.inputs[side].right = r.inputs[side].left = false;
        const impacts: unknown[] = [],
          blocks = new Set<number>();
        let minimumY = r.player.y;
        for (let n = 1; n < 110; n++) {
          const hp = r.rival.hp;
          r.advance(1);
          minimumY = Math.min(minimumY, r.player.y);
          if (hp !== r.rival.hp)
            impacts.push({
              tick: r.state.tick - INTRO_TOTAL_TICKS,
              hp: r.rival.hp,
              playerY: r.player.y,
              targetY: r.rival.y,
            });
          for (const e of r.state.effects)
            if (e.kind === "block" && e.owner === side) blocks.add(e.id);
          if (n === 7)
            r.inputs[1 - side].left = r.inputs[1 - side].right = false;
          if (n < 10) assert.equal(r.player.facing, direction);
        }
        assert.ok(minimumY < WORLD.floor - 100);
        assert.equal(r.player.attack, null);
        assert.equal(r.state.projectiles.length, 0);
        if (guard === "front") {
          assert.equal(r.rival.hp, 100);
          assert.equal(blocks.size, 1);
          assert.equal(r.player.hits, 0);
        } else {
          close(r.rival.hp, 83.3552);
          assert.equal(r.player.hits, 1);
          assert.equal(blocks.size, 0);
        }
        emit("special", {
          side,
          location,
          guard,
          impacts,
          minimumY,
          hp: r.rival.hp,
          hits: r.player.hits,
          blockCount: blocks.size,
        });
      }
  for (const side of [0, 1] as const)
    for (const energy of [24, 25]) {
      const r = setup(side);
      r.player.energy = energy;
      r.inputs[side].actions.special++;
      r.advance(1);
      assert.equal(r.player.attack, energy === 24 ? null : "special");
      if (energy === 25) close(r.player.energy, 0.035);
    }
});

test("Oscar special obeys 140 horizontal range and reaches an actually jumping rival and an airborne actor", () => {
  for (const side of [0, 1] as const) {
    for (const gap of [80, 139, 140, 200]) {
      const r = setup(side, gap);
      r.inputs[side].actions.special++;
      r.advance(100);
      assert.equal(r.player.hits, gap < 140 ? 1 : 0);
      emit("range-probe", {
        side,
        gap,
        hp: r.rival.hp,
        hits: r.player.hits,
        stocks: [r.player.stocks, r.rival.stocks],
      });
    }
    for (const airborne of ["actor", "rival"] as const) {
      const r = setup(side);
      r.inputs[airborne === "actor" ? side : 1 - side].actions.jump++;
      r.advance(12);
      const startingY = [r.player.y, r.rival.y];
      r.inputs[side].actions.special++;
      r.advance(100);
      assert.equal(r.player.hits, 1);
      close(r.rival.hp, 83.3552);
      emit("aerial-special", {
        side,
        airborne,
        startingY,
        hp: r.rival.hp,
        hits: r.player.hits,
      });
    }
  }
});

test("Oscar combos recognize whiff chains, connect with chase inputs and apply super energy gates", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) {
        r.inputs[side].actions.light++;
        r.advance(23);
      }
      r.inputs[side].actions.heavy++;
      r.advance(11);
      assert.equal(r.player.combo, "Síncopa doble");
      assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 1.01 + 7) * 1.03);
      emit("combo-gate", {
        side,
        wins,
        combo: r.player.combo,
        hp: r.rival.hp,
        hits: r.player.hits,
      });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, 0),
        attacks = advanced
          ? (["light", "light", "heavy"] as const)
          : (["light", "heavy"] as const);
      for (const action of attacks) {
        for (
          let n = 0;
          n < 70 &&
          (r.player.cooldown ||
            Math.abs(r.rival.x - r.player.x) > 80 ||
            !r.rival.grounded);
          n++
        ) {
          const dx = r.rival.x - r.player.x;
          r.inputs[side].left = dx < -70;
          r.inputs[side].right = dx > 70;
          r.advance(1);
        }
        r.inputs[side].left = r.inputs[side].right = false;
        r.advance(8);
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length);
      assert.equal(
        r.player.combo,
        advanced ? "Síncopa doble" : "Paso de salsa",
      );
      emit("connected-combo", {
        side,
        combo: r.player.combo,
        hits: r.player.hits,
        hp: r.rival.hp,
        elapsed: r.state.tick - INTRO_TOTAL_TICKS,
      });
    }
    for (const [wins, energy] of [
      [0, 100],
      [1, 100],
      [2, 89],
      [2, 90],
      [2, 100],
      [3, 100],
    ] as const) {
      const r = setup(side, 200, wins);
      r.player.energy = energy;
      r.inputs[side].actions.super++;
      r.advance(9);
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "oscar"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (energy < 90) {
        assert.equal(r.player.attack, null);
        assert.equal(r.rival.hp, 100);
      } else {
        assert.equal(r.player.combo, "Cierre del sonero");
        assert.equal(r.player.comboBonus, 12);
        assert.equal(r.state.finale, undefined);
        assert.equal(r.player.attack, null);
      }
      emit("super-gate", {
        side,
        wins,
        energy,
        hp: r.rival.hp,
        attackerEnergy: r.player.energy,
        combo: r.player.combo,
      });
    }
  }
});
