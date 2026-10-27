import assert from "node:assert/strict";
import test from "node:test";
import { fighterById } from "../shared/content";
import { cpuInput, createMatch, emptyInput, outgoingDamageMultiplier, stepMatch, type Input } from "./helpers/charged-finale-engine";
import { TECHNIQUES } from "../shared/techniques";
function setup(side: 0 | 1 = 0, gap = 500) {
  const conde = { name: "Conde", fighter: "conde" as const, wins: 3 };
  const rival = { name: "Rival", fighter: "javier" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, conde] : [conde, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 800 : 280;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const activate = () => {
    inputs[side].actions.super++;
    advance(9);
  };
  return { state, source, target, inputs, advance, activate, side };
}
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("all Conde damage paths get exactly 20 percent; real light/heavy/special inputs work and facing guard still blocks", () => {
  for (const side of [0, 1] as const)
    for (const action of ["light", "heavy", "special"] as const)
      for (const guard of [false, true]) {
        const damages = [];
        for (const powered of [false, true]) {
          const r = setup(side);
          if (powered) {
            r.activate();
            r.advance(40);
          }
          r.source.energy = 100;
          r.target.x = r.source.x + r.source.facing * 80;
          r.inputs[1 - side].block = guard;
          r.inputs[side].actions[action]++;
          r.advance(30);
          damages.push(100 - r.target.hp);
          assert.equal(r.source.hits, guard ? 0 : 1);
          if (powered) assert.ok(r.source.transformation);
        }
        close(damages[1], damages[0] * 1.2);
        if (!guard) assert.ok(damages[1] > damages[0]);
      }
});

test("360 active ticks expire exactly; hitstop/capture pause time; one use prevents refresh; stocks clear buff", () => {
  const r = setup();
  r.activate();
  r.advance(359);
  assert.equal(r.source.transformation?.ticks, 1);
  assert.equal(outgoingDamageMultiplier(r.source), 1.2);
  r.advance(1);
  assert.equal(r.source.transformation, undefined);
  assert.equal(outgoingDamageMultiplier(r.source), 1);
  const refresh = setup();
  refresh.activate();
  refresh.advance(50);
  refresh.source.energy = 100;
  refresh.activate();
  assert.equal(refresh.source.transformation?.ticks, 301);
  assert.equal(outgoingDamageMultiplier(refresh.source), 1.2);
  close(refresh.source.energy, 100);
  refresh.state.hitstop = 5;
  refresh.advance(5);
  assert.equal(refresh.source.transformation?.ticks, 301);
  refresh.advance(40);
  refresh.target.x = refresh.source.x + 100;
  refresh.target.config.fighter = "capriles";
  refresh.inputs[1].actions.super++;
  refresh.advance(9);
  assert.ok(refresh.state.finale);
  const ticks = refresh.source.transformation!.ticks;
  refresh.advance(180);
  assert.equal(refresh.source.transformation?.ticks, ticks);
  for (const stocks of [1, 2]) {
    const death = setup();
    death.activate();
    death.source.stocks = stocks;
    death.source.hp = 0;
    death.advance(1);
    assert.equal(death.source.transformation, undefined);
    assert.equal(death.source.stocks, stocks - 1);
  }
});

test("transformation state serializes and replays deterministically; hard CPU activates at distance once", () => {
  const r = setup();
  r.activate();
  const copy = JSON.parse(JSON.stringify(r.state));
  for (let i = 0; i < 400; i++) {
    stepMatch(r.state, r.inputs);
    stepMatch(copy, r.inputs);
  }
  assert.deepEqual(r.state, copy);
  const cpu = setup(1);
  cpu.state.tick = 90;
  assert.equal(cpuInput(cpu.state, emptyInput(), "hard").actions.super, 1);
  cpu.activate();
  cpu.state.tick = 180;
  cpu.source.energy = 100;
  assert.equal(cpuInput(cpu.state, emptyInput(), "hard").actions.super, 0);
});
test("shared empowerment snapshots projectile damage once, survives expiry and never compounds on reflections", () => {
  const r = setup();
  r.source.config.fighter = "vallenilla";
  r.target.config.fighter = "carolina";
  r.source.transformation = {
    id: "test-future-form",
    ticks: 40,
    damageMultiplier: 1.2,
  };
  r.inputs[0].actions.special++;
  while (!r.state.projectiles.length && r.state.tick < 40) r.advance(1);
  assert.ok(r.state.projectiles.length);
  const shot = r.state.projectiles[0],
    snapshot = shot.damage;
  close(
    snapshot,
    TECHNIQUES[fighterById("vallenilla").ability].damage *
      fighterById("vallenilla").damage *
      1.2,
  );
  r.source.transformation.ticks = 1;
  // Exercise real reflector windows twice while retaining the same shot object.
  r.target.x = shot.x + 80;
  r.target.y = shot.y + 75;
  r.target.grounded = true;
  r.target.attack = null;
  r.target.cooldown = 0;
  r.inputs[1].actions.special++;
  r.advance(6);
  assert.equal(shot.owner, 1);
  close(shot.damage, snapshot);
  assert.equal(r.source.transformation, undefined);
  r.target.attack = null;
  r.source.config.fighter = "carolina";
  r.source.x = shot.x - 80;
  r.source.y = shot.y + 75;
  r.source.attack = null;
  r.source.cooldown = 0;
  r.source.stun = 0;
  r.source.facing = 1;
  r.inputs[0].actions.special++;
  r.advance(6);
  assert.equal(shot.owner, 0);
  close(shot.damage, snapshot);
});

test("shared empowerment applies to a new counter once", () => {
  const damage = [];
  for (const powered of [false, true]) {
    const r = setup(0, 80);
    r.source.config.fighter = "amanda";
    if (powered)
      r.source.transformation = {
        id: "test-future-form",
        ticks: 360,
        damageMultiplier: 1.2,
      };
    r.inputs[0].actions.special++;
    r.advance(2);
    r.inputs[1].actions.heavy++;
    r.advance(11);
    assert.equal(r.source.countered, true);
    damage.push(100 - r.target.hp);
  }
  assert.ok(damage[0] > 0);
  close(damage[1], damage[0] * 1.2);
});
