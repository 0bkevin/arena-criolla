import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawJavierFinale } from "../src/game/finales/javier";
import type { FinaleView } from "../src/game/finales/types";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";
import { finaleArenaLayout } from "../src/game/finale-layout";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

test("Javier preserves original generated pixels while padding the odd-width sheet, and leaves the v43 identity intact", async () => {
  const report = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/javier/provenance.json",
      "utf8",
    ),
  );
  const hash = (bytes: Buffer) =>
    createHash("sha256").update(bytes).digest("hex");
  const original = await readFile(report.raw),
    padded = await readFile(report.grid);
  assert.equal(hash(original), report.rawSha256);
  assert.equal(hash(padded), report.gridSha256);
  const raw = await sharp(original)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const grid = await sharp(padded)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(grid.info.width, raw.info.width + 1);
  assert.equal(grid.info.height, raw.info.height);
  for (let y = 0; y < raw.info.height; y++) {
    assert.ok(
      raw.data
        .subarray(y * raw.info.width * 4, (y + 1) * raw.info.width * 4)
        .equals(
          grid.data.subarray(
            y * grid.info.width * 4,
            y * grid.info.width * 4 + raw.info.width * 4,
          ),
        ),
    );
    assert.equal(grid.data[(y * grid.info.width + raw.info.width) * 4 + 3], 0);
  }
  for (const [path, expected] of Object.entries(report.canonicalSha256))
    assert.equal(hash(await readFile(path)), expected);
});

test("Javier's three scolding beats select complete authored crops and make the rival react, including reduced motion", () => {
  const sheet = ATTACK_ART.javier;
  const image = { width: 1024, height: 1024 } as HTMLImageElement;
  for (const motion of [0, 1])
    for (const [tick, pose] of [
      [0, "headshirt"],
      [42, "fingerwag"],
      [90, "scold"],
      [138, "point"],
    ] as const) {
      const crops: unknown[][] = [],
        bodies: unknown[][] = [];
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
        pulse: tick ? 1 : 0,
        actor: "javier",
        rival: "zavarce",
        images: { [sheet.file]: image },
        profile: finaleById("javier"),
        art(selected: string, x: number, y: number, h: number) {
          assert.equal(selected, pose);
          return drawAttackArt(
            ctx,
            { [sheet.file]: image },
            "javier",
            selected,
            x,
            y,
            h,
          );
        },
        body: (...args: unknown[]) => bodies.push(args),
        bubble() {},
        damage() {},
      } as unknown as FinaleView;
      assert.equal(drawJavierFinale(view), true);
      assert.equal(crops.length, 1);
      const frame = sheet.frames[pose];
      assert.deepEqual(crops[0].slice(1, 5), [
        frame.x,
        frame.y,
        frame.width,
        frame.height,
      ]);
      assert.deepEqual(bodies, [
        ["zavarce", 789, 510, 288, -1, tick ? "hurt" : "stand"],
      ]);
    }
});

test("Javier's painted body anchors stay at both captured world positions, including unequal heights", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(9);
    run.target.y -= 42;
    const layout = finaleArenaLayout(run.state)!;
    for (const [x, feet, player] of [
      [362, 515, run.source],
      [789, 510, run.target],
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

test("Javier refuses missing or unloaded artwork before painting any partial scene", () => {
  const sheet = ATTACK_ART.javier;
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
    assert.equal(drawJavierFinale(view), false);
    assert.deepEqual(painted, []);
  }
  const point = sheet.frames.point;
  const painted: unknown[] = [];
  try {
    delete sheet.frames.point;
    assert.equal(
      drawJavierFinale({
        images: { [sheet.file]: { width: 1024, height: 1024 } },
        art: (...args: unknown[]) => painted.push(args),
        body: (...args: unknown[]) => painted.push(args),
      } as unknown as FinaleView),
      false,
    );
    assert.deepEqual(painted, []);
  } finally {
    sheet.frames.point = point;
  }
});

function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Javier", fighter: "javier" as const, wins };
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

test("Javier scolding finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("javier")!.damageBeats;
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

test("Javier definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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
