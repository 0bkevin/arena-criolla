import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawRennyFinale } from "../src/game/finales/renny";
import type { FinaleView } from "../src/game/finales/types";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";
import { finaleArenaLayout } from "../src/game/finale-layout";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("Renny keeps the generated originals and canonical fighter/entrance identity unchanged", async () => {
  const report = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/renny/provenance.json",
      "utf8",
    ),
  );
  for (const [path, expected] of Object.entries({
    ...report.rawFiles,
    ...report.canonicalSha256,
  }))
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      expected,
    );
});

test("Renny's helpers stay on the captured rival's surface at unequal heights", () => {
  const sheet = ATTACK_ART.renny;
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(9);
    run.target.y -= 42;
    const layout = finaleArenaLayout(run.state)!;
    const view = {
      tick: 138,
      motion: 1,
      pulse: 1,
      profile: finaleById("renny"),
      images: { [sheet.file]: { width: 1024, height: 1024 } },
      point: layout.point,
      art(pose: string, x: number, y: number) {
        if (pose !== "ladder")
          assert.ok(
            Math.abs(layout.point(x, y).y - layout.point(785, 516).y) < 1e-9,
          );
        return true;
      },
      body() {},
      bubble() {},
      damage() {},
    } as unknown as FinaleView;
    assert.equal(drawRennyFinale(view), true);
  }
});

test("Renny's commercial selects three full art crops with alternating kicks and a joint push, including reduced motion", () => {
  const sheet = ATTACK_ART.renny;
  const image = { width: 1024, height: 1024 } as HTMLImageElement;
  for (const motion of [0, 1])
    for (const [tick, poses] of [
      [18, ["ladder", "present", "present"]],
      [42, ["ladder", "kick", "present"]],
      [90, ["ladder", "present", "kick"]],
      [138, ["ladder", "push", "push"]],
    ] as const) {
      const crops: unknown[][] = [],
        bodies: unknown[][] = [],
        selected: string[] = [];
      const ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        translate() {},
        scale() {},
        drawImage: (...args: unknown[]) => crops.push(args),
      } as unknown as CanvasRenderingContext2D;
      const view = {
        tick,
        motion,
        pulse: tick === 18 ? 0 : 1,
        actor: "renny",
        rival: "zavarce",
        images: { [sheet.file]: image },
        profile: finaleById("renny"),
        point: (x: number, y: number) => ({ x, y }),
        art(
          pose: string,
          x: number,
          y: number,
          h: number,
          facing = 1,
          alpha = 1,
        ) {
          selected.push(pose);
          assert.equal(y, 516, "support foot baseline remains grounded");
          return drawAttackArt(
            ctx,
            { [sheet.file]: image },
            "renny",
            pose,
            x,
            y,
            h,
            facing,
            alpha,
          );
        },
        body: (...args: unknown[]) => bodies.push(args),
        bubble() {},
        damage() {},
      } as unknown as FinaleView;
      assert.equal(drawRennyFinale(view), true);
      assert.deepEqual(selected, poses);
      assert.equal(crops.length, 3);
      for (const [i, pose] of poses.entries()) {
        const frame = sheet.frames[pose];
        assert.deepEqual(crops[i].slice(1, 5), [
          frame.x,
          frame.y,
          frame.width,
          frame.height,
        ]);
      }
      assert.deepEqual(bodies, [
        ["zavarce", 785, 516, 288, -1, tick === 18 ? "stand" : "hurt"],
      ]);
    }
});

test("Renny's painted body anchors stay at both captured world positions, including unequal heights", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(9);
    run.target.y -= 42;
    const layout = finaleArenaLayout(run.state)!;
    for (const [x, feet, player] of [
      [273, 516, run.source],
      [785, 516, run.target],
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

test("Renny refuses missing or unloaded artwork before painting any partial scene", () => {
  const sheet = ATTACK_ART.renny;
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
    assert.equal(drawRennyFinale(view), false);
    assert.deepEqual(painted, []);
  }
  const point = sheet.frames.push;
  const painted: unknown[] = [];
  try {
    delete sheet.frames.push;
    assert.equal(
      drawRennyFinale({
        images: { [sheet.file]: { width: 1024, height: 1024 } },
        art: (...args: unknown[]) => painted.push(args),
        body: (...args: unknown[]) => painted.push(args),
      } as unknown as FinaleView),
      false,
    );
    assert.deepEqual(painted, []);
  } finally {
    sheet.frames.push = point;
  }
});

function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Renny", fighter: "renny" as const, wins };
  const rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
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

test("Renny commercial finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("renny")!.damageBeats;
    assert.equal(beats.length, 3);
    const positions = run.state.players.map((p) => [p.x, p.y]);
    const clock = run.state.tick;
    const timer = run.state.remaining;
    let last = 0;
    for (const [i, beat] of beats.entries()) {
      run.advance(beat - last - 1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * i) / 3)) < 1e-9,
      );
      run.advance(1);
      assert.ok(
        Math.abs(run.target.hp - (100 - (scene.damage * (i + 1)) / 3)) < 1e-9,
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

test("Renny definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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
