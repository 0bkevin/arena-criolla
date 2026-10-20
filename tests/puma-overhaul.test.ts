import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "../shared/engine";
import { finaleById, FINALES } from "../shared/finales";
import type { FighterId } from "../shared/content";
import { ATTACK_ART } from "../src/game/attack-art";
import {
  drawPumaFinale,
  PUMA_POSES,
  pumaRingPose,
} from "../src/game/finales/puma";
import type { FinaleView } from "../src/game/finales/types";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

function setup(
  side: 0 | 1 = 0,
  rival: FighterId = "zavarce",
  x = 380,
  gap = 180,
) {
  const actor = { name: "Puma", fighter: "puma" as const, wins: 3 };
  const other = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [other, actor] : [actor, other]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 1080 - x : x;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let n = 0; n < ticks; n++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
    advance(9);
    assert.ok(state.finale);
  };
  return { state, source, target, inputs, advance, start };
}
test("Puma charges once, freezes capture positions and clock, deals all three beats and releases physically", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.inputs[side].actions.super++;
    r.advance(1);
    assert.ok(r.source.energy >= 25 && r.source.energy < 26);
    r.advance(8);
    const scene = r.state.finale!,
      before = r.state.players.map((p) => [p.x, p.y]),
      clock = r.state.tick,
      remaining = r.state.remaining;
    let last = 0;
    for (const [i, beat] of finaleById("puma")!.damageBeats.entries()) {
      r.advance(beat - last);
      last = beat;
      assert.ok(
        Math.abs(r.target.hp - (100 - (scene.damage * (i + 1)) / 3)) < 1e-9,
      );
      assert.deepEqual(
        r.state.players.map((p) => [p.x, p.y]),
        before,
      );
      assert.equal(r.state.tick, clock);
      assert.equal(r.state.remaining, remaining);
    }
    r.inputs[side].actions.special++;
    r.advance(scene.duration - last);
    assert.equal(r.state.finale, undefined);
    assert.equal(r.source.attack, null);
    assert.equal(r.target.stocks, 2);
    assert.equal(r.target.y, WORLD.floor);
    assert.ok(Math.abs(r.target.vx) > 34);
    assert.equal(r.target.vy, -22.1);
    const x = r.target.x,
      vx = r.target.vx;
    r.advance(1);
    assert.equal(r.target.x, x + vx);
    assert.equal(r.target.y, WORLD.floor - 21.58);
    r.inputs[side].right = true;
    const sx = r.source.x;
    r.advance(5);
    assert.ok(r.source.x > sx);
    assert.equal(r.source.attack, null, "capture inputs are discarded");
  }
});
test("center and both ledges eject resistant and lethal rivals exactly once, in either slot and final stock", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["gomez", "bolivar", "zavarce"] as const)
      for (const x of [40, 380, 925])
        for (const hp of [1, 100])
          for (const stocks of [1, 2]) {
            const r = setup(side, rival, x, x === 925 ? 120 : 180);
            r.target.hp = hp;
            r.target.stocks = stocks;
            r.start();
            r.advance(180);
            assert.equal(r.target.stocks, stocks);
            assert.equal(r.state.phase, "playing");
            const velocity = r.target.vx;
            let flight = 0;
            while (r.target.stocks === stocks && flight++ < 90) {
              const lastX = r.target.x,
                lastY = r.target.y,
                vx = r.target.vx,
                vy = r.target.vy;
              r.inputs[1 - side].actions.jump++;
              r.inputs[1 - side].actions.super++;
              r.advance(1);
              if (r.target.stocks === stocks) {
                assert.ok(Math.abs(r.target.x - lastX - vx) < 1e-8);
                assert.ok(Math.abs(r.target.y - lastY - vy - 0.52) < 1e-8);
                assert.equal(r.target.attack, null);
                assert.equal(r.target.vx, velocity);
              } else
                assert.ok(
                  lastX + vx < WORLD.x - 120 ||
                    lastX + vx > WORLD.x + WORLD.width + 120,
                  "stock is lost at actual horizontal bound",
                );
            }
            assert.ok(flight > 1 && flight < 40);
            assert.equal(r.target.stocks, stocks - 1);
            assert.equal(r.target.knockoutDelay, undefined);
            assert.equal(
              r.state.effects.filter((e) => e.kind === "ringout").length,
              1,
            );
            if (stocks === 1) {
              assert.equal(r.state.phase, "finished");
              assert.equal(r.state.winner, side);
            } else {
              assert.equal(r.target.hp, 100);
              assert.equal(r.target.vx, 0);
              assert.equal(r.target.vy, 0);
              r.advance(30);
              r.inputs[1 - side].actions.jump++;
              r.advance(1);
              assert.ok(r.target.vy < 0, "respawn returns jump control");
            }
            r.advance(100);
            assert.equal(r.target.stocks, stocks - 1);
          }
});
test("lethal throw cannot act or receive damage; serialized flight replays and timeout waits for its stock", () => {
  const r = setup();
  r.target.hp = 1;
  r.target.stocks = 1;
  r.state.remaining = 9;
  r.start();
  r.advance(180);
  assert.equal(r.state.remaining, 0);
  assert.equal(r.state.phase, "playing");
  r.target.invincible = 0;
  r.target.stun = 0;
  r.target.cooldown = 0;
  // A queued projectile intersects the HP0 fighter on the first flight tick.
  r.state.projectiles.push({
    id: r.state.nextId++,
    owner: 0,
    x: r.target.x + r.target.vx,
    y: r.target.y - 100,
    vx: 0,
    life: 20,
    kind: "sonic",
    damage: 99,
    force: 50,
    radius: 100,
  });
  r.inputs[1].actions.super++;
  r.inputs[1].actions.jump++;
  const replay: MatchState = JSON.parse(JSON.stringify(r.state));
  const hits = r.source.hits;
  while (r.state.phase === "playing") {
    r.advance(1);
    stepMatch(replay, r.inputs);
    assert.deepEqual(replay, r.state);
    assert.equal(r.target.attack, null);
    assert.equal(r.target.hp, 0);
    assert.equal(
      r.source.hits,
      hits,
      "dead flying target is immune to repeat rewards/damage",
    );
  }
  assert.equal(r.target.stocks, 0);
  assert.equal(r.state.winner, 0);
  assert.ok(r.target.x > WORLD.x + WORLD.width + 120);
});
test("bounded lethal-delay fallback expires and resets, without changing ordinary capture release", () => {
  const r = setup();
  r.target.hp = 1;
  r.start();
  r.advance(180);
  // Deliberately trap the throw to exercise the fallback, not the normal route.
  r.target.vx = 0;
  r.target.recoilVx = 0;
  r.target.vy = 0;
  r.target.y = WORLD.floor;
  r.advance(89);
  assert.equal(r.target.stocks, 2);
  assert.equal(r.target.knockoutDelay, 1);
  r.advance(1);
  assert.equal(r.target.stocks, 1);
  assert.equal(r.target.knockoutDelay, undefined);
  for (const f of Object.values(FINALES))
    if (f.id !== "puma") assert.equal(f.release, undefined);
  const other = setup();
  other.source.config.fighter = "oscar";
  other.start();
  other.advance(180);
  assert.ok(
    Math.abs(
      Math.abs(other.target.vx) - 12 * (1 + (100 - other.target.hp) / 90),
    ) < 1e-9,
  );
  assert.equal(other.target.knockoutDelay, undefined);
});
test("a real Cashea box killing Puma during a lethal last-stock flight resolves a draw in either slot", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, "vallenilla", 380, 120);
    r.target.hp = r.source.hp = 1;
    r.target.stocks = r.source.stocks = 1;
    r.inputs[1 - side].actions.special++;
    r.advance(3);
    r.start();
    assert.ok(
      r.state.projectiles.length > 0,
      "actual special spawned the box before capture",
    );
    const frozen = structuredClone(r.state.projectiles);
    r.advance(180);
    assert.deepEqual(r.state.projectiles, frozen);
    let ticks = 0,
      sawDeferredResult = false;
    while (r.state.phase === "playing" && ticks++ < 100) {
      r.advance(1);
      assert.ok(r.source.stocks >= 0, "resolved stocks never decrement again");
      if (r.source.stocks === 0 && r.target.stocks === 1) {
        sawDeferredResult = true;
        assert.equal(r.state.phase, "playing");
        assert.equal(r.state.winner, null);
      }
    }
    assert.equal(sawDeferredResult, true);
    assert.equal(r.state.phase, "finished");
    assert.equal(r.state.winner, "draw");
    assert.equal(r.source.stocks, 0);
    assert.equal(r.target.stocks, 0);
    assert.equal(r.target.knockoutDelay, undefined);
  }
});
test("Puma rejects unlock, energy, guard, behind, out-of-range and interrupted attempts", () => {
  for (const side of [0, 1] as const)
    for (const mode of [
      "locked",
      "energy",
      "guard",
      "behind",
      "miss",
      "interrupted",
    ]) {
      const r = setup(side);
      if (mode === "locked") r.source.config.wins = 2;
      if (mode === "energy") r.source.energy = 74;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "miss") r.target.x = r.source.x + r.source.facing * 500;
      if (mode === "interrupted") {
        r.target.x = r.source.x + r.source.facing * 60;
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.super++;
      r.advance(1);
      if (mode === "behind") r.source.facing *= -1;
      r.advance(70);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
    }
});
test("Puma preflights every full pose and keeps upright phases with fixed feet and canonical rival", () => {
  const sheet = ATTACK_ART.puma;
  for (const gap of [94, 305, 415])
    for (const rise of [0, 110])
      for (const motion of [0, 1])
        for (const tick of [0, 12, 21, 30, 39, 90, 158, 179, 180]) {
          const poses: {
              pose: string;
              x: number;
              y: number;
              facing: number;
            }[] = [],
            bodies: unknown[][] = [];
          const point = (x: number, y: number) => ({
            x: 330 + ((x - 330) * gap) / 453,
            y: y - rise * Math.max(0, Math.min(1, (x - 330) / 453)),
          });
          const view = {
            ctx: {
              save() {},
              restore() {},
              beginPath() {},
              rect() {},
              clip() {},
            },
            tick,
            motion,
            pulse: 0,
            actor: "puma",
            rival: "zavarce",
            profile: finaleById("puma"),
            images: { [sheet.file]: { width: 1536, height: 1024 } },
            point,
            art(pose: string, x: number, y: number, _h: number, facing = 1) {
              const p = point(x, y);
              poses.push({ pose, x: p.x, y: p.y, facing });
              return true;
            },
            body(...args: unknown[]) {
              bodies.push(args);
            },
            damage() {},
            ring() {},
            bubble() {},
          } as unknown as FinaleView;
          assert.equal(drawPumaFinale(view), true);
          assert.equal(bodies.length, 1);
          assert.equal(bodies[0][0], "zavarce");
          for (const p of poses) {
            assert.equal(p.facing, 1, "never rotate or invert bodies");
            assert.equal(p.y, p.pose.startsWith("ring") ? 510 - rise : 510);
          }
          if (tick === 180)
            assert.equal(
              bodies[0][1],
              783,
              "rival meets physical anchor at release",
            );
          for (const pose of PUMA_POSES) {
            const old = sheet.frames[pose];
            delete sheet.frames[pose];
            poses.length = 0;
            bodies.length = 0;
            try {
              assert.equal(drawPumaFinale(view), false);
              assert.equal(poses.length, 0);
              assert.equal(bodies.length, 0);
            } finally {
              sheet.frames[pose] = old;
            }
          }
        }
  assert.equal(new Set([12, 21, 30, 39].map((t) => pumaRingPose(t))).size, 4);
  assert.equal(
    new Set([12, 21, 30, 39].map((t) => pumaRingPose(t, 0))).size,
    1,
  );
});
test("Puma raw artwork, references, prompts and canonical identity hashes remain intact", async () => {
  const report = JSON.parse(
    await readFile("docs/finales/attack-overhaul/puma/provenance.json", "utf8"),
  );
  for (const [file, hash] of Object.entries({
    ...report.rawFiles,
    ...report.canonicalSha256,
    ...report.referenceSha256,
    ...report.promptSha256,
  }))
    assert.equal(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
      hash,
    );
  const audit = JSON.parse(
    await readFile("docs/finales/attack-overhaul/puma/grid-audit.json", "utf8"),
  );
  assert.equal(audit.exactRetainedRgbaRoundtrip, true);
  assert.equal(audit.objects.length, 6);
});

test("the corrected ring keeps v2 actor/A/C and v3 B/D whole cells with exact RGBA", async () => {
  const root = "assets/source/finales/attack-overhaul/puma/";
  const assembly = JSON.parse(
    await readFile("docs/finales/attack-overhaul/puma/assembly.json", "utf8"),
  );
  const result = await sharp(root + "puma-grid.png")
    .ensureAlpha()
    .raw()
    .toBuffer();
  for (const entry of assembly.cells) {
    const source = await sharp(root + entry.source)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const rows = [];
    for (let y = 0; y < assembly.cell; y++) {
      const start =
        ((Math.floor(entry.cell / 3) * assembly.cell + y) * assembly.width +
          (entry.cell % 3) * assembly.cell) *
        4;
      const end = start + assembly.cell * 4;
      assert.ok(
        result.subarray(start, end).equals(source.subarray(start, end)),
      );
      rows.push(result.subarray(start, end));
    }
    assert.equal(
      createHash("sha256").update(Buffer.concat(rows)).digest("hex"),
      entry.rgbaSha256,
    );
    assert.equal(
      entry.source,
      [3, 5].includes(entry.cell) ? "grid-v3.png" : "grid-v2.png",
    );
  }
  const corrected = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/puma/grid-v3-audit.json",
      "utf8",
    ),
  );
  assert.equal(corrected.exactRetainedRgbaRoundtrip, true);
});
