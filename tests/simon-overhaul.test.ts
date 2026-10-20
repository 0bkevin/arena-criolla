import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawSimonFinale, simonSpecialPose } from "../src/game/finales/simon";
import type { FinaleView } from "../src/game/finales/types";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { writeFinaleMusic } from "../src/game/finale-sounds";

test("Simón's release stroke matches the first visible emission rather than a floating overlay", () => {
  assert.equal(simonSpecialPose(11), "ready");
  assert.equal(simonSpecialPose(12), "downstroke");
  assert.equal(simonSpecialPose(20), "upstroke");
  assert.equal(simonSpecialPose(32), "ready");
});

function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Simón", fighter: "simon" as const, wins };
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

test("Simón cuatro finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("simon")!.damageBeats;
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

test("Simón definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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

test("Simón retains every raw generation and the unchanged canonical identities", async () => {
  const report = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/simon/provenance.json",
      "utf8",
    ),
  );
  for (const [path, hash] of Object.entries({
    ...report.rawFiles,
    ...report.canonicalSha256,
    ...report.referenceSha256,
  }))
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      hash,
    );
  const grid = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/simon/grid-audit.json",
      "utf8",
    ),
  );
  assert.equal(grid.exactRetainedRgbaRoundtrip, true);
  assert.equal(grid.objects.length, 6);
});

function record(tick: number, motion = 1, gap = 453, rise = 0, edge = false) {
  const sheet = ATTACK_ART.simon;
  const image = { width: 1536, height: 1024 } as HTMLImageElement;
  const point = (x: number, y: number) => ({
    x: 330 + ((x - 330) * gap) / 453,
    y: y - rise * Math.max(0, Math.min(1, (x - 330) / 453)),
  });
  const viewport = edge
    ? { left: 120, right: 330 + gap + 72, top: 0, bottom: 700 }
    : undefined;
  const poses: {
      pose: string;
      x: number;
      y: number;
      height: number;
      facing: number;
      alpha: number;
    }[] = [],
    bodies: unknown[][] = [],
    crops: unknown[][] = [];
  const ctx = {
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage: (...args: unknown[]) => crops.push(args),
  } as unknown as CanvasRenderingContext2D;
  const view = {
    ctx,
    tick,
    motion,
    pulse: [42, 90, 138].includes(tick) ? 1 : 0,
    actor: "simon",
    rival: "zavarce",
    profile: finaleById("simon"),
    images: { [sheet.file]: image },
    point,
    viewport,
    art(
      pose: string,
      x: number,
      feet: number,
      height: number,
      facing = 1,
      alpha = 1,
    ) {
      const p = point(x, feet);
      poses.push({ pose, x: p.x, y: p.y, height, facing, alpha });
      return drawAttackArt(
        ctx,
        { [sheet.file]: image },
        "simon",
        pose,
        p.x,
        p.y,
        height,
        facing,
        alpha,
      );
    },
    body: (...args: unknown[]) => bodies.push(args),
    damage() {},
  } as unknown as FinaleView;
  assert.equal(drawSimonFinale(view), true);
  for (const [i, p] of poses.entries()) {
    const f = sheet.frames[p.pose];
    assert.deepEqual(crops[i].slice(1, 5), [f.x, f.y, f.width, f.height]);
  }
  return { poses, bodies, viewport };
}

test("three wooden horses contact the captured rival on the actual damage beats at every capture distance", () => {
  for (const motion of [0, 1])
    for (const gap of [94, 305, 453])
      for (const rise of [0, 42])
        for (const beat of [42, 90, 138]) {
          const hit = record(beat, motion, gap, rise),
            before = record(beat - 20, motion, gap, rise);
          const horse = hit.poses.find((p) => p.pose === "horse-spring")!;
          assert.ok(horse);
          assert.equal(horse.alpha, 1);
          assert.equal(horse.x, 330 + gap - 62);
          assert.equal(horse.y, 510 - rise - (motion ? 9 : 0));
          assert.ok(
            before.poses.find((p) => p.pose.startsWith("horse"))!.x <
              horse.x - 150,
          );
          assert.equal(hit.poses[0].pose, "accent");
          assert.equal(hit.poses[0].x, 330 - Math.max(0, 300 - gap));
          assert.equal(hit.poses[0].height, 305);
          assert.deepEqual(hit.bodies, [
            ["zavarce", 783, 510, 290, -1, "hurt"],
          ]);
        }
});

test("close captures ease a bounded visual step-back while keeping body scale and actor floor", () => {
  const entry = record(0, 1, 94, 42).poses[0];
  const middle = record(42, 1, 94, 42).poses[0];
  const recovery = record(174, 1, 94, 42).poses[0];
  const exit = record(180, 1, 94, 42).poses[0];
  assert.equal(entry.x, 330);
  assert.equal(middle.x, 124);
  assert.equal(recovery.x, 227);
  assert.equal(exit.x, 330);
  for (const p of [entry, middle, recovery, exit]) {
    assert.equal(p.y, 510);
    assert.equal(p.height, 305);
  }
  const bounded = record(42, 1, 94, 42, true);
  const p = bounded.poses[0],
    f = ATTACK_ART.simon.frames[p.pose];
  const scale = p.height / (f.bodyHeight ?? f.height);
  assert.ok(p.x - f.anchorX * scale >= bounded.viewport!.left + 8);
  assert.equal(p.y, 510);
});

test("wooden toys return toward the arena interior without clipping when the target is at an edge", () => {
  for (const gap of [94, 305, 453])
    for (const tick of [24, 30, 42, 48, 54, 60, 90, 138]) {
      const sample = record(tick, 1, gap, 0, true);
      for (const p of sample.poses.filter((p) => p.pose.startsWith("horse"))) {
        const f = ATTACK_ART.simon.frames[p.pose],
          s = p.height / (f.bodyHeight ?? f.height);
        const a = p.x - f.anchorX * s * p.facing,
          b = p.x + (f.width - f.anchorX) * s * p.facing;
        assert.ok(Math.min(a, b) >= sample.viewport!.left + 8 - 1e-8);
        assert.ok(Math.max(a, b) <= sample.viewport!.right - 8 + 1e-8);
      }
    }
  assert.equal(
    record(54, 1, 305, 0, true).poses.find((p) => p.pose.startsWith("horse"))!
      .facing,
    -1,
  );
});

test("Simón preflights the whole scene before drawing, including the last horse and corrupt dimensions", () => {
  const sheet = ATTACK_ART.simon;
  for (const image of [
    undefined,
    { width: 0, height: 1024 },
    { width: 512, height: 512 },
    { width: 1536, height: 1024, naturalWidth: 0, naturalHeight: 0 },
  ]) {
    let touched = false;
    assert.equal(
      drawSimonFinale({
        images: image ? { [sheet.file]: image } : {},
        art() {
          touched = true;
        },
        body() {
          touched = true;
        },
      } as unknown as FinaleView),
      false,
    );
    assert.equal(touched, false);
  }
  const saved = sheet.frames["horse-spring"];
  try {
    delete sheet.frames["horse-spring"];
    assert.equal(
      drawSimonFinale({
        images: { [sheet.file]: { width: 1536, height: 1024 } },
      } as unknown as FinaleView),
      false,
    );
  } finally {
    sheet.frames["horse-spring"] = saved;
  }
});

test("Simón's original synthesized score is deterministic, audible and ends in silence", () => {
  const rate = 12000,
    length = 3 * rate;
  const left = new Float32Array(length),
    right = new Float32Array(length),
    repeat = new Float32Array(length),
    repeatR = new Float32Array(length);
  writeFinaleMusic(left, right, rate, "simon");
  writeFinaleMusic(repeat, repeatR, rate, "simon");
  assert.deepEqual(left, repeat);
  assert.deepEqual(right, repeatR);
  assert.ok(left.some((v) => Math.abs(v) > 0.05));
  assert.ok(left.every(Number.isFinite));
  assert.equal(left[length - 1], 0);
  assert.equal(right[length - 1], 0);
});
