import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "./helpers/charged-finale-engine";
import { fighterById } from "../shared/content";
import { finaleById } from "../shared/finales";
import { coutureRunwayRange, COUTURE_MODEL_COUNT } from "../shared/couture-runway";
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
