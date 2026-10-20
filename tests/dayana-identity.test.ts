import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";
import { fighterById, type FighterId } from "../shared/content";
import { finaleById } from "../shared/finales";
import { ATTACK_ART } from "../src/game/attack-art";
import {
  DAYANA_CONTACT_TICKS,
  DAYANA_POSES,
  drawDayanaFinale,
  drawDayanaProjectile,
} from "../src/game/finales/dayana";
import type { FinaleView } from "../src/game/finales/types";
import { drawDeynaBallProjectile } from "../src/game/finales/deyna";
import { TECHNIQUES } from "../shared/techniques";

function setup(side: 0 | 1, rival: FighterId = "deyna", gap = 180) {
  const queen = { name: "Queen", fighter: "dayana" as const, wins: 3 },
    guest = { name: "Guest", fighter: rival, wins: 3 };
  const state = createMatch("caracas", side ? [guest, queen] : [queen, guest]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 750 : 400;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  state.players.forEach((p) => {
    p.invincible = 0;
    p.energy = 100;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
  };
  return { state, source, target, inputs, advance };
}

test("Dayana is the 2008 beauty queen; Deyna owns all football techniques and their original timings", () => {
  const queen = fighterById("dayana"),
    footballer = fighterById("deyna");
  assert.equal(queen.name, "Dayana Mendoza");
  assert.equal(footballer.name, "Deyna Castellanos");
  assert.match(queen.description, /Vestido amarillo/);
  assert.doesNotMatch(queen.description, /balón|futbolista|Camiseta/);
  assert.equal(queen.special, "Giro de pasarela");
  assert.equal(queen.ability, "corona");
  assert.equal(footballer.ability, "football");
  assert.notEqual(queen.sprite, footballer.sprite);
  assert.deepEqual(TECHNIQUES.football, {
    startup: 21,
    recovery: 54,
    range: 550,
    height: 130,
    damage: 15,
    force: 8,
    projectile: {
      speed: 8,
      life: 65,
      count: 1,
      radius: 13,
      offsetX: 48,
      offsetY: 16,
    },
  });
  assert.deepEqual(finaleById("deyna")!.damageBeats, [100]);
  assert.deepEqual(finaleById("dayana")!.damageBeats, [
    ...DAYANA_CONTACT_TICKS,
  ]);
  assert.notEqual(ATTACK_ART.dayana.file, ATTACK_ART.deyna.file);
});

test("Dayana's chiffon leaves at body height, hits once on either side, respects guard and disappears after a miss", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "guard", "miss", "interrupt", "energy"]) {
      const r = setup(
        side,
        "zavarce",
        mode === "miss" ? 900 : mode === "interrupt" ? 65 : 180,
      );
      r.source.config.wins = 0;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "energy") r.source.energy = 24;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      let first: (typeof r.state.projectiles)[number] | undefined;
      for (let n = 0; n < 120; n++) {
        r.advance(1);
        first ??= r.state.projectiles[0] && { ...r.state.projectiles[0] };
      }
      if (mode === "hit") {
        assert.ok(r.target.hp < 100);
        assert.equal(r.source.hits, 1);
      } else assert.equal(r.target.hp, 100, mode);
      if (mode === "energy" || mode === "interrupt")
        assert.equal(first, undefined);
      else {
        assert.equal(first!.kind, "corona");
        assert.equal(first!.y, r.source.y - 112);
        assert.equal(first!.radius, 20);
        assert.equal(Math.sign(first!.vx), side ? -1 : 1);
      }
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.source.attack, null);
    }
});

test("coronation damages exactly on the three painted arrivals, preserves the arena and releases every rival", () => {
  for (const side of [0, 1] as const)
    for (const rival of ["deyna", "momoy", "silbon"] as const) {
      const r = setup(side, rival);
      r.inputs[side].actions.super++;
      r.advance(9);
      const scene = r.state.finale!;
      assert.ok(scene);
      const positions = r.state.players.map((p) => [p.x, p.y]),
        timer = r.state.remaining;
      for (let tick = 1; tick <= 180; tick++) {
        const prior = r.target.hp;
        r.advance(1);
        if (DAYANA_CONTACT_TICKS.includes(tick as 60 | 96 | 132))
          assert.ok(r.target.hp < prior, `impact ${tick}`);
        else assert.equal(r.target.hp, prior, `no early damage ${tick}`);
        assert.equal(r.state.stage, "caracas");
        assert.equal(r.state.remaining, timer);
      }
      assert.equal(r.state.finale, undefined);
      assert.equal(r.source.hits, 1);
      assert.deepEqual(
        r.state.players.map((p) => [p.x, p.y]),
        positions,
      );
      assert.ok(Math.abs(r.target.hp - (100 - scene.damage)) < 1e-8);
      assert.equal(r.target.invincible, 12);
    }
});

test("coronation retains progression, energy, facing guard, range and serialized replay rules", () => {
  for (const side of [0, 1] as const) {
    for (const reason of ["wins", "energy", "guard", "range"]) {
      const r = setup(side, "deyna", reason === "range" ? 650 : 180);
      if (reason === "wins") r.source.config.wins = 2;
      if (reason === "energy") r.source.energy = 74;
      if (reason === "guard") r.inputs[1 - side].block = true;
      r.inputs[side].actions.super++;
      r.advance(50);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
    }
    const r = setup(side);
    r.inputs[side].actions.super++;
    r.advance(90);
    const copy = JSON.parse(JSON.stringify(r.state)) as MatchState;
    for (let tick = 0; tick < 180; tick++) {
      r.advance(1);
      stepMatch(copy, r.inputs);
      assert.deepEqual(copy, r.state);
    }
  }
});

test("every pageant crop is checked before drawing; a missing sheet keeps projectiles visible and identities separate", () => {
  const sheet = ATTACK_ART.dayana;
  const width = Math.max(
      ...Object.values(sheet.frames).map((f) => f.x + f.width),
    ),
    height = Math.max(
      ...Object.values(sheet.frames).map((f) => f.y + f.height),
    );
  for (const pose of DAYANA_POSES) {
    const f = sheet.frames[pose];
    delete sheet.frames[pose];
    try {
      assert.equal(
        drawDayanaFinale({
          images: { [sheet.file]: { width, height } },
          ctx: new Proxy(
            {},
            {
              get() {
                throw Error("partial draw");
              },
            },
          ),
        } as unknown as FinaleView),
        false,
      );
    } finally {
      sheet.frames[pose] = f;
    }
  }
  let painted = 0;
  const ctx = new Proxy(
    {
      save() {},
      restore() {},
      beginPath() {},
      arc() {
        painted++;
      },
      stroke() {},
    },
    { get: (t, k) => Reflect.get(t, k) ?? (() => {}) },
  ) as unknown as CanvasRenderingContext2D;
  const r = setup(0);
  r.inputs[0].actions.special++;
  r.advance(21);
  const shot = r.state.projectiles[0];
  assert.ok(shot);
  assert.equal(drawDayanaProjectile(ctx, {}, shot), true);
  assert.ok(painted);
  assert.equal(drawDeynaBallProjectile(ctx, {}, shot), false);
  assert.equal(
    drawDayanaProjectile(ctx, {}, { ...shot, kind: "football" }),
    false,
  );
});

test("the painted coronation keeps its rival, floor anchors and physical impacts through elevated and reduced motion layouts", () => {
  const sheet = ATTACK_ART.dayana,
    width = Math.max(...Object.values(sheet.frames).map((f) => f.x + f.width)),
    height = Math.max(
      ...Object.values(sheet.frames).map((f) => f.y + f.height),
    );
  for (const motion of [0, 1])
    for (const lift of [0, -125])
      for (const tick of [0, 38, 59, 60, 75, 96, 120, 132, 155, 179]) {
        const r = setup(0);
        r.inputs[0].actions.super++;
        r.advance(9);
        const draws: unknown[][] = [],
          bodies: unknown[][] = [],
          translations: number[][] = [];
        const ctx = new Proxy(
          {
            globalAlpha: 1,
            drawImage(...args: unknown[]) {
              draws.push(args);
            },
            translate(x: number, y: number) {
              translations.push([x, y]);
            },
          },
          { get: (t, k) => Reflect.get(t, k) ?? (() => {}) },
        ) as unknown as CanvasRenderingContext2D;
        const result = drawDayanaFinale({
          ctx,
          state: r.state,
          profile: finaleById("dayana")!,
          actor: "dayana",
          rival: "deyna",
          tick,
          pulse: DAYANA_CONTACT_TICKS.includes(tick as 60 | 96 | 132) ? 1 : 0,
          beat: 0,
          motion,
          images: { [sheet.file]: { width, height } as HTMLImageElement },
          sprites: {},
          viewport: { left: 0, right: 1080, top: 0, bottom: 640 },
          art() {
            return true;
          },
          text() {},
          bubble() {},
          ring() {},
          point: (x: number, y: number) => ({ x, y: y + lift }),
          body: (...args: unknown[]) => {
            bodies.push(args);
          },
          damage() {},
        } as unknown as FinaleView);
        assert.equal(result, true);
        assert.equal(bodies.length, 1);
        assert.equal(bodies[0][0], "deyna");
        assert.deepEqual(bodies[0].slice(1, 3), [782, 514]);
        assert.ok(translations.some(([, y]) => y === 514 + lift));
        assert.ok(draws.length);
        for (const call of draws)
          assert.ok(
            call
              .slice(1)
              .every((n) => typeof n === "number" && Number.isFinite(n)),
          );
      }
});
