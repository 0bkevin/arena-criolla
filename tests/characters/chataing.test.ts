import assert from "node:assert/strict";
import test from "node:test";
import type { FighterId } from "../../shared/roster/roster";
import {
  type Input,
  type MatchState,
  createMatch,
  emptyInput,
  stepMatch,
} from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/engine/presentation";
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Luis", fighter: "chataing" as const, wins: 3 },
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
test("wired microphone physically connects once, stays attached through block/hit and is caught on both sides", () => {
  for (const side of [0, 1] as const)
    for (const gap of [180, 420])
      for (const guard of [false, true]) {
        const r = setup(side, gap);
        r.inputs[1 - side].block = guard;
        r.cast("special");
        let impact = false,
          consumed = false,
          lastDistance = Infinity,
          paid = r.source.energy;
        for (let n = 1; n < 110; n++) {
          const hp = r.target.hp;
          r.advance(1);
          const shot = r.state.projectiles[0];
          if (r.target.hp < hp) {
            impact = true;
            assert.ok(shot);
            assert.ok(Math.abs(shot.x - r.target.x) < 32);
            assert.equal(shot.returning, true);
            assert.equal(shot.connected, true);
          }
          if (shot?.connected) consumed = true;
          if (shot?.returning) {
            const d = Math.hypot(
              shot.x - (r.source.x + (shot.direction ?? 1) * -9),
              shot.y - (r.source.y - 129),
            );
            assert.ok(d <= lastDistance + 1e-8);
            lastDistance = d;
          }
        }
        assert.equal(r.source.attack, null);
        assert.equal(r.state.projectiles.length, 0);
        assert.equal(paid, 75);
        const hit = gap < 340 && !guard;
        assert.equal(impact, hit);
        assert.equal(r.source.hits, Number(hit));
        if (!hit) assert.equal(r.target.hp, 100);
        if (gap < 340) assert.equal(consumed, true);
      }
});

test("tether follows a jumping owner, serializes, suppresses duplicate casts and recalls after interruption", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 420);
    r.cast("special");
    r.advance(11);
    assert.equal(r.state.projectiles.length, 1);
    r.inputs[side].actions.jump++;
    r.advance(4);
    const copy: MatchState = JSON.parse(JSON.stringify(r.state));
    r.source.cooldown = 0;
    copy.players[side].cooldown = 0;
    r.inputs[side].actions.special++;
    const energy = r.source.energy;
    r.advance(1);
    stepMatch(copy, r.inputs);
    assert.deepEqual(JSON.parse(JSON.stringify(r.state)), copy);
    assert.ok(r.source.energy >= energy);
    assert.equal(r.state.projectiles.length, 1);
    r.source.attack = null;
    r.source.stun = 12;
    for (let n = 0; n < 90; n++) r.advance(1);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.target.hp, 100);
  }
});

test("Carolina parries the wired head back to its original owner without stealing its cable or damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 300, "carolina");
    r.inputs[1 - side].actions.special++;
    r.cast("special");
    let reflected = false;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) {
        assert.equal(p.owner, side);
        if (p.returning && p.connected) reflected = true;
      }
    }
    assert.ok(reflected);
    assert.equal(r.source.hp, 100);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.source.attack, null);
  }
});

/** A full match start, intro included, rather than a match already in play. */
function setupAfterIntro(side: 0 | 1 = 0) {
  const configs = [
    { name: "Audit Chataing", fighter: "chataing" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ];
  const state = createMatch(
    "poliedro",
    side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]],
    "chataing-v28-audit",
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    rival = state.players[1 - side];
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("the wired microphone turns back and is caught by its owner instead of passing through", () => {
  for (const side of [0, 1] as const) {
    const direction = side === 0 ? 1 : -1,
      r = setupAfterIntro(side);
    r.player.x = side === 0 ? 400 : 680;
    r.rival.x = r.player.x + direction * 400;
    const origin = r.player.x,
      path: { x: number; returning: boolean }[] = [];
    r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles)
        path.push({ x: p.x, returning: !!p.returning });
    }
    const turn = path.findIndex((p) => p.returning);
    assert.ok(turn > 0, "the microphone must travel out before returning");
    // On the turning frame it already moves back toward the owner.
    assert.ok((path[turn].x - path[turn - 1].x) * direction < 0);
    assert.ok(path.slice(turn).every((p) => p.returning));
    // It is caught in front of the owner and never travels behind them.
    assert.ok(path.every((p) => (p.x - origin) * direction > -10));
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.player.x, origin);
    assert.equal(r.player.hp, 100);
    assert.equal(r.rival.hp, 100);
    assert.equal(r.player.attack, null);
  }
});
