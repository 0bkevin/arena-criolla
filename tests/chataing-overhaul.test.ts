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
  CHATAING_POSES,
  CHATAING_SMASH_TICK,
  drawChataingFinale,
  drawChataingSpecial,
  drawWiredMicrophone,
} from "../src/game/finales/chataing";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "Luis", fighter: "chataing" as const, wins: 3 },
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

test("wired microphone physically connects once, stays attached through block/hit and is caught on both sides", () => {
  for (const side of [0, 1] as const)
    for (const gap of [55, 180, 300, 420])
      for (const guard of [false, true]) {
        const r = setup(side, gap);
        r.inputs[1 - side].block = guard;
        r.cast("special");
        let impact = false,
          consumed = false,
          lastDistance = Infinity,
          paid = r.source.energy;
        for (let n = 1; n < 110; n++) {
          const hp = r.target.hp;
          r.advance(1);
          const shot = r.state.projectiles[0];
          if (r.target.hp < hp) {
            impact = true;
            assert.ok(shot);
            assert.ok(Math.abs(shot.x - r.target.x) < 32);
            assert.equal(shot.returning, true);
            assert.equal(shot.connected, true);
          }
          if (shot?.connected) consumed = true;
          if (shot?.returning) {
            const d = Math.hypot(
              shot.x - (r.source.x + (shot.direction ?? 1) * -9),
              shot.y - (r.source.y - 129),
            );
            assert.ok(d <= lastDistance + 1e-8);
            lastDistance = d;
          }
        }
        assert.equal(r.source.attack, null);
        assert.equal(r.state.projectiles.length, 0);
        assert.equal(paid, 75);
        const hit = gap < 340 && !guard;
        assert.equal(impact, hit);
        assert.equal(r.source.hits, Number(hit));
        close(r.target.hp, hit ? 100 - 12 * 0.95 * 0.1 * 10 * 1.02 : 100);
        if (gap < 340) assert.equal(consumed, true);
      }
});

test("tether follows a jumping owner, serializes, suppresses duplicate casts and recalls after interruption", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 420);
    r.cast("special");
    r.advance(11);
    assert.equal(r.state.projectiles.length, 1);
    r.inputs[side].actions.jump++;
    r.advance(4);
    const copy: MatchState = JSON.parse(JSON.stringify(r.state));
    r.source.cooldown = 0;
    copy.players[side].cooldown = 0;
    r.inputs[side].actions.special++;
    const energy = r.source.energy;
    r.advance(1);
    stepMatch(copy, r.inputs);
    assert.deepEqual(JSON.parse(JSON.stringify(r.state)), copy);
    assert.ok(r.source.energy >= energy);
    assert.equal(r.state.projectiles.length, 1);
    r.source.attack = null;
    r.source.stun = 12;
    for (let n = 0; n < 90; n++) r.advance(1);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.target.hp, 100);
  }
});

test("Carolina parries the wired head back to its original owner without stealing its cable or damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 300, "carolina");
    r.inputs[1 - side].actions.special++;
    r.cast("special");
    let reflected = false;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles) {
        assert.equal(p.owner, side);
        if (p.returning && p.connected) reflected = true;
      }
    }
    assert.ok(reflected);
    assert.equal(r.source.hp, 100);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.source.attack, null);
  }
});

test("two Chataings throw two owned microphones simultaneously with symmetric damage and no duplicates", () => {
  const r = setup(0, 230, "chataing");
  r.inputs[0].actions.special++;
  r.inputs[1].actions.special++;
  let max = 0;
  for (let n = 0; n < 120; n++) {
    r.advance(1);
    max = Math.max(max, r.state.projectiles.length);
    assert.equal(
      new Set(r.state.projectiles.map((p) => p.owner)).size,
      r.state.projectiles.length,
    );
  }
  assert.equal(max, 2);
  assert.equal(r.source.hits, 1);
  assert.equal(r.target.hits, 1);
  close(r.source.hp, r.target.hp);
  assert.equal(r.state.projectiles.length, 0);
});

test("capture takeover and owner stock loss clean up an airborne wired microphone", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 200);
    r.cast("special");
    r.advance(10);
    assert.equal(r.state.projectiles.length, 1);
    r.inputs[1 - side].actions.super++;
    r.advance(9);
    assert.ok(r.state.finale);
    assert.equal(r.state.projectiles.length, 0);
    r.advance(220);
    assert.equal(r.state.finale, undefined);
    assert.equal(r.state.projectiles.length, 0);
    const dead = setup(side, 420);
    dead.cast("special");
    dead.advance(12);
    dead.source.hp = 0;
    dead.advance(1);
    assert.equal(dead.source.stocks, 1);
    assert.equal(dead.state.projectiles.length, 0);
    dead.advance(130);
    assert.equal(dead.source.stocks, 1);
  }
});

test("screen freezes any canonical rival, damages only on the visible smash and releases with the ordinary force", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["zavarce", "momoy", "silbon"] as const) {
      const r = setup(side, 180, rival);
      r.cast("super");
      r.advance(8);
      const scene = r.state.finale!;
      assert.ok(scene);
      assert.deepEqual(finaleById("chataing")!.damageBeats, [
        CHATAING_SMASH_TICK,
      ]);
      const positions = r.state.players.map((p) => [p.x, p.y]);
      const timer = r.state.remaining,
        tick = r.state.tick;
      r.advance(CHATAING_SMASH_TICK - 1);
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
      r.advance(180 - CHATAING_SMASH_TICK);
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

test("screen gates, guard, miss, interruption and lethal stocks retain shared rules", () => {
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

test("every Chataing pose and valid intrinsic image is required before either module paints", () => {
  const sheet = ATTACK_ART.chataing;
  const run = setup();
  run.cast("special");
  for (const absent of CHATAING_POSES) {
    const frame = sheet.frames[absent];
    delete sheet.frames[absent];
    let touched = false;
    const view = {
      images: { [sheet.file]: { width: 1536, height: 1024 } },
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
    assert.equal(drawChataingFinale(view), false);
    assert.equal(touched, false);
    if (absent !== "screen")
      assert.equal(
        drawChataingSpecial(
          view.ctx,
          run.state,
          view.images,
          run.source,
          0,
          177,
        ),
        false,
      );
    sheet.frames[absent] = frame;
  }
  for (const image of [
    undefined,
    { width: 0, height: 1024 },
    { width: 1536, height: 1024, naturalWidth: 0, naturalHeight: 0 },
    { width: 200, height: 200 },
  ])
    assert.equal(
      drawChataingFinale({
        images: image ? { [sheet.file]: image } : {},
      } as unknown as FinaleView),
      false,
    );
});

test("neutral microphone fallback works without optional artwork metadata and default anchors stay finite", () => {
  const sheet = ATTACK_ART.chataing,
    frame = sheet.frames.microphone;
  const calls: string[] = [];
  const ctx = new Proxy(
    { globalAlpha: 1 },
    {
      get(target, name) {
        if (name === "globalAlpha") return target.globalAlpha;
        return (...args: unknown[]) => {
          calls.push(String(name));
          for (const value of args)
            if (typeof value === "number") assert.ok(Number.isFinite(value));
        };
      },
      set(target, name, value) {
        if (typeof value === "number") assert.ok(Number.isFinite(value));
        if (name === "globalAlpha") target.globalAlpha = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  try {
    delete sheet.frames.microphone;
    for (const artwork of [false, true]) {
      calls.length = 0;
      drawWiredMicrophone(ctx, {}, { x: 35, y: 90 }, -1, 0.3, 40, artwork);
      assert.equal(calls.filter((name) => name === "ellipse").length, 1);
      assert.equal(calls.includes("drawImage"), false);
    }
    sheet.frames.microphone = { ...frame, anchorY: undefined };
    calls.length = 0;
    drawWiredMicrophone(
      ctx,
      {
        [sheet.file]: { width: 1536, height: 1024 } as HTMLImageElement,
      },
      { x: 35, y: 90 },
      1,
    );
    assert.equal(calls.filter((name) => name === "drawImage").length, 1);
    assert.equal(calls.includes("ellipse"), false);
  } finally {
    sheet.frames.microphone = frame;
  }
});
