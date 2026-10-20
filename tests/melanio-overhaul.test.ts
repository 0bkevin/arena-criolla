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
  MELANIO_CONTACT_TICK,
  MELANIO_BODY_HEIGHTS,
  MELANIO_FINAL_POSES,
  MELANIO_SPECIAL_POSES,
  melanioSpecialPose,
  melanioApproach,
  drawMelanioSpecial,
  drawMelanioFinale,
} from "../src/game/finales/melanio";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Melanio", fighter: "melanio" as const, wins: 3 },
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

test("phone finale captures any canonical rival, damages only on the visible front contact and releases with the ordinary force", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["zavarce", "momoy", "silbon"] as const) {
      const r = setup(side, 180, rival);
      r.cast("super");
      r.advance(8);
      const scene = r.state.finale!;
      assert.ok(scene);
      assert.deepEqual(finaleById("melanio")!.damageBeats, [
        MELANIO_CONTACT_TICK,
      ]);
      const positions = r.state.players.map((p) => [p.x, p.y]);
      const timer = r.state.remaining,
        tick = r.state.tick;
      r.advance(MELANIO_CONTACT_TICK - 1);
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
      r.advance(180 - MELANIO_CONTACT_TICK);
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

test("phone finale gates, guard, miss, interruption and lethal stocks retain shared rules", () => {
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
      r.advance(8 + 114);
      assert.equal(r.target.hp, 0);
      assert.equal(r.target.stocks, stocks);
      assert.equal(r.state.phase, "playing");
      r.advance(66);
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

test("every Melanio pose and valid intrinsic image is required before the module paints", () => {
  const sheet = ATTACK_ART.melanio;
  const run = setup();
  run.cast("special");
  for (const absent of MELANIO_FINAL_POSES) {
    const frame = sheet.frames[absent];
    delete sheet.frames[absent];
    let touched = false;
    const view = {
      images: { [sheet.file]: { width: 2048, height: 1024 } },
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
    assert.equal(drawMelanioFinale(view), false);
    assert.equal(touched, false);
    sheet.frames[absent] = frame;
  }
  for (const image of [
    undefined,
    { width: 0, height: 1536 },
    { width: 2048, height: 1024, naturalWidth: 0, naturalHeight: 0 },
    { width: 200, height: 200 },
  ])
    assert.equal(
      drawMelanioFinale({
        images: image ? { [sheet.file]: image } : {},
      } as unknown as FinaleView),
      false,
    );
});

test("captured phone finale serializes and resumes identically through impact and ordinary release", () => {
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

test("record and flash remain harmless until a physical phone contact; all recorded states resume identically", () => {
  for (const side of [0, 1] as const)
    for (const at of [18, 65, 66, 75, 96, 113]) {
      const r = setup(side);
      r.cast("super");
      r.advance(8 + at);
      assert.equal(r.target.hp, 100);
      assert.equal(r.source.hits, 0);
      assert.equal(r.state.finale!.tick, at);
    }
});

test("signal preserves real release21, recovery29, return leg, guard, miss and interruption in both seats", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "guard", "miss", "interrupt"]) {
      const r = setup(
        side,
        mode === "miss" ? 600 : mode === "interrupt" ? 65 : 180,
      );
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.heavy++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      const shots = new Set<number>();
      let returned = false;
      for (let n = 1; n <= 100; n++) {
        r.advance(1);
        for (const p of r.state.projectiles) {
          shots.add(p.id);
          returned ||= (p.age ?? 0) >= (p.returnAfter ?? Infinity);
        }
        if (n === 20 && mode !== "interrupt") assert.equal(shots.size, 0);
        if (n === 21 && mode !== "interrupt") assert.equal(shots.size, 1);
      }
      assert.equal(shots.size, mode === "interrupt" ? 0 : 1);
      if (mode === "hit") assert.ok(r.target.hp < 100);
      else assert.equal(r.target.hp, 100);
      if (mode === "miss") assert.ok(returned);
      assert.equal(r.source.attack, null);
      assert.equal(r.state.projectiles.length, 0);
    }
  assert.equal(melanioSpecialPose(20), "signal-windup");
  assert.equal(melanioSpecialPose(21), "signal-release");
  assert.equal(melanioSpecialPose(28), "signal-release");
  assert.equal(melanioSpecialPose(29), undefined);
});

test("a missing special cell fails preflight before drawing; movement and hurt regain the canonical body", () => {
  const r = setup();
  r.cast("special");
  const sheet = ATTACK_ART.melanio;
  const images = {
    [sheet.file]: { width: 2048, height: 1024 },
  } as unknown as Record<string, HTMLImageElement>;
  for (const absent of MELANIO_SPECIAL_POSES) {
    const saved = sheet.frames[absent];
    delete sheet.frames[absent];
    assert.equal(
      drawMelanioSpecial({} as CanvasRenderingContext2D, images, r.source, 177),
      false,
    );
    sheet.frames[absent] = saved;
  }
  r.source.attackTick = 29;
  assert.equal(
    drawMelanioSpecial({} as CanvasRenderingContext2D, images, r.source, 177),
    false,
  );
  r.source.attackTick = 21;
  r.source.stun = 2;
  assert.equal(
    drawMelanioSpecial({} as CanvasRenderingContext2D, images, r.source, 177),
    false,
  );
});

test("phone travel reaches contact once, returns to anchor before release", async () => {
  assert.equal(melanioApproach(90), 0);
  assert.ok(melanioApproach(113) < 1);
  assert.equal(melanioApproach(114), 1);
  assert.equal(melanioApproach(168), 0);
  assert.ok(
    melanioApproach(115, true) < 1,
    "airborne strike immediately returns instead of hovering",
  );
  assert.equal(melanioApproach(168, true), 0);
  assert.ok(
    MELANIO_BODY_HEIGHTS["strike-low"] < MELANIO_BODY_HEIGHTS.record,
    "bent knees preserve character scale",
  );
});
