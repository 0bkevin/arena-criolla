import assert from "node:assert/strict";
import test from "node:test";
import { type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, type Input } from "./helpers/charged-finale-engine";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Melanio", fighter: "melanio" as const, wins: 3 },
    b = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [b, a] : [a, b]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  return { state, source, target, inputs, advance };
}

test("Melanio's signal is one packet that reverses toward its owner and expires; guard and interruption stop it", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "guard", "miss", "interrupt"]) {
      const r = setup(
        side,
        mode === "miss" ? 600 : mode === "interrupt" ? 65 : 180,
      );
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.heavy++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      const shots = new Set<number>();
      let outbound = false,
        returned = false;
      for (let n = 1; n <= 100; n++) {
        r.advance(1);
        for (const p of r.state.projectiles) {
          shots.add(p.id);
          if ((p.age ?? 0) < (p.returnAfter ?? Infinity))
            outbound ||= Math.sign(p.vx) === r.source.facing;
          else returned ||= Math.sign(p.vx) === -r.source.facing;
        }
      }
      assert.equal(shots.size, mode === "interrupt" ? 0 : 1, mode);
      if (mode === "hit") assert.ok(r.target.hp < 100);
      else assert.equal(r.target.hp, 100, mode);
      if (mode === "miss")
        assert.ok(
          outbound && returned,
          "the same packet really reverses velocity before expiry",
        );
      assert.equal(r.source.attack, null);
      assert.equal(r.state.projectiles.length, 0);
    }
});

test("the returning signal can contact the rival on its return leg and counts once", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 120, "javier");
    // Outbound contact is suppressed so only the return leg can connect.
    r.target.invincible = 1000;
    r.inputs[side].actions.special++;
    let reversed = false;
    for (let frame = 0; frame < 70; frame++) {
      r.advance(1);
      const shot = r.state.projectiles.find((p) => p.owner === side);
      if (
        !reversed &&
        shot &&
        (shot.age ?? 0) >= (shot.returnAfter ?? Infinity)
      ) {
        reversed = true;
        r.target.invincible = 0;
      }
    }
    assert.ok(reversed, "the signal reversed");
    assert.ok(r.target.hp < 100, "the returning packet contacts the rival");
    assert.equal(r.source.hits, 1);
  }
});
