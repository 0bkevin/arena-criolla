import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "./helpers/charged-finale-engine";
import { fighterById } from "../shared/content";
import { finaleById } from "../shared/finales";
import { coutureRunwayRange, COUTURE_MODEL_COUNT, COUTURE_MODEL_CUES } from "../shared/couture-runway";
import { ARENA_FINALES, arenaFinaleContacts } from "../shared/arena-finales";
function setup(side: 0 | 1, gap = 180) {
  const a = { name: "Carolina", fighter: "carolina" as const, wins: 3 },
    b = { name: "Rival", fighter: "capriles" as const, wins: 3 },
    state = createMatch("caracas", side ? [b, a] : [a, b]);
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
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
    advance(9);
  };
  return { state, source, target, inputs, advance, start };
}

test("Carolina's four distinct models make four physical, single-use contacts on either side", () => {
  assert.equal(finaleById("carolina")!.mode, "field");
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.start();
    const field = r.state.fieldFinales![0];
    assert.equal(
      field.actors?.length ?? 0,
      0,
      "the models wait for her summon signal",
    );
    const seen = new Map<number, number>();
    const connected = new Set<number>();
    for (let n = 0; n < 240; n++) {
      for (const a of field.actors ?? []) {
        seen.set(a.id, a.index);
        if (a.connected) connected.add(a.index);
      }
      r.advance();
      assert.equal(
        r.state.finale,
        undefined,
        "no global capture or staged defender",
      );
    }
    assert.equal(seen.size, COUTURE_MODEL_COUNT);
    assert.deepEqual([...seen.values()], [0, 1, 2, 3]);
    assert.equal(connected.size, 4);
    assert.equal(r.source.hits, 4);
    assert.ok(
      Math.abs(
        r.target.hp - (100 - field.damage * fighterById("capriles").armor),
      ) < 1e-8,
    );
    assert.equal(r.state.fieldFinales, undefined);
  }
});

test("the procession can be guarded or escaped, and cannot hit a rival above the runway", () => {
  for (const side of [0, 1] as const) {
    const guarded = setup(side);
    guarded.inputs[1 - side].block = true;
    guarded.start();
    guarded.advance(250);
    assert.equal(guarded.target.hp, 100);
    assert.equal(guarded.source.hits, 0);
    const missed = setup(side);
    missed.start();
    missed.target.x = missed.source.x - missed.source.facing * 260;
    missed.advance(250);
    assert.equal(missed.target.hp, 100);
    const above = setup(side);
    above.start();
    above.advance(COUTURE_MODEL_CUES[0]);
    const model = above.state.fieldFinales![0].actors![0];
    above.target.x = model.x;
    above.target.y = model.y - 180;
    assert.equal(
      arenaFinaleContacts(above.state).length,
      0,
      "no damage outside the visible body height",
    );
  }
});

test("Carolina regains control while her runway, rival, timer and projectiles keep running", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 550);
    r.start();
    const tick = r.state.tick,
      remaining = r.state.remaining;
    r.inputs[1 - side].actions.jump++;
    const shot = {
      id: r.state.nextId++,
      owner: side,
      x: 100,
      y: WORLD.floor - 240,
      vx: 1,
      life: 100,
      age: 0,
      damage: 1,
      kind: "test",
    };
    r.state.projectiles.push(shot);
    r.advance(6);
    assert.ok(r.target.y < WORLD.floor);
    assert.ok(shot.age > 0);
    r.advance(ARENA_FINALES.carolina.recovery);
    assert.equal(r.source.attack, null);
    assert.ok(r.state.fieldFinales?.[0].actors?.length);
    const x = r.source.x;
    r.inputs[side][side ? "right" : "left"] = true;
    r.advance(8);
    assert.ok(Math.abs(r.source.x - x) > 10);
    assert.ok(r.state.tick > tick);
    assert.ok(r.state.remaining < remaining);
    assert.equal(r.state.finale, undefined);
  }
});

test("the runway and all model feet remain inside the arena at both walls and raised platforms", () => {
  for (const direction of [-1, 1])
    for (const x of [WORLD.left + 35, 540, WORLD.right - 35]) {
      const range = coutureRunwayRange({ x, direction });
      assert.ok(range.left >= WORLD.left);
      assert.ok(range.right <= WORLD.right);
      assert.ok(
        direction > 0 ? range.left > x : range.right < x,
        "the caller stands outside the runway at either wall",
      );
      const r = setup(0, 550);
      r.source.x = x;
      r.source.facing = direction;
      r.start();
      const field = r.state.fieldFinales![0];
      const actualRange = coutureRunwayRange(field);
      field.y -= 120;
      for (const model of field.actors ?? []) {
        model.y = field.y;
        model.previousY = field.y;
      }
      for (let n = 0; n < 180; n++) {
        r.advance();
        for (const model of field.actors ?? []) {
          assert.ok(
            model.x >= actualRange.left && model.x <= actualRange.right,
          );
          assert.equal(model.y, field.y);
          assert.equal(model.vy, 0);
        }
      }
    }
});
