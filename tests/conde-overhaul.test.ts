import assert from "node:assert/strict";
import test from "node:test";
import { fighterById } from "../shared/content";
import {
  cpuInput,
  createMatch,
  emptyInput,
  outgoingDamageMultiplier,
  stepMatch,
  type Input,
} from "./helpers/charged-finale-engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";
import { ATTACK_ART } from "../src/game/attack-art";
import {
  drawTransformationBody,
  transformationPose,
} from "../src/game/transformation-art";

function setup(side: 0 | 1 = 0, gap = 500, wins = 3, energy = 100) {
  const conde = { name: "Conde", fighter: "conde" as const, wins };
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
  source.energy = energy;
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

test("Conde Bond activates at tick9 out of range in either slot with cost and no enemy damage/freeze", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.inputs[side].actions.super++;
    r.advance(8);
    assert.equal(Boolean(r.source.transformation), false);
    r.advance(1);
    assert.equal(r.source.transformation?.ticks, 360);
    assert.equal(r.source.transformation?.id, "conde-bond");
    assert.equal(r.state.finale, undefined);
    assert.equal(r.target.hp, 100);
    assert.equal(r.source.hits, 0);
    close(r.source.energy, 10.28);
    const tick = r.state.tick,
      x = r.target.x;
    r.inputs[1 - side].left = true;
    r.advance(12);
    assert.ok(r.target.x < x);
    assert.equal(r.state.tick, tick + 12);
    assert.equal(r.source.transformation?.ticks, 348);
  }
});

test("self-transform is available from zero wins and respects energy, stun, guard, cooldown, stale input and interrupted startup", () => {
  for (const side of [0, 1] as const) {
    for (const [wins, energy] of [
      [0, 89],
      [0, 90],
      [1, 100],
      [2, 89],
      [2, 90],
    ]) {
      const r = setup(side, 500, wins, energy);
      r.activate();
      assert.equal(!!r.source.transformation, energy >= 90);
    }
    for (const gate of ["stun", "cooldown", "guard", "stale"] as const) {
      const r = setup(side);
      if (gate === "stun") r.source.stun = 20;
      if (gate === "cooldown") r.source.cooldown = 20;
      if (gate === "guard") r.inputs[side].block = true;
      if (gate === "stale") r.source.lastActions.super = 1;
      r.activate();
      assert.equal(r.source.transformation, undefined, gate);
    }
    const r = setup(side, 80);
    r.inputs[side].actions.super++;
    r.inputs[1 - side].actions.light++;
    r.advance(20);
    assert.equal(r.source.transformation, undefined);
    assert.ok(r.source.hp < 100);
  }
});

test("all Conde damage paths get exactly20 percent; real light/heavy/special inputs work and facing guard still blocks", () => {
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

test("movement, jump, block and post-expiry basic attacks remain normal combat", () => {
  const r = setup();
  r.activate();
  r.advance(40);
  const x = r.source.x;
  r.inputs[0].right = true;
  r.advance(10);
  assert.ok(r.source.x > x);
  r.inputs[0].right = false;
  r.inputs[0].actions.jump++;
  r.advance(1);
  assert.equal(r.source.jumps, 1);
  r.advance(65);
  r.inputs[0].block = true;
  r.advance(1);
  assert.ok(r.source.blocking);
  assert.ok(r.source.transformation);
  r.inputs[0].block = false;
  r.advance(360);
  r.target.x = r.source.x + 80;
  r.inputs[0].actions.light++;
  r.advance(8);
  close(
    100 - r.target.hp,
    7 * fighterById("conde").damage * fighterById("javier").armor,
  );
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

test("transformed render poses match contact, recoil and locomotion with safe missing-art fallback", () => {
  const r = setup();
  r.activate();
  r.advance(40);
  const p = r.source;
  assert.equal(transformationPose(p), "ready");
  p.blocking = true;
  assert.equal(transformationPose(p), "guard");
  p.blocking = false;
  p.grounded = false;
  assert.equal(transformationPose(p), "jump");
  p.grounded = true;
  p.vx = 3;
  assert.equal(transformationPose(p), "run");
  p.vx = 0;
  for (const [attack, tick, pose] of [
    ["light", 6, "punch"],
    ["heavy", 11, "kick"],
    ["special", 14, "whirl"],
  ] as const) {
    p.attack = attack;
    p.attackTick = tick;
    assert.equal(transformationPose(p), pose);
  }
  p.stun = 2;
  assert.equal(transformationPose(p), "hurt");
  const draws: unknown[] = [];
  const ctx = new Proxy(
    {
      globalAlpha: 1,
      drawImage(...args: unknown[]) {
        draws.push(args);
      },
    },
    { get: (o, k) => Reflect.get(o, k) ?? (() => {}) },
  ) as unknown as CanvasRenderingContext2D;
  assert.equal(drawTransformationBody(ctx, {}, p, p.x, p.y, 190), false);
  assert.equal(draws.length, 0);
  const image = { width: 2048, height: 1024 } as HTMLImageElement;
  assert.equal(
    drawTransformationBody(
      ctx,
      { [ATTACK_ART.conde.file]: image },
      p,
      p.x,
      p.y,
      190,
    ),
    true,
  );
  assert.equal(draws.length, 1);
  assert.equal(finaleById("conde")!.damageBeats.length, 0);
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
