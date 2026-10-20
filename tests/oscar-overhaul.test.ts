import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import {
  drawOscarFinale,
  oscarPlayingPose,
  OSCAR_HEIGHTS,
  OSCAR_POSES,
  OSCAR_NOTE_TRAVEL,
} from "../src/game/finales/oscar";
import type { FinaleView } from "../src/game/finales/types";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { writeFinaleMusic } from "../src/game/finale-sounds";
function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Óscar", fighter: "oscar" as const, wins };
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

test("Óscar contrabajo finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("oscar")!.damageBeats;
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

test("Óscar definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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

test("Óscar retains every raw generation and the unchanged canonical identities", async () => {
  const report = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/oscar/provenance.json",
      "utf8",
    ),
  );
  for (const [path, hash] of Object.entries({
    ...report.rawFiles,
    ...report.canonicalSha256,
    ...report.referenceSha256,
    ...report.promptSha256,
  }))
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      hash,
    );
  const grid = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/oscar/grid-audit.json",
      "utf8",
    ),
  );
  assert.equal(grid.exactRetainedRgbaRoundtrip, true);
  assert.equal(grid.objects.length, 6);
});

test("Óscar's miss and interrupted startup never start the performance or drain remote health", () => {
  for (const side of [0, 1] as const) {
    const miss = setup(side);
    miss.target.x = miss.source.x + miss.source.facing * 360;
    miss.inputs[side].actions.super++;
    miss.advance(50);
    assert.equal(miss.state.finale, undefined);
    assert.equal(miss.target.hp, 100);
    assert.equal(miss.source.attack, null);
    const interrupted = setup(side);
    interrupted.target.x =
      interrupted.source.x + interrupted.source.facing * 60;
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(3);
    interrupted.inputs[side].actions.super++;
    interrupted.advance(30);
    assert.equal(interrupted.state.finale, undefined);
    assert.equal(interrupted.target.hp, 100);
    assert.ok(interrupted.source.hp < 100);
  }
});

function record(tick: number, motion = 1, gap = 305, rise = 0, edge = false) {
  const sheet = ATTACK_ART.oscar;
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
    actor: "oscar",
    rival: "zavarce",
    profile: finaleById("oscar"),
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
        "oscar",
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
    ring() {},
  } as unknown as FinaleView;
  assert.equal(drawOscarFinale(view), true);
  for (const [i, p] of poses.entries()) {
    const f = sheet.frames[p.pose];
    assert.deepEqual(crops[i].slice(1, 5), [f.x, f.y, f.width, f.height]);
  }
  return { poses, bodies, viewport };
}

test("three notes visibly leave the plucking hand and arrive at the current rival on all damage beats", () => {
  assert.equal(finaleById("oscar")!.mode, "capture");
  for (const motion of [0, 1])
    for (const gap of [94, 305, 415])
      for (const rise of [0, 42, 110])
        for (const beat of finaleById("oscar")!.damageBeats) {
          const hit = record(beat, motion, gap, rise),
            launch = record(beat - OSCAR_NOTE_TRAVEL, motion, gap, rise);
          const note = hit.poses.find((p) => p.pose.startsWith("note"))!;
          const emitted = launch.poses.find((p) => p.pose.startsWith("note"))!;
          assert.ok(note && emitted);
          assert.equal(note.alpha, 1);
          assert.equal(note.x, 330 + gap - 24);
          assert.equal(note.y - note.height / 2, 510 - rise - 150);
          assert.equal(emitted.x, launch.poses[0].x + 63);
          assert.equal(emitted.y - emitted.height / 2, 510 - 174);
          assert.ok(note.x > emitted.x + 100);
          assert.equal(
            launch.poses[0].pose,
            beat === 138 ? "accent" : "release",
          );
          assert.deepEqual(hit.bodies, [
            ["zavarce", 783, 510, 290, -1, "hurt"],
          ]);
        }
});

test("the four measured playing poses share source scale and preserve crown/feet rather than scroll height", async () => {
  const packed = JSON.parse(
    await readFile("docs/finales/attack-overhaul/oscar/assets.json", "utf8"),
  );
  for (const obj of packed.objects.slice(0, 4)) {
    const f = packed.frames[obj.pose];
    const sourceScale =
      (OSCAR_HEIGHTS[obj.pose] / f.bodyHeight) * obj.uniformScale;
    assert.ok(Math.abs(sourceScale - 305 / 425) < 1e-10);
  }
  assert.equal(oscarPlayingPose(17, [42, 90, 138]), "pull");
  assert.equal(oscarPlayingPose(18, [42, 90, 138]), "release");
  assert.equal(oscarPlayingPose(114, [42, 90, 138]), "accent");
  assert.equal(oscarPlayingPose(178, [42, 90, 138]), "ready");
});

test("close-capture step-back keeps the full bass visible, fixed floor and constant scale across pose changes", () => {
  for (const tick of [0, 12, 18, 30, 42, 66, 90, 114, 138, 158, 178, 180])
    for (const gap of [94, 305, 415])
      for (const rise of [0, 42]) {
        const sample = record(tick, 1, gap, rise, true),
          p = sample.poses[0];
        const f = ATTACK_ART.oscar.frames[p.pose],
          scale = p.height / f.bodyHeight!;
        assert.ok(p.x - f.anchorX * scale >= sample.viewport!.left + 8 - 1e-8);
        assert.ok(
          p.x + (f.width - f.anchorX) * scale <=
            sample.viewport!.right - 8 + 1e-8,
        );
        assert.equal(p.y, 510);
        assert.equal(p.height, OSCAR_HEIGHTS[p.pose]);
      }
  assert.equal(record(0, 1, 94).poses[0].x, 330);
  assert.equal(record(42, 1, 94).poses[0].x, 114);
  assert.equal(record(180, 1, 94).poses[0].x, 330);
});

test("Óscar preflights every pose and corrupt image before painting anything", () => {
  const sheet = ATTACK_ART.oscar;
  for (const image of [
    undefined,
    { width: 0, height: 1024 },
    { width: 512, height: 512 },
    { width: 1536, height: 1024, naturalWidth: 0, naturalHeight: 0 },
  ]) {
    let touched = false;
    assert.equal(
      drawOscarFinale({
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
  for (const pose of OSCAR_POSES) {
    const saved = sheet.frames[pose];
    try {
      delete sheet.frames[pose];
      assert.equal(
        drawOscarFinale({
          images: { [sheet.file]: { width: 1536, height: 1024 } },
        } as unknown as FinaleView),
        false,
      );
    } finally {
      sheet.frames[pose] = saved;
    }
  }
});

test("the original bass cue is deterministic, finite, audible and fades to silence", () => {
  const rate = 12000,
    length = 3 * rate;
  const left = new Float32Array(length),
    right = new Float32Array(length),
    repeat = new Float32Array(length),
    repeatR = new Float32Array(length);
  writeFinaleMusic(left, right, rate, "oscar");
  writeFinaleMusic(repeat, repeatR, rate, "oscar");
  assert.deepEqual(left, repeat);
  assert.deepEqual(right, repeatR);
  assert.ok(left.every(Number.isFinite));
  assert.ok(left.some((v) => Math.abs(v) > 0.05));
  assert.equal(left[length - 1], 0);
  assert.equal(right[length - 1], 0);
});
