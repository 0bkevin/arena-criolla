import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";
import type { FighterId } from "../shared/content";
import { finaleById } from "../shared/finales";
import {
  ALI_POSES,
  ALI_ACTOR_POSES,
  ALI_BODY_HEIGHTS,
  aliPoseHeight,
  aliSpecialPose,
  aliLift,
  drawAliFinale,
  drawAliSpecial,
} from "../src/game/finales/ali";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";
import { writeFinaleMusic } from "../src/game/finale-sounds";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Alí", fighter: "ali" as const, wins: 3 },
    b = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [b, a] : [a, b]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const cast = (move: "special" | "super") => {
    inputs[side].actions[move]++;
    advance(1);
    assert.equal(source.energy, move === "special" ? 75 : 25);
  };
  return { state, source, target, inputs, advance, cast };
}
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("Alí waves retain all three damage beats, capture clock and physical positions, ordinary release and control on both slots", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["zavarce", "momoy", "silbon"] as const) {
      const r = setup(side, 180, rival);
      r.cast("super");
      r.advance(8);
      const scene = r.state.finale!;
      assert.ok(scene);
      assert.deepEqual(finaleById("ali")!.damageBeats, [42, 90, 138]);
      assert.equal(finaleById("ali")!.release, undefined);
      const positions = r.state.players.map((p) => [p.x, p.y]),
        clock = r.state.tick,
        remaining = r.state.remaining;
      let last = 0;
      for (const [i, beat] of [42, 90, 138].entries()) {
        r.advance(beat - last - 1);
        close(r.target.hp, 100 - (scene.damage * i) / 3);
        r.advance(1);
        close(r.target.hp, 100 - (scene.damage * (i + 1)) / 3);
        assert.equal(r.state.tick, clock);
        assert.equal(r.state.remaining, remaining);
        assert.deepEqual(
          r.state.players.map((p) => [p.x, p.y]),
          positions,
        );
        last = beat;
      }
      r.inputs[side].actions.special++;
      r.advance(180 - last);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.source.attack, null);
      assert.equal(r.source.hits, 1);
      close(r.target.vx, 12 * (1 + (100 - r.target.hp) / 90) * (side ? -1 : 1));
      assert.equal(r.target.invincible, 12);
      r.advance(65);
      r.inputs[1 - side].actions.jump++;
      r.advance(1);
      assert.ok(r.target.vy < 0);
      assert.equal(r.state.projectiles.length, 0);
    }
});
test("Alí unlock, cost, guard, miss, interruption and lethal stocks retain shared rules", () => {
  for (const side of [0, 1] as const) {
    for (const reason of ["wins", "energy", "guard", "miss", "interrupt"]) {
      const r = setup(side, reason === "interrupt" ? 65 : 180);
      if (reason === "wins") r.source.config.wins = 2;
      if (reason === "energy") r.source.energy = 74;
      if (reason === "guard") r.inputs[1 - side].block = true;
      if (reason === "miss") r.target.x += r.source.facing * 400;
      if (reason === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.super++;
      r.advance(55);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
      assert.equal(r.source.attack, null);
    }
    for (const stocks of [1, 2]) {
      const r = setup(side);
      r.target.hp = 1;
      r.target.stocks = stocks;
      r.cast("super");
      r.advance(8 + 42);
      assert.equal(r.target.hp, 0);
      assert.equal(r.target.stocks, stocks);
      r.advance(138);
      assert.equal(r.target.stocks, stocks - 1);
      r.advance(90);
      assert.equal(r.target.stocks, stocks - 1);
      if (stocks === 1) {
        assert.equal(r.state.phase, "finished");
        assert.equal(r.state.winner, side);
      } else assert.equal(r.target.hp, 100);
    }
  }
});
test("Alí special downstrokes coincide with all real ground projectile emissions in both directions", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280);
    r.cast("special");
    const emissions = new Map<number, number>();
    for (let tick = 2; tick <= 50; tick++) {
      r.advance(1);
      for (const p of r.state.projectiles)
        if (!emissions.has(p.id)) {
          emissions.set(p.id, r.source.attackTick);
          assert.ok(p.groundOnly);
          assert.equal(p.kind, "strum");
          assert.equal(Math.sign(p.vx), side ? -1 : 1);
          assert.equal(
            aliSpecialPose(r.source.attackTick),
            r.source.attackTick === 36 ? "accent" : "downstroke",
          );
        }
    }
    assert.deepEqual([...emissions.values()], [12, 24, 36]);
  }
  assert.equal(aliSpecialPose(11), "upstroke");
  assert.equal(aliSpecialPose(23), "upstroke");
  assert.equal(aliSpecialPose(35), "upstroke");
  assert.equal(aliSpecialPose(48), "ready");
  assert.equal(aliLift(41), 0);
  assert.ok(aliLift(68) > 0);
  assert.ok(aliLift(114) > aliLift(68));
  assert.equal(aliLift(174), 0);
});
test("all ten poses preflight before any finale paint; four actor poses preflight before any special paint", () => {
  const sheet = ATTACK_ART.ali;
  for (const missing of ALI_POSES) {
    const frame = sheet.frames[missing];
    delete sheet.frames[missing];
    try {
      assert.equal(
        drawAliFinale({
          images: { [sheet.file]: { width: 2560, height: 1024 } },
          ctx: new Proxy(
            {},
            {
              get() {
                throw Error("partial paint");
              },
            },
          ),
        } as unknown as FinaleView),
        false,
      );
    } finally {
      sheet.frames[missing] = frame;
    }
  }
  for (const missing of ALI_ACTOR_POSES) {
    const frame = sheet.frames[missing];
    delete sheet.frames[missing];
    const r = setup();
    r.cast("special");
    try {
      assert.equal(
        drawAliSpecial(
          new Proxy(
            {},
            {
              get() {
                throw Error("partial special");
              },
            },
          ) as CanvasRenderingContext2D,
          { [sheet.file]: { width: 2560, height: 1024 } as HTMLImageElement },
          r.source,
          177,
        ),
        false,
      );
    } finally {
      sheet.frames[missing] = frame;
    }
  }
  for (const image of [
    undefined,
    { width: 0, height: 1024 },
    { width: 2560, height: 1024, naturalWidth: 0, naturalHeight: 0 },
    { width: 100, height: 100 },
  ])
    assert.equal(
      drawAliFinale({
        images: image ? { [sheet.file]: image } : {},
      } as unknown as FinaleView),
      false,
    );
});
test("captured Alí serializes and resumes identically through all three contacts and release", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.cast("super");
    r.advance(8 + 30);
    const clone = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 180; n++) {
      stepMatch(clone, r.inputs);
      r.advance(1);
      assert.deepEqual(clone, r.state);
    }
  }
});
test("Alí retains every original source and complete silhouette with uniform actor head scale", async () => {
  const base = "docs/finales/attack-overhaul/ali/";
  for (const group of ["actor", "choir"]) {
    const a = JSON.parse(
      await readFile(base + group + "-grid-audit.json", "utf8"),
    );
    assert.ok(a.exactRetainedRgbaRoundtrip);
    assert.equal(a.objects.length, group === "actor" ? 4 : 6);
  }
  const pack = JSON.parse(await readFile(base + "assets.json", "utf8"));
  for (const obj of pack.objects.filter(
    (o: { pose: string }) => ALI_BODY_HEIGHTS[o.pose],
  )) {
    const scale =
      (aliPoseHeight(obj.pose, 305) / pack.frames[obj.pose].bodyHeight) *
      obj.uniformScale;
    close(
      Math.round(scale * 1000) / 1000,
      Math.round((305 / 601) * 1000) / 1000,
    );
  }
  const provenance = JSON.parse(
    await readFile(base + "provenance.json", "utf8"),
  );
  for (const [path, hash] of Object.entries(provenance.sha256))
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      hash,
    );
});
test("Alí original four-string and synthetic choir score is deterministic, finite, stereo and non-clipping", () => {
  const rate = 12000,
    left = new Float32Array(rate * 3),
    right = new Float32Array(rate * 3),
    copyL = new Float32Array(rate * 3),
    copyR = new Float32Array(rate * 3);
  writeFinaleMusic(left, right, rate, "ali");
  writeFinaleMusic(copyL, copyR, rate, "ali");
  assert.deepEqual(left, copyL);
  assert.deepEqual(right, copyR);
  assert.notDeepEqual(left, right);
  assert.ok(left.some((n) => n !== 0));
  for (const n of [...left, ...right])
    assert.ok(Number.isFinite(n) && Math.abs(n) < 1);
});
