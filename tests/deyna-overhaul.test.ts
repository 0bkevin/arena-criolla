import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type MatchState,
  type Input,
} from "../shared/engine";
import { type FighterId } from "../shared/content";

import { deynaSpecialPose } from "../src/game/finales/deyna";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Deyna", fighter: "deyna" as const, wins: 3 },
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
  const cast = (move: "special" | "super") => {
    inputs[side].actions[move]++;
    advance(1);
    assert.equal(source.energy, move === "special" ? 75 : 10);
  };
  return { state, source, target, inputs, advance, cast };
}

test("one football launches from the contact boot, costs25 at zero wins, and can hit, miss, be blocked or interrupted", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "close", "guard", "miss", "jump", "interrupt"]) {
      const r = setup(
        side,
        mode === "close"
          ? 55
          : mode === "interrupt"
            ? 65
            : mode === "miss"
              ? 900
              : 180,
      );
      r.source.config.wins = 0;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "jump") r.inputs[1 - side].actions.jump++;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      const ids = new Set<number>();
      let launch: (typeof r.state.projectiles)[number] | undefined;
      for (let n = 1; n <= 120; n++) {
        r.advance(1);
        if (n === 1) assert.equal(r.source.energy, 75);
        for (const shot of r.state.projectiles) {
          ids.add(shot.id);
          launch ??= { ...shot };
        }
      }
      if (mode === "hit" || mode === "close") {
        assert.ok(r.target.hp < 100, mode);
        assert.equal(r.source.hits, 1);
      }
      if (["guard", "miss", "interrupt"].includes(mode))
        assert.equal(r.target.hp, 100, mode);
      if (mode === "interrupt") assert.equal(ids.size, 0);
      else if (mode !== "close") assert.equal(ids.size, 1);
      if (launch) {
        assert.equal(launch.kind, "football");
        assert.equal(launch.radius, 13);
        assert.equal(launch.vy, 0);
        assert.equal(launch.growth, undefined);
        assert.equal(launch.homing, undefined);
        assert.equal(launch.returnAfter, undefined);
      }
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.source.attack, null);
    }
  const r = setup();
  r.inputs[0].actions.special++;
  r.advance(20);
  assert.equal(r.state.projectiles.length, 0);
  r.advance(1);
  const shot = r.state.projectiles[0];
  assert.equal(shot.x, r.source.x + 48 + 8);
  assert.equal(shot.y, r.source.y - 16);
  assert.equal(deynaSpecialPose(17), "windup");
  assert.equal(deynaSpecialPose(20), "contact");
  assert.equal(deynaSpecialPose(29), "recover");
  assert.equal(deynaSpecialPose(42), undefined);
});

test("football cost failure and serialized in-flight replay preserve deterministic engine rules", () => {
  for (const side of [0, 1] as const) {
    const poor = setup(side);
    poor.source.energy = 24;
    poor.inputs[side].actions.special++;
    poor.advance(25);
    assert.equal(poor.source.attack, null);
    assert.equal(poor.target.hp, 100);
    const r = setup(side, 450);
    r.cast("special");
    r.advance(25);
    const copy = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      stepMatch(copy, r.inputs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(copy)),
        JSON.parse(JSON.stringify(r.state)),
      );
    }
  }
});
