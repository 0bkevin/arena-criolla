import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawGomezFinale } from "../src/game/finales/gomez";
import type { FinaleView } from "../src/game/finales/types";
import { ATTACK_ART, drawAttackArt } from "../src/game/attack-art";
import type { FinaleViewportBounds } from "../src/game/finale-viewport";
import { finaleArenaLayout } from "../src/game/finale-layout";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "Gómez", fighter: "gomez" as const, wins };
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

test("Gómez cavalry finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("gomez")!.damageBeats;
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

test("Gómez definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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
    run.advance(9 + 48);
    assert.equal(run.target.hp, 0);
    assert.equal(run.target.stocks, 1);
    assert.equal(run.state.phase, "playing");
    run.advance(180 - 48);
    assert.equal(run.target.stocks, 0);
    assert.equal(run.state.phase, "finished");
    assert.equal(run.state.winner, side);
  }
});

test("Gómez preserves all generated originals, user reference and canonical identities", async () => {
  const report = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/gomez/provenance.json",
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
});

function record(
  tick: number,
  motion = 1,
  point = (x: number, y: number) => ({ x, y }),
  viewport?: FinaleViewportBounds,
) {
  const sheet = ATTACK_ART.gomez;
  const image = { width: 2048, height: 2048 } as HTMLImageElement;
  const crops: unknown[][] = [],
    bodies: unknown[][] = [];
  const poses: {
    pose: string;
    x: number;
    feet: number;
    height: number;
    facing: number;
    alpha: number;
  }[] = [];
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
    pulse: [48, 70, 92].includes(tick) ? 1 : 0,
    actor: "gomez",
    rival: "zavarce",
    profile: finaleById("gomez"),
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
      poses.push({ pose, x, feet, height, facing, alpha });
      const p = point(x, feet);
      assert.ok([p.x, p.y, height, facing, alpha].every(Number.isFinite));
      assert.equal(feet, 516, "no artificial floating depth offsets");
      return drawAttackArt(
        ctx,
        { [sheet.file]: image },
        "gomez",
        pose,
        p.x,
        p.y,
        height,
        facing,
        alpha,
      );
    },
    body: (...args: unknown[]) => bodies.push(args),
    bubble() {},
    ring() {},
    damage() {},
  } as unknown as FinaleView;
  assert.equal(drawGomezFinale(view), true);
  for (const [i, p] of poses.entries()) {
    const f = sheet.frames[p.pose];
    assert.deepEqual(crops[i].slice(1, 5), [f.x, f.y, f.width, f.height]);
  }
  return { poses, bodies, crops };
}

test("Gómez actually charges past the rival with following troops, distinct gallop crops and visible dismount", () => {
  for (const motion of [0, 1]) {
    const entry = record(18, motion),
      contact = record(48, motion),
      past = record(70, motion);
    const lead = (sample: ReturnType<typeof record>) =>
      sample.poses.find((p) => p.pose.startsWith("gallop"))!;
    assert.ok(lead(contact).x > lead(entry).x + 200);
    assert.ok(lead(past).x > 776, "commander passes the standing rival");
    for (const p of contact.poses.filter((p) => p.pose.startsWith("trooper")))
      assert.ok(p.x < lead(contact).x, "troopers follow their commander");
    assert.equal(contact.poses.length, 3);
    assert.notEqual(
      lead(record(49, motion)).pose,
      lead(record(51, motion)).pose,
    );
    const retreat = record(120, motion);
    assert.equal(lead(retreat).facing, -1);
    const dismount = record(148, motion);
    assert.equal(dismount.poses[0].pose, "dismount");
    assert.equal(dismount.poses[0].x, 334);
    const release = record(178, motion);
    assert.ok(release.bodies.some((p) => p[0] === "gomez" && p[1] === 334));
    assert.ok(release.poses.every((p) => p.alpha === 0));
    assert.deepEqual(contact.bodies, [["zavarce", 776, 516, 288, -1, "hurt"]]);
  }
});

test("Gómez preserves captured world anchors on both slots and unequal-height surfaces", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(9);
    run.target.y -= 42;
    const layout = finaleArenaLayout(run.state)!;
    for (const [x, player] of [
      [334, run.source],
      [776, run.target],
    ] as const) {
      const p = layout.point(x, 516);
      assert.ok(
        Math.abs(
          layout.originX +
            (p.x - 540) * layout.scale * layout.direction -
            player.x,
        ) < 1e-9,
      );
      assert.ok(
        Math.abs(layout.originY + (p.y - 516) * layout.scale - player.y) < 1e-9,
      );
    }
    for (const tick of [18, 48, 70, 92, 120, 148, 178])
      record(tick, 1, layout.point);
  }
});

test("Gómez preflights missing, unloaded, undersized and incomplete atlases before painting", () => {
  const sheet = ATTACK_ART.gomez;
  for (const image of [
    undefined,
    { width: 0, height: 2048 },
    { width: 2048, height: 0 },
    { width: 512, height: 512 },
  ]) {
    const painted: unknown[] = [];
    assert.equal(
      drawGomezFinale({
        images: image ? { [sheet.file]: image } : {},
        art: (...p: unknown[]) => painted.push(p),
        body: (...p: unknown[]) => painted.push(p),
      } as unknown as FinaleView),
      false,
    );
    assert.deepEqual(painted, []);
  }
  const pose = sheet.frames.dismount;
  try {
    delete sheet.frames.dismount;
    assert.equal(
      drawGomezFinale({
        images: { [sheet.file]: { width: 2048, height: 2048 } },
      } as unknown as FinaleView),
      false,
    );
  } finally {
    sheet.frames.dismount = pose;
  }
});

test("Gómez brakes and turns wholly inside either visible edge without changing contact positions", () => {
  for (const viewport of [
    { left: 0, right: 1000, top: 0, bottom: 700 },
    { left: 120, right: 940, top: 0, bottom: 700 },
  ]) {
    const at = (tick: number) => record(tick, 1, undefined, viewport);
    const lead = (sample: ReturnType<typeof record>) =>
      sample.poses.find(
        (p) => p.pose === "brake" || p.pose.startsWith("gallop"),
      )!;
    assert.equal(
      lead(at(48)).x,
      lead(record(48)).x,
      "first contact remains authored",
    );
    assert.equal(
      lead(at(76)).x,
      lead(at(94)).x,
      "turn does not teleport across different pose widths",
    );
    for (const tick of [76, 90, 94, 99, 110]) {
      const p = lead(at(tick)),
        f = ATTACK_ART.gomez.frames[p.pose];
      const scale = p.height / (f.bodyHeight ?? f.height);
      const a = p.x - f.anchorX * scale * p.facing;
      const b = p.x + (f.width - f.anchorX) * scale * p.facing;
      assert.ok(Math.min(a, b) >= viewport.left + 8 - 1e-8);
      assert.ok(Math.max(a, b) <= viewport.right - 8 + 1e-8);
    }
  }
});
