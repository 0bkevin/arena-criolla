import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";
import { ATTACK_ART } from "../src/game/attack-art";
import {
  BOLIVAR_POSES,
  drawBolivarFinale,
  drawBolivarSpecial,
  bolivarSpecialPose,
} from "../src/game/finales/bolivar";
import type { FinaleView } from "../src/game/finales/types";
function setup(side: 0 | 1 = 0, distance = 80, wins = 3, energy = 100) {
  const actor = { name: "Bolívar", fighter: "bolivar" as const, wins },
    rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.invincible = 0;
    p.energy = 100;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * distance;
  target.facing = -source.facing;
  source.energy = energy;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}
test("Bolívar draws once and lands exactly three local sabre strikes with a single energy debit", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side),
      x = r.source.x;
    r.inputs[side].actions.special++;
    r.advance(1);
    assert.equal(r.source.energy, 75);
    const hits: number[] = [];
    let hp = r.target.hp;
    for (let i = 0; i < 75; i++) {
      r.advance(1);
      if (r.target.hp < hp) hits.push(r.source.attackTick);
      hp = r.target.hp;
    }
    assert.deepEqual(hits, [14, 26, 38]);
    assert.equal(r.source.hits, 3);
    assert.equal(r.source.x, x);
    assert.equal(r.source.attack, null);
    assert.equal(r.state.projectiles.length, 0);
  }
  assert.equal(TECHNIQUES.liberator.pulseRangeStep, 0);
  assert.equal(TECHNIQUES.liberator.dash, undefined);
});
test("Sabre respects range, facing, elevation, guard, low energy and interruption", () => {
  for (const side of [0, 1] as const) {
    for (const distance of [120, 210, -90]) {
      const r = setup(side, distance);
      r.inputs[side].actions.special++;
      r.advance(1);
      if (distance < 0) r.source.facing *= -1;
      r.advance(84);
      assert.equal(r.target.hp, 100);
    }
    const blocked = setup(side);
    blocked.inputs[1 - side].block = true;
    blocked.inputs[side].actions.special++;
    blocked.advance(85);
    assert.equal(blocked.target.hp, 100);
    const low = setup(side, 80, 3, 24);
    low.inputs[side].actions.special++;
    low.advance(1);
    assert.equal(low.source.attack, null);
    assert.ok(low.source.energy >= 24 && low.source.energy < 25);
    const elevated = setup(side);
    elevated.target.y = WORLD.floor - 180;
    elevated.target.vy = -8;
    elevated.target.grounded = false;
    elevated.inputs[side].actions.special++;
    elevated.advance(52);
    assert.equal(elevated.source.hits, 0);
    const interrupt = setup(side, 65);
    interrupt.inputs[1 - side].actions.light++;
    interrupt.advance(3);
    interrupt.inputs[side].actions.special++;
    interrupt.advance(85);
    assert.equal(interrupt.source.hits, 0);
    assert.ok(interrupt.source.hp < 100);
  }
});
test("Cavalry captures via input, freezes simulation, damages only on 96, releases at origin and serializes", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 180);
    r.inputs[side].actions.super++;
    r.advance(1);
    assert.equal(r.source.energy, 25);
    r.advance(8);
    const f = r.state.finale!;
    assert.ok(f);
    assert.deepEqual(finaleById("bolivar")!.damageBeats, [96]);
    const positions = r.state.players.map((p) => [p.x, p.y]),
      clock = [r.state.tick, r.state.remaining];
    r.advance(95);
    assert.equal(r.target.hp, 100);
    const copy = JSON.parse(JSON.stringify(r.state));
    r.advance(1);
    stepMatch(copy, [...r.inputs]);
    assert.deepEqual(copy, r.state);
    assert.ok(r.target.hp < 100);
    assert.deepEqual(
      r.state.players.map((p) => [p.x, p.y]),
      positions,
    );
    assert.deepEqual([r.state.tick, r.state.remaining], clock);
    assert.equal(r.source.hits, 1);
    r.advance(84);
    assert.equal(r.state.finale, undefined);
    assert.deepEqual(
      r.state.players.map((p) => [p.x, p.y]),
      positions,
    );
    assert.equal(Math.sign(r.target.vx), side ? -1 : 1);
    assert.equal(r.target.stocks, 2);
    assert.equal(r.source.attack, null);
    r.inputs[side].right = true;
    r.advance(20);
    assert.notEqual(r.source.x, positions[side][0]);
  }
});
test("Cavalry obeys unlock, depletion, failed capture, defense and death-on-release", () => {
  for (const side of [0, 1] as const) {
    for (const [wins, energy] of [
      [0, 100],
      [2, 100],
      [3, 74],
    ]) {
      const r = setup(side, 180, wins, energy);
      r.inputs[side].actions.super++;
      r.advance(9);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
    }
    for (const mode of ["miss", "behind", "guard", "interrupt"]) {
      const r = setup(
        side,
        mode === "miss" ? 430 : mode === "behind" ? -180 : 65,
      );
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.super++;
      r.advance(1);
      if (mode === "behind") r.source.facing *= -1;
      r.advance(99);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
    }
    for (const stocks of [1, 2]) {
      const r = setup(side, 180);
      r.target.hp = 1;
      r.target.stocks = stocks;
      r.inputs[side].actions.super++;
      r.advance(9 + 96);
      assert.equal(r.target.hp, 0);
      assert.equal(r.target.stocks, stocks);
      r.advance(84);
      assert.equal(r.target.stocks, stocks - 1);
      assert.equal(r.state.phase, stocks === 1 ? "finished" : "playing");
    }
  }
});
test("Four sabre phases preserve one blade and fully preflight all fourteen finale poses", () => {
  assert.deepEqual([1, 14, 26, 38, 48].map(bolivarSpecialPose), [
    "draw",
    "slash",
    "cut",
    "thrust",
    "draw",
  ]);
  assert.equal(BOLIVAR_POSES.length, 14);
  const r = setup();
  r.inputs[0].actions.special++;
  r.advance(14);
  assert.equal(
    drawBolivarSpecial({} as CanvasRenderingContext2D, {}, r.source, 177),
    false,
  );
  let painted = 0;
  const view = {
    images: {},
    body: () => painted++,
    art: () => painted++,
  } as unknown as FinaleView;
  assert.equal(drawBolivarFinale(view), false);
  assert.equal(painted, 0);
  const sheet = ATTACK_ART.bolivar,
    images = {
      [sheet.file]: { width: 3584, height: 1024 } as HTMLImageElement,
    };
  const saved = sheet.frames["llanero-6"];
  delete sheet.frames["llanero-6"];
  try {
    assert.equal(drawBolivarFinale({ ...view, images }), false);
    assert.equal(painted, 0);
  } finally {
    sheet.frames["llanero-6"] = saved;
  }
});
test("Raw assets, references and canonical identity remain hashed and alpha island is lossless", async () => {
  const p = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/bolivar/provenance.json",
      "utf8",
    ),
  );
  for (const [file, hash] of Object.entries({
    ...p.rawFiles,
    ...p.references,
    ...p.canonicalSha256,
  }))
    assert.equal(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
      hash,
    );
  const audit = JSON.parse(
    await readFile(
      "docs/finales/attack-overhaul/bolivar/v4-soft-audit.json",
      "utf8",
    ),
  );
  assert.equal(audit.exactRetainedRgbaRoundtrip, true);
  assert.equal(audit.rawIsland.pixels, 16);
  assert.equal(audit.rawIsland.maxAlpha, 2);
  assert.equal(audit.distances[audit.owner].core, 2);
});
