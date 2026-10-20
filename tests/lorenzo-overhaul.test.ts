import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type MatchState,
  type Input,
} from "../shared/engine";
import { type FighterId } from "../shared/content";
import { finaleById } from "../shared/finales";

import {
  LORENZO_POSES,
  LORENZO_CONTACT_TICK,
  lorenzoSpecialPose,
  drawLorenzoFinale,
} from "../src/game/finales/lorenzo";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";

import { createHash } from "node:crypto";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Lorenzo", fighter: "lorenzo" as const, wins: 3 },
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

test("P.A.N. finale captures any canonical rival, damages only on the visible front contact and releases with the ordinary force", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["zavarce", "momoy", "silbon"] as const) {
      const r = setup(side, 180, rival);
      r.cast("super");
      r.advance(8);
      const scene = r.state.finale!;
      assert.ok(scene);
      assert.deepEqual(finaleById("lorenzo")!.damageBeats, [
        LORENZO_CONTACT_TICK,
      ]);
      const positions = r.state.players.map((p) => [p.x, p.y]);
      const timer = r.state.remaining,
        tick = r.state.tick;
      r.advance(LORENZO_CONTACT_TICK - 1);
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
      r.advance(180 - LORENZO_CONTACT_TICK);
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

test("P.A.N. finale gates, guard, miss, interruption and lethal stocks retain shared rules", () => {
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

test("every Lorenzo pose and valid intrinsic image is required before the module paints", () => {
  const sheet = ATTACK_ART.lorenzo;
  const run = setup();
  run.cast("special");
  for (const absent of LORENZO_POSES) {
    const frame = sheet.frames[absent];
    delete sheet.frames[absent];
    let touched = false;
    const view = {
      images: { [sheet.file]: { width: 2560, height: 1024 } },
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
    assert.equal(drawLorenzoFinale(view), false);
    assert.equal(touched, false);
    sheet.frames[absent] = frame;
  }
  for (const image of [
    undefined,
    { width: 0, height: 1536 },
    { width: 2560, height: 1024, naturalWidth: 0, naturalHeight: 0 },
    { width: 200, height: 200 },
  ])
    assert.equal(
      drawLorenzoFinale({
        images: image ? { [sheet.file]: image } : {},
      } as unknown as FinaleView),
      false,
    );
});

test("captured P.A.N. finale serializes and resumes identically through impact and ordinary release", () => {
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

test("preparation and volley remain harmless until a physical P.A.N. contact; all recorded states resume identically", () => {
  for (const side of [0, 1] as const)
    for (const at of [18, 35, 54, 65, 75, 95]) {
      const r = setup(side);
      r.cast("super");
      r.advance(8 + at);
      assert.equal(r.target.hp, 100);
      assert.equal(r.source.hits, 0);
      assert.equal(r.state.finale!.tick, at);
    }
});

test("three P.A.N. bags launch from the hand and hit at close range, block, miss and interrupt", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "close", "guard", "miss", "interrupt"]) {
      const r = setup(
        side,
        mode === "close"
          ? 55
          : mode === "interrupt"
            ? 65
            : mode === "miss"
              ? 900
              : 180,
      );
      r.source.config.wins = 0;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      const ids = new Set<number>();
      let slowed = false;
      for (let n = 1; n <= 120; n++) {
        r.advance(1);
        if (n === 1) assert.equal(r.source.energy, 75);
        r.state.projectiles.forEach((s) => ids.add(s.id));
        slowed ||= r.target.slowTicks > 0;
      }
      if (mode === "hit" || mode === "close") {
        assert.ok(r.target.hp < 100, mode);
        assert.ok(r.source.hits >= 1);
        assert.ok(slowed);
      }
      if (["guard", "miss", "interrupt"].includes(mode))
        assert.equal(r.target.hp, 100, mode);
      if (mode === "interrupt") assert.equal(ids.size, 0);
      else if (mode !== "close") assert.equal(ids.size, 3);
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.source.attack, null);
    }
  const r = setup(0, 450);
  r.inputs[0].actions.special++;
  r.advance(14);
  assert.equal(r.state.projectiles.length, 0);
  r.advance(1);
  assert.equal(r.state.projectiles.length, 3);
  for (const [n, shot] of r.state.projectiles.entries()) {
    assert.equal(shot.x, r.source.x + 36 + 8);
    close(shot.y, r.source.y - 107 + (n - 1) * 1.6);
    assert.equal(shot.kind, "polar");
    assert.equal(shot.radius, 16);
  }
  assert.equal(lorenzoSpecialPose(10), "windup");
  assert.equal(lorenzoSpecialPose(14), "throw");
  assert.equal(lorenzoSpecialPose(23), "recover");
  assert.equal(lorenzoSpecialPose(43), undefined);
});

test("P.A.N. cost failure and serialized in-flight replay preserve deterministic engine rules", () => {
  for (const side of [0, 1] as const) {
    const poor = setup(side);
    poor.source.energy = 24;
    poor.inputs[side].actions.special++;
    poor.advance(25);
    assert.equal(poor.source.attack, null);
    assert.equal(poor.target.hp, 100);
    const r = setup(side, 450);
    r.cast("special");
    r.advance(25);
    const copy = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      stepMatch(copy, r.inputs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(copy)),
        JSON.parse(JSON.stringify(r.state)),
      );
    }
  }
});
