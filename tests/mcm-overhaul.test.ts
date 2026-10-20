import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type MatchState,
  type Input,
} from "../shared/engine";
import { fighterById, type FighterId } from "../shared/content";
import { finaleById } from "../shared/finales";
import {
  MCM_POSES,
  MCM_CONTACT_TICK,
  MCM_BODY_HEIGHTS,
  drawMcmFinale,
} from "../src/game/finales/mcm";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Mcm", fighter: "mcm" as const, wins: 3 },
    b = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [b, a] : [a, b]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
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

test("caravan captures any canonical rival, damages only on the visible front contact and releases with the ordinary force", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["zavarce", "momoy", "silbon"] as const) {
      const r = setup(side, 180, rival);
      r.cast("super");
      r.advance(8);
      const scene = r.state.finale!;
      assert.ok(scene);
      assert.deepEqual(finaleById("mcm")!.damageBeats, [MCM_CONTACT_TICK]);
      const positions = r.state.players.map((p) => [p.x, p.y]);
      const timer = r.state.remaining,
        tick = r.state.tick;
      r.advance(MCM_CONTACT_TICK - 1);
      assert.equal(r.target.hp, 100);
      r.advance(1);
      close(r.target.hp, 100 - scene.damage);
      assert.equal(r.source.hits, 1);
      assert.equal(r.state.tick, tick);
      assert.equal(r.state.remaining, timer);
      assert.deepEqual(
        r.state.players.map((p) => [p.x, p.y]),
        positions,
      );
      r.inputs[side].actions.special++;
      r.advance(180 - MCM_CONTACT_TICK);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.source.attack, null);
      close(r.target.vx, 12 * (1 + (100 - r.target.hp) / 90) * (side ? -1 : 1));
      assert.equal(r.target.invincible, 12);
      r.advance(65);
      r.inputs[1 - side].actions.jump++;
      r.advance(1);
      assert.ok(r.target.vy < 0);
      assert.equal(r.state.projectiles.length, 0);
    }
});

test("caravan gates, guard, miss, interruption and lethal stocks retain shared rules", () => {
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
      r.advance(8 + 96);
      assert.equal(r.target.hp, 0);
      assert.equal(r.target.stocks, stocks);
      assert.equal(r.state.phase, "playing");
      r.advance(84);
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

test("every Mcm pose and valid intrinsic image is required before the module paints", () => {
  const sheet = ATTACK_ART.mcm;
  const run = setup();
  run.cast("special");
  for (const absent of MCM_POSES) {
    const frame = sheet.frames[absent];
    delete sheet.frames[absent];
    let touched = false;
    const view = {
      images: { [sheet.file]: { width: 1536, height: 1536 } },
      ctx: new Proxy(
        {},
        {
          get() {
            touched = true;
            throw Error("partial paint");
          },
        },
      ),
    } as unknown as FinaleView;
    assert.equal(drawMcmFinale(view), false);
    assert.equal(touched, false);
    sheet.frames[absent] = frame;
  }
  for (const image of [
    undefined,
    { width: 0, height: 1536 },
    { width: 1536, height: 1536, naturalWidth: 0, naturalHeight: 0 },
    { width: 200, height: 200 },
  ])
    assert.equal(
      drawMcmFinale({
        images: image ? { [sheet.file]: image } : {},
      } as unknown as FinaleView),
      false,
    );
});

test("rally damages once only within physical dash contact, including the278/279 boundary", () => {
  for (const side of [0, 1] as const)
    for (const gap of [140, 278, 279, 300, 345]) {
      const r = setup(side, gap);
      r.cast("special");
      const impacts: number[] = [];
      let hp = r.target.hp;
      for (let tick = 2; tick <= 80; tick++) {
        r.advance(1);
        if (r.target.hp < hp) impacts.push(tick);
        hp = r.target.hp;
      }
      assert.deepEqual(impacts, gap === 140 ? [13] : gap === 278 ? [23] : []);
      assert.equal(r.source.hits, gap <= 278 ? 1 : 0);
      assert.equal(r.source.attack, null);
      assert.equal(r.state.projectiles.length, 0);
    }
});

test("captured caravan serializes and resumes identically through impact and ordinary release", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.cast("super");
    r.advance(8 + 75);
    const replay = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 140; n++) {
      stepMatch(replay, r.inputs);
      r.advance(1);
      assert.deepEqual(replay, r.state);
    }
  }
});

test("caravan uses a real approach before contact and preserves all generated source provenance", async () => {
  const { mcmChargeProgress } = await import("../src/game/finales/mcm");
  assert.equal(mcmChargeProgress(54), 0);
  assert.ok(mcmChargeProgress(80) > 0);
  assert.ok(mcmChargeProgress(95) < 1);
  assert.equal(mcmChargeProgress(96), 1);
  const base = "docs/finales/attack-overhaul/mcm/";
  for (const name of ["truck", "empty", "people", "flag"]) {
    const grid = JSON.parse(
      await readFile(base + name + "-grid-audit.json", "utf8"),
    );
    assert.equal(grid.exactRetainedRgbaRoundtrip, true);
    assert.equal(grid.objects.length, name === "people" ? 6 : 1);
  }
  const pack = JSON.parse(await readFile(base + "assets.json", "utf8"));
  for (const obj of pack.objects.filter(
    (o: { pose: string }) => MCM_BODY_HEIGHTS[o.pose],
  )) {
    const frame = pack.frames[obj.pose];
    assert.ok(
      Math.abs(
        (MCM_BODY_HEIGHTS[obj.pose] / frame.bodyHeight) * obj.uniformScale - 1,
      ) < 0.002,
    );
  }
  const provenance = JSON.parse(
    await readFile(base + "provenance.json", "utf8"),
  );
  for (const [path, hash] of Object.entries({
    ...provenance.rawFiles,
    ...provenance.canonicalSha256,
    ...provenance.referenceSha256,
    ...provenance.promptSha256,
  }))
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      hash,
    );
});

test("transparent margin adds no edits to source RGBA and inversely reproduces every original byte", async () => {
  const sharp = (await import("sharp")).default;
  const audit = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/mcm/padding-audit.json",
      "utf8",
    ),
  );
  for (const item of audit.objects) {
    const original = await sharp(item.source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const inverse = await sharp(item.padded)
      .extract({
        left: 40,
        top: 40,
        width: original.info.width,
        height: original.info.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer();
    assert.deepEqual(inverse, original.data);
    assert.equal(item.exactInverse, true);
  }
});
