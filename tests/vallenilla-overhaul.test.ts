import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawVallenillaFinale } from "../src/game/finales/vallenilla";
import type { FinaleView } from "../src/game/finales/types";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";
import { finaleArenaLayout } from "../src/game/finale-layout";

test("Pedro's painted body anchors stay at both captured world positions, including unequal heights", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(9);
    run.target.y -= 42;
    const layout = finaleArenaLayout(run.state)!;
    for (const [x, feet, player] of [
      [296, 508, run.source],
      [724, 508, run.target],
    ] as const) {
      const point = layout.point(x, feet);
      assert.ok(
        Math.abs(
          layout.originX +
            (point.x - 540) * layout.scale * layout.direction -
            player.x,
        ) < 1e-9,
      );
      assert.ok(
        Math.abs(layout.originY + (point.y - 516) * layout.scale - player.y) <
          1e-9,
      );
    }
  }
});

test("Pedro paints exactly two complete mascot crops; six beats alternate jab, hook and uppercut", () => {
  const sheet = ATTACK_ART.vallenilla;
  const image = { width: 1536, height: 1024 } as HTMLImageElement;
  for (const motion of [0, 1])
    for (const [beat, tick] of finaleById(
      "vallenilla",
    )!.damageBeats.entries()) {
      const calls: { pose: string; facing: number; height: number }[] = [];
      const crops: unknown[][] = [];
      const ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        translate() {},
        scale() {},
        drawImage: (...args: unknown[]) => crops.push(args),
      } as unknown as CanvasRenderingContext2D;
      const view = {
        point: (x: number, y: number) => ({ x, y }),
        tick,
        motion,
        pulse: 1,
        actor: "vallenilla",
        rival: "javier",
        images: { [sheet.file]: image },
        profile: finaleById("vallenilla"),
        art(
          pose: string,
          x: number,
          feet: number,
          height: number,
          facing = 1,
          alpha = 1,
        ) {
          calls.push({ pose, facing, height });
          return drawAttackArt(
            ctx,
            { [sheet.file]: image },
            "vallenilla",
            pose,
            x,
            feet,
            height,
            facing,
            alpha,
          );
        },
        body() {},
        damage() {},
      } as unknown as FinaleView;
      assert.equal(drawVallenillaFinale(view), true);
      assert.equal(
        crops.length,
        3,
        "Pedro and two helpers use loaded sheet crops",
      );
      assert.equal(calls[0].pose, "summon");
      const helpers = calls.slice(1);
      assert.deepEqual(
        helpers.map((helper) => helper.facing),
        [1, -1],
      );
      assert.deepEqual(
        helpers.map((helper) => helper.height),
        [236, 260],
      );
      assert.equal(
        helpers[beat % 2].pose,
        ["jab", "hook", "uppercut"][Math.floor(beat / 2)],
      );
      assert.equal(helpers[1 - (beat % 2)].pose, "guard");
      crops.forEach((crop, i) => {
        const frame = sheet.frames[calls[i].pose];
        assert.equal(crop[0], image);
        assert.deepEqual(crop.slice(1, 5), [
          frame.x,
          frame.y,
          frame.width,
          frame.height,
        ]);
      });
    }
});

test("Pedro refuses missing or unloaded artwork before painting any partial scene", () => {
  const sheet = ATTACK_ART.vallenilla;
  for (const image of [
    undefined,
    { width: 1536, height: 0 },
    { width: 0, height: 1024 },
  ]) {
    const painted: unknown[] = [];
    const view = {
      images: image ? { [sheet.file]: image } : {},
      art: (...args: unknown[]) => painted.push(args),
      body: (...args: unknown[]) => painted.push(args),
    } as unknown as FinaleView;
    assert.equal(drawVallenillaFinale(view), false);
    assert.deepEqual(painted, []);
  }
});

function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Pedro", fighter: "vallenilla" as const, wins };
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

test("Pedro two-mascot finale charges 75 once, drains six equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("vallenilla")!.damageBeats;
    assert.equal(beats.length, 6);
    const positions = run.state.players.map((p) => [p.x, p.y]);
    const clock = run.state.tick;
    const timer = run.state.remaining;
    let last = 0;
    for (const [i, beat] of beats.entries()) {
      run.advance(beat - last - 1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * i) / 6)) < 1e-9,
      );
      run.advance(1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * (i + 1)) / 6)) < 1e-9,
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

test("Pedro definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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
    run.advance(9 + 44);
    assert.equal(run.target.hp, 0);
    assert.equal(run.target.stocks, 1);
    assert.equal(run.state.phase, "playing");
    run.advance(180 - 44);
    assert.equal(run.target.stocks, 0);
    assert.equal(run.state.phase, "finished");
    assert.equal(run.state.winner, side);
  }
});
