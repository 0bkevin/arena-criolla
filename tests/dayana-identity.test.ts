import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../shared/engine";
import { type FighterId } from "../shared/content";
function setup(side: 0 | 1, rival: FighterId, gap: number) {
  const queen = { name: "Queen", fighter: "dayana" as const, wins: 3 },
    guest = { name: "Guest", fighter: rival, wins: 3 };
  const state = createMatch("caracas", side ? [guest, queen] : [queen, guest]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 750 : 400;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  state.players.forEach((p) => {
    p.invincible = 0;
    p.energy = 100;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
  };
  return { state, source, target, inputs, advance };
}
test("Dayana's radial twirl hits a nearby rival in front or behind, respects guard and spawns no projectile", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["front", "behind", "guard", "miss"]) {
      const r = setup(side, "zavarce", mode === "miss" ? 280 : 95);
      r.source.config.wins = 0;
      for (const player of r.state.players) {
        player.y = WORLD.floor;
        player.grounded = true;
      }
      if (mode === "guard") r.inputs[1 - side].block = true;
      r.inputs[side].actions.special++;
      let lowestHP = 100;
      for (let n = 0; n < 120; n++) {
        if (mode === "behind" && n === 5)
          r.target.x = r.source.x - r.source.facing * 95;
        r.advance(1);
        lowestHP = Math.min(lowestHP, r.target.hp);
        assert.equal(r.state.projectiles.length, 0, mode);
        assert.equal(
          r.state.finale,
          undefined,
          "a twirl never captures the rival",
        );
      }
      if (mode === "front" || mode === "behind") {
        assert.ok(lowestHP < 100, mode);
        assert.equal(r.source.hits, 1, mode);
      } else assert.equal(r.target.hp, 100, mode);
      assert.equal(r.source.attack, null);
    }
});
