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
  GEORGE_POSES,
  GEORGE_CONTACT_TICK,
  drawGeorgeFinale,
  georgeCurtainHem,
} from "../src/game/finales/george";
import { ATTACK_ART } from "../src/game/attack-art";
import type { FinaleView } from "../src/game/finales/types";

function setup(side: 0 | 1 = 0, gap = 180, rival: FighterId = "zavarce") {
  const a = { name: "George", fighter: "george" as const, wins: 3 },
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

test("curtain captures any canonical rival, damages only on the visible hem contact and releases with the ordinary force", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["zavarce", "momoy", "silbon"] as const) {
      const r = setup(side, 180, rival);
      r.cast("super");
      r.advance(8);
      const scene = r.state.finale!;
      assert.ok(scene);
      assert.deepEqual(finaleById("george")!.damageBeats, [
        GEORGE_CONTACT_TICK,
      ]);
      const positions = r.state.players.map((p) => [p.x, p.y]);
      const timer = r.state.remaining,
        tick = r.state.tick;
      r.advance(GEORGE_CONTACT_TICK - 1);
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
      r.advance(180 - GEORGE_CONTACT_TICK);
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

test("curtain gates, guard, miss, interruption and lethal stocks retain shared rules", () => {
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

test("every George pose and valid intrinsic image is required before the module paints", () => {
  const sheet = ATTACK_ART.george;
  const run = setup();
  run.cast("special");
  for (const absent of GEORGE_POSES) {
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
    assert.equal(drawGeorgeFinale(view), false);
    assert.equal(touched, false);
    sheet.frames[absent] = frame;
  }
  for (const image of [
    undefined,
    { width: 0, height: 1024 },
    { width: 1536, height: 1024, naturalWidth: 0, naturalHeight: 0 },
    { width: 200, height: 200 },
  ])
    assert.equal(
      drawGeorgeFinale({
        images: image ? { [sheet.file]: image } : {},
      } as unknown as FinaleView),
      false,
    );
});

test("curtain hem reaches every rival crown exactly on96, covers and lifts before release", () => {
  for (const feet of [516, 410, 620])
    for (const displayHeight of [140, 177, 198]) {
      const crown = feet - (300 * displayHeight) / 177,
        rail = feet - 424;
      assert.equal(georgeCurtainHem(59, feet, crown, rail), rail);
      assert.ok(georgeCurtainHem(95, feet, crown, rail) < crown);
      close(georgeCurtainHem(96, feet, crown, rail), crown);
      close(georgeCurtainHem(112, feet, crown, rail), feet);
      close(georgeCurtainHem(139, feet, crown, rail), feet);
      assert.ok(georgeCurtainHem(154, feet, crown, rail) < feet);
      close(georgeCurtainHem(170, feet, crown, rail), rail);
    }
});

test("special preserves two contact beats, increasing reach, guard and recovery in both slots", () => {
  for (const side of [0, 1] as const)
    for (const gap of [55, 120, 220, 279, 280, 420])
      for (const guard of [false, true]) {
        const r = setup(side, gap);
        r.inputs[1 - side].block = guard;
        r.cast("special");
        const impacts: number[] = [];
        for (let n = 1; n < 100; n++) {
          const hp = r.target.hp;
          r.advance(1);
          if (r.target.hp < hp) impacts.push(r.source.attackTick);
        }
        assert.equal(r.source.attack, null);
        assert.equal(r.state.projectiles.length, 0);
        assert.ok(impacts.every((t) => t === 14 || t === 30));
        if (guard || gap >= 280) assert.deepEqual(impacts, []);
        if (!guard && gap >= 190 && gap < 280) assert.deepEqual(impacts, [30]);
        if (!guard && gap === 120) assert.deepEqual(impacts, [14, 30]);
      }
});

test("special startup interruption and energy gate do not emit pulses; active capture replays after JSON serialization", () => {
  for (const side of [0, 1] as const) {
    const low = setup(side);
    low.source.energy = 24;
    low.inputs[side].actions.special++;
    low.advance(60);
    assert.equal(low.source.hits, 0);
    assert.equal(low.source.attack, null);
    const r = setup(side, 65);
    r.inputs[1 - side].actions.light++;
    r.advance(3);
    r.cast("special");
    r.advance(80);
    assert.equal(r.source.hits, 0);
    assert.equal(r.target.hp, 100);
    const f = setup(side);
    f.cast("super");
    f.advance(8 + 80);
    const copy: MatchState = JSON.parse(JSON.stringify(f.state));
    for (let n = 0; n < 150; n++) {
      f.advance(1);
      stepMatch(copy, f.inputs);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(f.state)), copy);
  }
});

test("contact follows the selected canonical battle-frame height and labels follow the presented rival", () => {
  const r = setup(0, 55, "silbon");
  r.cast("super");
  r.advance(8 + 96);
  const before = JSON.stringify(r.state);
  const labels: { text: string; x: number; y: number }[] = [];
  const modes: unknown[] = [];
  const context = new Proxy(
    { globalAlpha: 1 },
    {
      get(target, key) {
        return key in target ? Reflect.get(target, key) : () => {};
      },
    },
  );
  const sprite = {
    bodyHeight: 400,
    battleFrame: 1,
    frames: [{ height: 400 }, { height: 300 }],
  };
  const view = {
    ctx: context,
    state: r.state,
    profile: finaleById("george")!,
    actor: "george",
    rival: "silbon",
    tick: 96,
    pulse: 1,
    beat: 0,
    motion: 1,
    images: { [ATTACK_ART.george.file]: { width: 1536, height: 1024 } },
    sprites: { silbon: sprite },
    viewport: { left: 0, right: 1080, top: 0, bottom: 640 },
    point: (x: number, y: number) => ({ x: 300 + ((x - 333) * 100) / 433, y }),
    body: (
      _id: unknown,
      _x: unknown,
      _feet: unknown,
      _height: unknown,
      _facing: unknown,
      mode: unknown,
    ) => modes.push(mode),
    bubble: (text: string, x: number, y: number) => labels.push({ text, x, y }),
    text: (text: string, x: number, y: number) => labels.push({ text, x, y }),
  } as unknown as FinaleView;
  assert.equal(drawGeorgeFinale(view), true);
  assert.equal(JSON.stringify(r.state), before);
  assert.deepEqual(modes, ["stand"]);
  const damage = labels.find((l) => l.text.includes("VIDA"))!,
    bubble = labels.find((l) => l.text.includes("show"))!;
  close(damage.y, 523 - ((300 * 198) / 177) * (300 / 400) - 42);
  assert.ok(
    damage.x - bubble.x > 280,
    "close capture dialogue and damage remain separated",
  );
});
