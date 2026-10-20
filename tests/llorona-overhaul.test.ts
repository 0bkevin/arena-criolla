import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";
import { fighterById } from "../shared/content";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  drawLloronaFinale,
  drawLloronaProjectile,
  lloronaHeight,
  LLORONA_POSES,
} from "../src/game/finales/llorona";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";
import { writeFinaleMusic } from "../src/game/finale-sounds";
function setup(side: 0 | 1, wins = 3, energy = 100) {
  const actor = { name: "La Llorona", fighter: "llorona" as const, wins };
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

test("La Llorona underworld finale charges 75 once, drains three equal beats and releases both slots", () => {
  for (const side of [0, 1] as const) {
    const run = setup(side);
    run.inputs[side].actions.super++;
    run.advance(1);
    assert.ok(run.source.energy >= 25 && run.source.energy < 26);
    run.advance(8);
    const scene = run.state.finale!;
    assert.ok(scene);
    assert.equal(scene.direction, side ? -1 : 1);
    const beats = finaleById("llorona")!.damageBeats;
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

test("La Llorona definitive rejects locked, depleted, behind and guarded captures; lethal stock resolves on exit", () => {
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

test("La Llorona's miss and interrupted startup never start the portal or drain remote health", () => {
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

test("special respects front guard, misses height, obeys energy and loses startup to a real hit", () => {
  for (const side of [0, 1] as const) {
    const guard = setup(side);
    guard.inputs[1 - side].block = true;
    guard.inputs[side].actions.special++;
    guard.advance(110);
    assert.equal(guard.target.hp, 100);
    assert.equal(guard.source.hits, 0);
    const high = setup(side);
    high.target.y = 100;
    high.target.grounded = false;
    high.target.vy = -15;
    high.inputs[side].actions.special++;
    high.advance(40);
    assert.equal(high.target.hp, 100);
    const low = setup(side, 3, 24);
    low.inputs[side].actions.special++;
    low.advance(18);
    assert.equal(low.state.projectiles.length, 0);
    assert.equal(low.source.attack, null);
    const interrupted = setup(side);
    interrupted.target.x =
      interrupted.source.x + interrupted.source.facing * 60;
    interrupted.inputs[side].actions.special++;
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(30);
    assert.ok(interrupted.source.hp < 100);
    assert.equal(interrupted.state.projectiles.length, 0);
    assert.equal(interrupted.target.hp, 100);
  }
});

test("undertow and finale remain identical after network serialization", () => {
  for (const action of ["special", "super"] as const)
    for (const side of [0, 1] as const) {
      const r = setup(side);
      r.inputs[side].actions[action]++;
      r.advance(action === "special" ? 24 : 39);
      const copy = JSON.parse(JSON.stringify(r.state));
      for (let n = 0; n < 220; n++) {
        r.advance(1);
        stepMatch(copy, [...r.inputs]);
      }
      assert.deepEqual(copy, r.state);
    }
});

test("original synthesized lament has energy at all arrivals and finite samples", () => {
  const left = new Float32Array(18000),
    right = new Float32Array(18000);
  writeFinaleMusic(left, right, 6000, "llorona");
  assert.ok(left.every(Number.isFinite));
  assert.ok(right.every(Number.isFinite));
  for (const beat of [42, 90, 138])
    assert.ok(
      left.slice(beat * 100, beat * 100 + 1000).some((n) => Math.abs(n) > 0.01),
    );
});

test("raw assets and portal frame preserve audited hashes and anatomical scale", async () => {
  const provenance = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/llorona/provenance.json",
      "utf8",
    ),
  );
  for (const f of provenance.files)
    assert.equal(
      createHash("sha256")
        .update(await readFile(f.path))
        .digest("hex"),
      f.sha256,
    );
  assert.ok(ATTACK_ART.llorona.frames.portal.width >= 470);
  const pack = JSON.parse(
    await readFile("docs/finales/attack-overhaul/llorona/assets.json", "utf8"),
  );
  assert.equal(
    createHash("sha256")
      .update(await readFile(pack.destination))
      .digest("hex"),
    pack.runtimeSha256,
  );
  const scales = pack.objects
    .filter((o: any) => !["portal", "wave"].includes(o.pose))
    .map(
      (o: any) =>
        ((lloronaHeight(o.pose) /
          ATTACK_ART.llorona.frames[o.pose].bodyHeight!) *
          o.height) /
        o.sourceBounds.height,
    );
  assert.ok(
    Math.max(...scales) - Math.min(...scales) < 0.001,
    "one anatomical pixel scale for every pose",
  );
});

test("preflight refuses every missing pose before any canvas or actor operation", () => {
  const sheet = ATTACK_ART.llorona;
  for (const pose of LLORONA_POSES) {
    const old = sheet.frames[pose];
    delete sheet.frames[pose];
    try {
      const forbidden = () => {
        throw Error("paint before preflight");
      };
      const view = {
        images: { [sheet.file]: { width: 1024, height: 2048, complete: true } },
        ctx: new Proxy({}, { get: forbidden }),
        body: forbidden,
        art: forbidden,
        point: forbidden,
      } as unknown as FinaleView;
      assert.equal(drawLloronaFinale(view), false);
    } finally {
      sheet.frames[pose] = old;
    }
  }
});

test("undertow launches from the low hands at tick15, travels, pulls once and expires", () => {
  assert.equal(TECHNIQUES.undertow.startup, 15);
  assert.equal(TECHNIQUES.undertow.projectile?.pulls, true);
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.x = r.source.x + r.source.facing * 280;
    r.inputs[side].actions.special++;
    r.advance(14);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    r.advance(1);
    assert.equal(r.state.projectiles.length, 1);
    const wave = r.state.projectiles[0];
    assert.equal(wave.kind, "undertow");
    assert.equal(wave.pulls, true);
    const direction = r.source.facing;
    let contacts = 0,
      previous = 100;
    for (let tick = 0; tick < 130; tick++) {
      r.advance(1);
      if (r.target.hp < previous) {
        contacts++;
        assert.equal(Math.sign(r.target.vx), -direction);
      }
      previous = r.target.hp;
    }
    assert.equal(contacts, 1);
    assert.equal(r.source.hits, 1);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.source.attack, null);
  }
});

test("surviving stock respawns with both controls restored and no portal state", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.hp = 1;
    r.target.stocks = 2;
    r.inputs[side].actions.super++;
    r.advance(189);
    assert.equal(r.state.finale, undefined);
    assert.equal(r.state.phase, "playing");
    assert.equal(r.target.stocks, 1);
    assert.equal(r.target.hp, 100);
    r.advance(80);
    const before = r.state.players.map((p) => p.x);
    r.inputs[0].right = true;
    r.inputs[1].left = true;
    r.advance(5);
    assert.ok(r.state.players[0].x > before[0]);
    assert.ok(r.state.players[1].x < before[1]);
    assert.equal(r.state.projectiles.length, 0);
  }
});

import { finaleArenaLayout } from "../src/game/finale-layout";
import {
  lloronaPhase,
  lloronaSpecialPose,
  drawLloronaSpecial,
} from "../src/game/finales/llorona";

function record(run: ReturnType<typeof setup>, tick: number, small = false) {
  const layout = finaleArenaLayout(run.state)!;
  const art: {
      pose: string;
      x: number;
      feet: number;
      height: number;
      alpha: number;
    }[] = [],
    bodies: { id: string; x: number; feet: number; height: number }[] = [];
  const clips: number[][] = [];
  const ctx = new Proxy(
    {
      globalAlpha: 1,
      rect(...args: number[]) {
        clips.push(args);
      },
    },
    {
      get(target, key) {
        return key in target ? target[key as keyof typeof target] : () => {};
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const view = {
    ctx,
    state: run.state,
    profile: finaleById("llorona")!,
    actor: "llorona",
    rival: small ? "momoy" : "zavarce",
    tick,
    pulse: 0,
    beat: 0,
    motion: 1,
    images: {
      [ATTACK_ART.llorona.file]: { width: 1024, height: 2048, complete: true },
    },
    sprites: {},
    point: layout.point,
    viewport: { left: -500, top: -500, right: 1500, bottom: 1500 },
    art(
      pose: string,
      x: number,
      feet: number,
      height: number,
      _facing = 1,
      alpha = 1,
    ) {
      const p = layout.point(x, feet);
      art.push({ pose, x: p.x, feet: p.y, height, alpha });
      return true;
    },
    body(id: string, x: number, feet: number, height: number) {
      const p = layout.point(x, feet);
      bodies.push({ id, x: p.x, feet: p.y, height });
    },
    text() {},
    damage() {},
    ring() {},
    bubble() {},
  } as unknown as FinaleView;
  assert.equal(drawLloronaFinale(view), true);
  return { art, bodies, clips, layout };
}

test("portal stages descend whole bodies through a clipping surface and restore full bodies before release", () => {
  const r = setup(0);
  r.inputs[0].actions.super++;
  r.advance(9);
  const before = JSON.stringify(r.state);
  for (const small of [false, true]) {
    const held = record(r, 78, small),
      down = record(r, 114, small),
      hidden = record(r, 138, small),
      back = record(r, 168, small);
    const actor = (sample: ReturnType<typeof record>) =>
      sample.art.find((a) => a.pose !== "portal")!;
    assert.equal(actor(held).pose, small ? "embrace-low" : "embrace-high");
    assert.equal(held.bodies[0].id, small ? "momoy" : "zavarce");
    assert.equal(actor(held).alpha, 1);
    assert.equal(actor(down).alpha, 1);
    assert.equal(actor(hidden).alpha, 1);
    assert.ok(actor(down).feet > actor(held).feet + 50);
    assert.ok(hidden.bodies[0].feet - held.bodies[0].feet >= 350);
    assert.ok(hidden.clips.length >= 2);
    assert.equal(actor(back).feet, actor(held).feet);
    assert.equal(back.bodies[0].feet, held.bodies[0].feet);
    assert.equal(actor(back).pose, "recover");
    const end = record(r, 180, small);
    assert.ok(end.art.every((a) => a.pose !== "portal"));
    assert.equal(end.bodies[0].x, end.layout.point(782, 514).x);
    assert.equal(end.bodies[0].feet, end.layout.point(782, 514).y);
  }
  assert.equal(
    JSON.stringify(r.state),
    before,
    "render never changes simulation",
  );
});

test("platform capture levels only the illustration, then returns each fighter to its own feet", () => {
  const r = setup(1);
  r.source.y = 418;
  r.target.y = 345;
  r.source.grounded = true;
  r.target.grounded = true;
  r.inputs[1].actions.super++;
  r.advance(9);
  assert.ok(r.state.finale);
  const state = JSON.stringify(r.state),
    held = record(r, 78),
    end = record(r, 180);
  assert.ok(
    Math.abs(held.bodies[0].feet - held.layout.point(306, 514).y) < 1e-9,
  );
  assert.equal(end.bodies[0].feet, end.layout.point(782, 514).y);
  assert.equal(JSON.stringify(r.state), state);
});

test("special never draws incomplete art or an attack pose during hitstun", () => {
  const r = setup(0);
  r.inputs[0].actions.special++;
  r.advance(15);
  assert.equal(lloronaSpecialPose(15), "embrace-low");
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw Error("painting forbidden");
      },
    },
  ) as CanvasRenderingContext2D;
  assert.equal(drawLloronaSpecial(forbidden, {}, r.source, 177), false);
  r.source.stun = 3;
  assert.equal(
    drawLloronaSpecial(
      forbidden,
      {
        [ATTACK_ART.llorona.file]: {
          width: 1024,
          height: 2048,
          complete: true,
        } as HTMLImageElement,
      },
      r.source,
      177,
    ),
    false,
  );
});

test("damage phases match the actual capture beats without an execution release", () => {
  assert.deepEqual(finaleById("llorona")!.damageBeats, [42, 90, 138]);
  assert.equal(finaleById("llorona")!.release, undefined);
  assert.deepEqual([42, 90, 138, 168, 180].map(lloronaPhase), [
    "reveal",
    "embrace",
    "underworld",
    "release",
    "release",
  ]);
});

test("assembling source cells preserves every original RGBA byte including portal wisps and wave droplets", async () => {
  const sharp = (await import("sharp")).default;
  const base = "assets/source/finales/attack-overhaul/llorona/";
  const sources = await Promise.all(
    ["poses-normalized-v1.png", "effects-raw-v1.png", "combined-v1.png"].map(
      (file) =>
        sharp(base + file)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true }),
    ),
  );
  const [poses, effects, assembled] = sources;
  const cells = Array.from({ length: 6 }, (_, i) => ({
    source: poses,
    x: (i % 2) * 608,
    y: Math.floor(i / 2) * 576,
    width: 608,
    height: 576,
    destX: (i % 2) * 1500 + 446,
    destY: Math.floor(i / 2) * 800 + 112,
  }));
  cells.push(
    {
      source: effects,
      x: 0,
      y: 0,
      width: 1392,
      height: 724,
      destX: 54,
      destY: 2438,
    },
    {
      source: effects,
      x: 1392,
      y: 0,
      width: 780,
      height: 724,
      destX: 1860,
      destY: 2438,
    },
  );
  for (const cell of cells)
    for (let row = 0; row < cell.height; row++) {
      const src = ((cell.y + row) * cell.source.info.width + cell.x) * 4,
        dst = ((cell.destY + row) * assembled.info.width + cell.destX) * 4;
      assert.ok(
        cell.source.data
          .subarray(src, src + cell.width * 4)
          .equals(assembled.data.subarray(dst, dst + cell.width * 4)),
        `RGBA mismatch in row${row} of destination ${cell.destX},${cell.destY}`,
      );
    }
});
