import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawZavarceFinale } from "../src/game/finales/zavarce";
import type { FinaleView } from "../src/game/finales/types";
import courier from "../shared/courier-assets.json";

function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Vicente", fighter: "zavarce" as const, wins };
  const rival = { name: "Javier", fighter: "javier" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * 180;
  target.facing = -source.facing;
  source.energy = energy;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}

test("Zavarce seven-rider finale charges 75 once, drains seven equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("zavarce")!.damageBeats;
    assert.equal(beats.length, 7);
    const positions = run.state.players.map((p) => [p.x, p.y]);
    const clock = run.state.tick;
    const timer = run.state.remaining;
    let last = 0;
    for (const [i, beat] of beats.entries()) {
      run.advance(beat - last - 1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * i) / 7)) < 1e-9,
      );
      run.advance(1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * (i + 1)) / 7)) < 1e-9,
      );
      assert.deepEqual(
        run.state.players.map((p) => [p.x, p.y]),
        positions,
      );
      assert.equal(run.state.tick, clock);
      assert.equal(run.state.remaining, timer);
      assert.equal(run.state.projectiles.length, 0);
      last = beat;
    }
    run.inputs[side].actions.special++;
    run.advance(scene.duration - last);
    assert.equal(run.state.finale, undefined);
    assert.equal(run.source.attack, null);
    assert.equal(run.target.stocks, 2);
    assert.equal(run.target.y, WORLD.floor);
    assert.equal(Math.sign(run.target.vx), side ? -1 : 1);
    run.advance(55);
    assert.equal(
      run.state.projectiles.length,
      0,
      "input during capture never queues a summon",
    );
    assert.equal(run.source.attack, null);
  }
});

test("Zavarce definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
  for (const side of [0, 1] as const) {
    for (const [wins, energy] of [
      [0, 100],
      [2, 100],
      [3, 74],
    ]) {
      const run = setup(side, wins, energy);
      run.inputs[side].actions.super++;
      run.advance(9);
      assert.equal(run.state.finale, undefined);
      assert.equal(run.target.hp, 100);
      assert.ok(run.source.energy >= energy);
    }
    for (const defense of ["behind", "guard"] as const) {
      const run = setup(side);
      if (defense === "guard") run.inputs[1 - side].block = true;
      run.inputs[side].actions.super++;
      run.advance(1);
      if (defense === "behind") run.source.facing *= -1;
      run.advance(8);
      assert.equal(run.state.finale, undefined);
      assert.equal(run.target.hp, 100);
    }
    const run = setup(side);
    run.target.hp = 1;
    run.target.stocks = 1;
    run.inputs[side].actions.super++;
    run.advance(9 + 42);
    assert.equal(run.target.hp, 0);
    assert.equal(run.target.stocks, 1);
    assert.equal(run.state.phase, "playing");
    run.advance(180 - 42);
    assert.equal(run.target.stocks, 0);
    assert.equal(run.state.phase, "finished");
    assert.equal(run.state.winner, side);
  }
});

test("seven full courier raster crops are painted in both motion modes, without prop substitutes", () => {
  const image = { width: 896 } as HTMLImageElement;
  for (const motion of [0, 1]) {
    const draws: unknown[][] = [];
    const bodies: string[] = [];
    const view = {
      ctx: { drawImage: (...args: unknown[]) => draws.push(args) },
      actor: "zavarce",
      rival: "javier",
      tick: 90,
      pulse: 1,
      motion,
      images: { [courier.file]: image },
      profile: finaleById("zavarce"),
      point: (x: number, y: number) => ({ x, y }),
      body: (id: string) => bodies.push(id),
      damage() {},
    } as unknown as FinaleView;
    drawZavarceFinale(view);
    assert.equal(draws.length, 7);
    assert.deepEqual(bodies, ["zavarce", "javier"]);
    for (const draw of draws) {
      assert.equal(draw[0], image);
      assert.equal(draw[3], courier.cellWidth);
      assert.equal(draw[4], courier.cellHeight);
      assert.ok(
        (draw[7] as number) > 300,
        "full-size motorcycle, before existing arena scale",
      );
    }
  }
});

test("missing courier bitmap declines before drawing any partial finale", () => {
  const draws: unknown[] = [];
  const view = {
    ctx: {},
    tick: 90,
    motion: 1,
    pulse: 1,
    images: {},
    profile: finaleById("zavarce"),
    body: (...args: unknown[]) => draws.push(args),
  } as unknown as FinaleView;
  assert.equal(drawZavarceFinale(view), false);
  assert.deepEqual(draws, []);
});
