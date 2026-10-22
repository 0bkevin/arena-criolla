import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "./helpers/charged-finale-engine";
import { STAGES, type FighterId, type StageId } from "../shared/content";
import {
  ARENA_FINALES,
  REVIEWED_FINALISTS as reviewed,
  activeArenaPerformance,
  isArenaFinalist,
} from "../shared/arena-finales";
import { finaleById } from "../shared/finales";

for (const id of reviewed) {
  test(`${id}: the finale leaves the opponent, arena clock and existing projectiles live`, () => {
    for (const side of [0, 1] as const) {
      const a = { name: id, fighter: id, wins: 3 },
        b = { name: "rival", fighter: "capriles" as const, wins: 3 };
      const state = createMatch("caracas", side ? [b, a] : [a, b]);
      state.phase = "playing";
      const source = state.players[side],
        target = state.players[1 - side];
      source.x = side ? 730 : 350;
      source.facing = side ? -1 : 1;
      target.x = source.x + source.facing * 180;
      target.facing = -source.facing;
      state.players.forEach((p) => {
        p.energy = 100;
        p.invincible = 0;
      });
      const inputs: [Input, Input] = [emptyInput(), emptyInput()];
      inputs[side].actions.super++;
      for (let n = 0; n < 9; n++) stepMatch(state, inputs);
      assert.equal(state.finale, undefined, `${id}: no global capture`);
      const tick = state.tick,
        remaining = state.remaining;
      state.projectiles.push({
        id: state.nextId++,
        owner: side,
        x: WORLD.left,
        y: WORLD.floor - 230,
        vx: 1,
        life: 60,
        damage: 1,
        kind: "test",
      });
      const shot = state.projectiles.at(-1)!;
      inputs[1 - side].actions.jump++;
      for (let n = 0; n < 6; n++) stepMatch(state, inputs);
      assert.ok(state.tick > tick, `${id}: combat clock advances`);
      assert.ok(state.remaining < remaining, `${id}: timer advances`);
      assert.ok(target.y < WORLD.floor, `${id}: the opponent can jump`);
      assert.ok(
        (shot.age ?? 0) > 0,
        `${id}: existing projectiles keep travelling`,
      );
    }
  });
}

function setup(
  id: FighterId,
  side: 0 | 1 = 0,
  gap = 90,
  stage: StageId = "caracas",
  rival: FighterId = "capriles",
) {
  const a = { name: id, fighter: id, wins: 3 },
    b = { name: "rival", fighter: rival, wins: 3 };
  const state = createMatch(stage, side ? [b, a] : [a, b]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 720 : 360;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n = 1) => {
    for (let t = 0; t < n; t++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
    advance(9);
  };
  return { state, source, target, inputs, advance, start };
}

for (const id of reviewed.filter(isArenaFinalist)) {
  test(`${id}: cost, one active field, spatial misses and vulnerable startup from zero wins`, () => {
    for (const side of [0, 1] as const) {
      for (const reason of ["energy", "air", "guard", "interrupt"]) {
        const r = setup(id, side, 65);
        r.source.config.wins = 0;
        if (reason === "energy") r.source.energy = 89;
        if (reason === "air") {
          r.source.grounded = false;
          r.source.y -= 90;
        }
        if (reason === "guard") r.inputs[side].block = true;
        if (reason === "interrupt") {
          r.inputs[1 - side].actions.light++;
          r.advance(3);
        }
        r.start();
        assert.equal(r.state.fieldFinales, undefined, `${id}/${reason}`);
        assert.equal(r.state.finale, undefined);
        assert.equal(r.source.hits, 0);
      }
      const r = setup(id, side);
      r.source.config.wins = 0;
      r.inputs[side].actions.super++;
      r.advance();
      assert.equal(r.source.energy, 10);
      // Move out of the entire forward path during startup, not just a timed hit beat.
      r.target.x = r.source.x - r.source.facing * 260;
      r.advance(8);
      assert.equal(r.state.fieldFinales?.length, 1);
      r.source.energy = 100;
      r.source.cooldown = 0;
      r.inputs[side].actions.super++;
      r.advance();
      assert.equal(
        r.source.energy,
        100,
        "active field cannot be refreshed for another debit",
      );
      r.advance(360);
      assert.equal(
        r.target.hp,
        100,
        `${id}: walking out of the path avoids all damage`,
      );
      assert.equal(r.target.stocks, 2);
      assert.equal(r.source.hits, 0);
      assert.equal(r.state.fieldFinales, undefined);
      assert.equal(r.source.attack, null);
    }
  });
  test(`${id}: real contacts, immediate stock resolution and interruption remain ordinary combat`, () => {
    for (const side of [0, 1] as const) {
      const hit = setup(id, side);
      hit.start();
      hit.advance(190);
      assert.ok(
        hit.source.hits > 0,
        `${id}: a reachable idle rival can be hit`,
      );
      assert.ok(hit.target.hp < 100 || hit.target.stocks < 2);
      assert.equal(hit.state.finale, undefined);
      const lethal = setup(id, side);
      lethal.target.hp = 1;
      lethal.target.stocks = 1;
      lethal.start();
      lethal.advance(270);
      assert.equal(lethal.target.stocks, 0, id);
      assert.equal(lethal.state.phase, "finished");
      assert.equal(lethal.state.finale, undefined);
      const interrupted = setup(id, side, 550);
      interrupted.start();
      interrupted.state.projectiles.push({
        id: interrupted.state.nextId++,
        owner: 1 - side,
        x: interrupted.source.x,
        y: interrupted.source.y - 75,
        vx: 0,
        life: 10,
        kind: "test",
        damage: 2,
        force: 2,
        radius: 30,
      });
      interrupted.advance(12);
      assert.ok(interrupted.source.hp < 100);
      assert.equal(
        activeArenaPerformance(interrupted.state, interrupted.source),
        undefined,
      );
      assert.ok(
        interrupted.source.cooldown < 40,
        "interruption does not strand performance recovery",
      );
      interrupted.source.hp = 0;
      interrupted.advance(10);
      assert.equal(
        interrupted.state.fieldFinales,
        undefined,
        "stock loss removes owned helpers",
      );
    }
  });
}

test("each cavalry rider, courier and truck crosses the defender once and remains visible after contact", () => {
  for (const [id, helpers] of [
    ["bolivar", 6],
    ["gomez", 2],
    ["zavarce", 7],
    ["lorenzo", 2],
  ] as const)
    for (const side of [0, 1] as const) {
      const r = setup(id, side, 210);
      r.start();
      const seen = new Map<number, number>(),
        contacted = new Set<number>();
      let passed = false;
      for (let n = 0; n < 300; n++) {
        r.advance();
        for (const actor of r.state.fieldFinales?.[0]?.actors ?? []) {
          if (actor.connected) {
            contacted.add(actor.id);
            assert.ok(
              actor.life > 0,
              "a physical hit does not erase a passing mount",
            );
          }
          passed ||=
            actor.connected && (actor.x - r.target.x) * actor.direction > 40;
          seen.set(actor.id, actor.index);
        }
      }
      assert.equal(
        seen.size,
        helpers,
        `${id}: every helper is a distinct actor`,
      );
      assert.equal(new Set(seen.values()).size, helpers);
      assert.ok(contacted.size > 0 && contacted.size <= helpers);
      assert.ok(passed, `${id}: a mount continues past the rival`);
      assert.ok(r.source.hits <= helpers + (id === "zavarce" ? 0 : 1));
      assert.ok(
        r.source.x >= WORLD.left && r.source.x <= WORLD.right,
        "the performer dismounts inside the arena instead of teleporting back",
      );
    }
});

test("guard keeps its chosen direction while a mounted attacker crosses it", () => {
  for (const id of [
    "bolivar",
    "gomez",
    "zavarce",
    "mcm",
    "lorenzo",
    "simon",
  ] as const)
    for (const side of [0, 1] as const) {
      const r = setup(id, side, 190);
      r.inputs[1 - side].block = true;
      const facing = r.target.facing;
      r.start();
      for (let n = 0; n < 310; n++) {
        r.advance();
        if (r.state.fieldFinales?.some((f) => f.owner === side))
          assert.equal(
            r.target.facing,
            facing,
            "guard stays oriented during the passing formation",
          );
      }
      assert.equal(r.target.hp, 100, id);
      assert.equal(r.source.hits, 0, id);
      assert.ok(r.state.tick > 250);
    }
});

test("notes, waves and Coco transfers reflect with retained damage and artwork", () => {
  for (const id of ["oscar", "ali", "dudamel", "kevin"] as const)
    for (const side of [0, 1] as const) {
      const r = setup(id, side, 310, "caracas", "carolina");
      r.start();
      r.advance(13); // first emission is now in flight
      const shot = r.state.projectiles.find((p) => p.impact === "super");
      assert.ok(shot, id);
      if (id === "dudamel")
        assert.equal(
          shot.kind,
          "cadenza",
          "the orchestral waves retain their musical notation artwork",
        );
      const damage = shot.damage,
        art = shot.finaleArt;
      r.inputs[1 - side].actions.special++;
      let reflected = false;
      for (let i = 0; i < 70; i++) {
        r.advance();
        if (shot.owner === 1 - side) {
          reflected = true;
          assert.equal(shot.damage, damage);
          assert.deepEqual(shot.finaleArt, art);
        }
      }
      assert.ok(reflected, id);
    }
});

test("local traps permit an escape jump; no root or field survives stock loss", () => {
  for (const id of ["puma", "chataing", "llorona"] as const)
    for (const side of [0, 1] as const) {
      const r = setup(id, side, 90);
      r.start();
      for (let n = 0; n < 100 && !r.target.rootTicks; n++) r.advance();
      assert.ok(r.target.rootTicks > 0, id);
      assert.ok(r.target.rootKind, id);
      // Hitstop is the ordinary short impact pause, never a scene clock.
      for (let n = 0; n < 30 && (r.target.stun || r.state.hitstop); n++)
        r.advance();
      r.inputs[1 - side].actions.jump++;
      r.advance();
      assert.ok(r.target.vy < 0, id);
      assert.equal(r.target.rootTicks, 0);
      assert.equal(r.target.rootKind, undefined);
    }
});

test("all live fields replay deterministically on every stage, including both ledges and simultaneous casts", () => {
  for (const id of reviewed.filter(isArenaFinalist))
    for (const stage of STAGES)
      for (const side of [0, 1] as const) {
        const r = setup(id, side, 350, stage.id, id);
        r.source.x = side ? WORLD.right - 35 : WORLD.left + 35;
        r.target.x = r.source.x + r.source.facing * 350;
        r.inputs[0].actions.super++;
        r.inputs[1].actions.super++;
        r.advance(9);
        assert.equal(r.state.fieldFinales?.length, 2);
        const saved = JSON.parse(JSON.stringify(r.state));
        for (let n = 0; n < 280; n++) {
          if (n === 35) {
            r.inputs[0].actions.jump++;
            r.inputs[1].actions.jump++;
          }
          r.advance();
          stepMatch(saved, r.inputs);
          assert.deepEqual(saved, r.state, `${id}/${stage.id}/${side}/${n}`);
          for (const p of r.state.players)
            assert.ok([p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite));
          assert.equal(r.state.finale, undefined);
        }
        assert.equal(r.state.fieldFinales, undefined);
      }
});

