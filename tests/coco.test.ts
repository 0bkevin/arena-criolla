import test from "node:test";
import assert from "node:assert/strict";
import { type FighterId } from "../shared/content";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "./helpers/charged-finale-engine";
import { TECHNIQUES } from "../shared/techniques";
function setup(side: 0 | 1, gap = 400, rival: FighterId = "capriles") {
  const config = { name: "Coco", fighter: "kevin" as const, wins: 3 },
    other = { name: "Rival", fighter: rival, wins: 3 },
    state = createMatch("caracas", side ? [other, config] : [config, other]);
  state.phase = "playing";
  const player = state.players[side],
    target = state.players[1 - side];
  player.x = side ? 850 : 350;
  player.facing = side ? -1 : 1;
  target.x = player.x + player.facing * gap;
  target.facing = -player.facing;
  for (const p of state.players) {
    p.y = WORLD.floor;
    p.grounded = true;
    p.invincible = 0;
    p.energy = 100;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
  };
  return { state, player, target, inputs, advance };
}
test("Coco's two paid special pulses travel before contact and can be guarded or missed on either side", () => {
  for (const side of [0, 1] as const)
    for (const mode of [
      "hit",
      "guard",
      "miss",
      "energy",
      "interrupt",
    ] as const) {
      const r = setup(side, mode === "interrupt" ? 70 : 400),
        origin = r.player.x;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "energy") r.player.energy = 24;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      r.advance(1);
      if (mode === "energy" || mode === "interrupt") {
        r.advance(80);
        assert.equal(r.player.hits, 0);
        assert.equal(r.state.projectiles.length, 0);
        continue;
      }
      assert.equal(r.player.energy, 75);
      if (mode === "miss") r.target.x = r.player.x - r.player.facing * 280;
      r.advance(TECHNIQUES.remittance.startup - 1);
      assert.equal(r.state.projectiles.length, 1);
      assert.equal(r.target.hp, 100, "startup does not assign remote damage");
      r.advance(14);
      assert.equal(r.state.projectiles.length, 2);
      assert.equal(new Set(r.state.projectiles.map((s) => s.id)).size, 2);
      assert.ok(
        r.state.projectiles.every(
          (s) =>
            s.kind === "remittance" &&
            Math.sign(s.vx) === (side ? -1 : 1) &&
            s.homing === undefined,
        ),
      );
      r.advance(140);
      assert.equal(r.player.x, origin);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.state.projectiles.length, 0);
      if (mode === "hit") assert.ok(r.target.hp < 100);
      else assert.equal(r.target.hp, 100);
    }
});
test("the Coco finale emits five independent physical transfers, retains live movement and causes no remote damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 240);
    r.inputs[side].actions.super++;
    r.advance(1);
    assert.equal(r.player.energy, 10);
    r.advance(8);
    r.target.x = r.player.x - r.player.facing * 300;
    r.inputs[1 - side].actions.jump++;
    const emitted = new Map<number, string>();
    const tick = r.state.tick,
      remaining = r.state.remaining;
    for (let n = 0; n < 220; n++) {
      r.advance(1);
      for (const shot of r.state.projectiles) {
        assert.equal(shot.kind, "remittance");
        assert.equal(shot.finaleArt?.fighter, "kevin");
        assert.equal(shot.homing, undefined);
        emitted.set(shot.id, shot.finaleArt!.pose);
      }
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
    }
    assert.deepEqual(
      [...emitted.values()],
      ["token", "receipt", "token", "receipt", "token"],
    );
    assert.ok(r.state.tick > tick && r.state.remaining < remaining);
    assert.equal(r.state.fieldFinales, undefined);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.player.attack, null);
  }
});
