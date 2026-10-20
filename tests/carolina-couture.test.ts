import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../shared/engine";
import { fighterById } from "../shared/content";
import { finaleById } from "../shared/finales";
import {
  coutureRunwayRange,
  COUTURE_MODEL_COUNT,
  COUTURE_MODEL_CUES,
  coutureModelStart,
} from "../shared/couture-runway";
import { ARENA_FINALES, arenaFinaleContacts } from "../shared/arena-finales";
import { ATTACK_ART } from "../src/game/attack-art";
import { arenaHelperPose } from "../src/game/arena-finale-renderer";
import {
  carolinaInvocationPose,
  carolinaPoseHeight,
} from "../src/game/finales/carolina";

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

test("each model has a real two-frame walk cycle, normal body scale and a reduced-motion pose", () => {
  const r = setup(0, 550);
  r.start();
  r.advance(COUTURE_MODEL_CUES.at(-1)!);
  const field = r.state.fieldFinales![0];
  const poses = new Set<string>();
  for (const actor of field.actors!) {
    actor.age = 0;
    const a = arenaHelperPose(field, actor)!;
    actor.age = 5;
    const b = arenaHelperPose(field, actor)!;
    assert.notEqual(a.pose, b.pose);
    assert.equal(arenaHelperPose(field, actor, true)!.pose, a.pose);
    assert.ok(a.height >= 170 && a.height <= 180);
    assert.ok(b.height >= 165 && b.height <= 180);
    poses.add(a.pose);
    poses.add(b.pose);
  }
  assert.equal(poses.size, 8);
});

test("the twelve complete, unique crops ship in one compact lossless WebP atlas", async () => {
  const sheet = ATTACK_ART.carolina,
    bytes = await readFile(`public/assets/${sheet.file}.webp`);
  assert.ok(bytes.includes(Buffer.from("VP8L")), "true lossless WebP");
  assert.ok(bytes.length < 1.5 * 1024 * 1024);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.ok(
    info.width * info.height < 2_500_000,
    "preserve the detailed invocation at native resolution without excess padding",
  );
  assert.equal(Object.keys(sheet.frames).length, 12);
  const fingerprints = new Set<string>();
  for (const frame of Object.values(sheet.frames)) {
    assert.ok(
      frame.x > 0 &&
        frame.y > 0 &&
        frame.x + frame.width < info.width &&
        frame.y + frame.height < info.height,
    );
    let visible = 0,
      transparent = 0;
    const crop = await sharp(data, { raw: info })
      .extract({
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
      })
      .raw()
      .toBuffer();
    for (let n = 3; n < crop.length; n += 4) {
      if (crop[n] >= 40) visible++;
      if (!crop[n]) transparent++;
    }
    assert.ok(visible > 4000 && transparent > 100);
    fingerprints.add(createHash("sha256").update(crop).digest("hex"));
  }
  assert.equal(fingerprints.size, 12);
});

test("the models enter one by one in front of Carolina as she gives the summon signal", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 550);
    r.start();
    const field = r.state.fieldFinales![0],
      start = coutureModelStart(field);
    for (let tick = 0; tick <= 72; tick++) {
      assert.equal(field.tick, tick);
      assert.equal(
        field.actors?.length ?? 0,
        COUTURE_MODEL_CUES.filter((cue) => cue <= tick).length,
      );
      for (const model of field.actors ?? [])
        assert.ok((model.x - field.x) * field.direction > 0);
      if (COUTURE_MODEL_CUES.some((cue) => cue === tick)) {
        const newest = field.actors!.at(-1)!;
        assert.ok(Math.abs(newest.x - start) <= 3.21);
        assert.equal(newest.age, 1);
      }
      r.advance();
    }
  }
});

test("Carolina points from a grounded stance like Pedro, with stable size and a quiet reduced-motion pose", () => {
  assert.equal(carolinaInvocationPose(0), "gather");
  assert.equal(carolinaInvocationPose(COUTURE_MODEL_CUES[0]), "summon");
  assert.equal(carolinaInvocationPose(24), "hold");
  assert.equal(carolinaInvocationPose(34), "recover");
  for (const tick of [0, 8, 24, 34]) {
    const pose = carolinaInvocationPose(tick),
      frame = ATTACK_ART.carolina.frames[pose];
    assert.equal(
      frame.anchorY,
      frame.height,
      "her heels stay on the arena floor",
    );
    assert.ok(Math.abs(carolinaPoseHeight(pose, 177) - 177) < 2);
    assert.equal(carolinaInvocationPose(tick, true), "summon");
  }
  for (const obsolete of ["welcome", "direct", "applaud", "finish"])
    assert.equal(ATTACK_ART.carolina.frames[obsolete], undefined);
});
