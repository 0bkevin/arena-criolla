import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "./helpers/charged-finale-engine";
import type { FighterId } from "../shared/content";
import {
  SQUAD_COUNT,
  SQUAD_LAUNCH_TICK,
  RUNWAY_POSE_TICKS,
  squadMember,
  fieldFinaleBounds,
} from "../shared/field-finales";
import { drawDeynaSquad, DEYNA_POSES } from "../src/game/finales/deyna";
import { drawDayanaRunway, DAYANA_POSES } from "../src/game/finales/dayana";
import { ATTACK_ART } from "../src/game/attack-art";
import { advanceArenaCamera, cameraBounds } from "../src/game/arena-camera";
function run(
  id: "dayana" | "deyna",
  side: 0 | 1 = 0,
  gap = 180,
  rival: FighterId = "zavarce",
) {
  const a = { name: id, fighter: id, wins: 3 },
    b = { name: "rival", fighter: rival, wins: 3 };
  const state = createMatch("caracas", side ? [b, a] : [a, b]);
  state.phase = "playing";
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 720 : 400;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n = 1) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
    advance(9);
  };
  return { state, source, target, inputs, advance, start, side };
}
function until(r: ReturnType<typeof run>, condition: () => boolean, max = 400) {
  for (let i = 0; i < max && !condition(); i++) r.advance();
  assert.ok(condition(), "simulation reached condition");
}

test("both live finales are available from zero wins and preserve cost, interruption and no-overlap gates", () => {
  for (const id of ["dayana", "deyna"] as const)
    for (const side of [0, 1] as const) {
      for (const reason of ["energy", "guard", "interrupt"]) {
        const r = run(id, side, reason === "interrupt" ? 65 : 180);
        r.source.config.wins = 0;
        if (reason === "energy") r.source.energy = 89;
        if (reason === "guard") r.inputs[side].block = true;
        if (reason === "interrupt") {
          r.inputs[1 - side].actions.light++;
          r.advance(3);
        }
        r.start();
        assert.equal(r.state.fieldFinales, undefined, `${id}/${reason}`);
        assert.equal(r.state.finale, undefined);
      }
      const r = run(id, side, 600);
      r.source.config.wins = 0;
      r.inputs[side].actions.super++;
      r.advance();
      assert.equal(r.source.energy, 10);
      r.advance(8);
      assert.equal(r.state.fieldFinales?.length, 1);
      r.source.energy = 100;
      r.source.cooldown = 0;
      r.inputs[side].actions.super++;
      r.advance();
      assert.equal(r.state.fieldFinales?.length, 1);
      assert.ok(r.source.energy >= 99, "refresh consumes no additional energy");
    }
  const air = run("dayana");
  air.source.grounded = false;
  air.source.y = WORLD.floor - 100;
  air.start();
  assert.equal(air.state.fieldFinales, undefined);
  assert.equal(air.source.attack, null);
  assert.equal(air.source.energy, 100);
});

test("Deyna summons exactly five teammates and five physical footballs, without freezing clock, rival or caster", () => {
  for (const side of [0, 1] as const) {
    const r = run("deyna", side, 400);
    r.start();
    const field = r.state.fieldFinales![0],
      tick = r.state.tick,
      time = r.state.remaining;
    assert.equal(r.state.finale, undefined);
    assert.equal(field.tick, 0);
    assert.equal(r.target.hp, 100);
    r.inputs[1 - side].actions.jump++;
    r.inputs[1 - side][side ? "left" : "right"] = true;
    r.advance(15);
    assert.ok(r.target.y < WORLD.floor);
    assert.ok(r.state.tick >= tick + 15);
    assert.ok(r.state.remaining <= time - 15);
    assert.equal(r.source.attack, null);
    const x = r.source.x;
    r.inputs[side][side ? "left" : "right"] = true;
    until(r, () => r.state.projectiles.length === 5);
    assert.ok(
      (r.source.x - x) * (side ? -1 : 1) > 5,
      "caster moves before the squad fires",
    );
    assert.equal(field.tick, SQUAD_LAUNCH_TICK);
    assert.equal(r.target.hp, 100);
    assert.deepEqual(
      r.state.projectiles.map((p) => p.formationIndex),
      [0, 1, 2, 3, 4],
    );
    for (const shot of r.state.projectiles) {
      const member = squadMember(field, shot.formationIndex!);
      assert.equal(shot.kind, "football");
      assert.equal(shot.impact, "super");
      assert.ok(
        (shot.x - member.x) * field.direction > 0,
        "each ball leaves in front of its own teammate",
      );
      assert.equal(shot.homing, undefined);
      assert.equal(shot.growth, undefined);
      assert.equal(shot.vy, 0);
    }
    assert.equal(
      new Set(r.state.projectiles.map((p) => p.id)).size,
      SQUAD_COUNT,
    );
    r.advance(160);
    assert.equal(r.state.fieldFinales, undefined);
    assert.equal(r.state.projectiles.length, 0);
  }
});

test("squad balls use real contact, facing guard, evasion, reflection and immediate stock loss", () => {
  for (const side of [0, 1] as const) {
    for (const mode of ["hit", "guard", "miss"]) {
      const r = run("deyna", side, mode === "miss" ? 850 : 180);
      if (mode === "guard") r.inputs[1 - side].block = true;
      r.start();
      r.advance(180);
      if (mode === "hit") {
        assert.ok(r.target.hp < 100);
        assert.ok(r.source.hits > 0 && r.source.hits <= 5);
      } else assert.equal(r.target.hp, 100, mode);
      assert.equal(r.state.finale, undefined);
    }
    const lethal = run("deyna", side);
    lethal.target.hp = 1;
    lethal.target.stocks = 1;
    lethal.start();
    until(lethal, () => lethal.state.phase === "finished");
    assert.equal(lethal.target.stocks, 0);
    assert.equal(lethal.state.finale, undefined);
    const reflected = run("deyna", side, 180, "carolina");
    reflected.start();
    until(
      reflected,
      () => reflected.state.fieldFinales![0].tick === SQUAD_LAUNCH_TICK - 5,
    );
    reflected.inputs[1 - side].actions.special++;
    let seen = false;
    for (let i = 0; i < 55; i++) {
      reflected.advance();
      seen ||= reflected.state.projectiles.some(
        (p) =>
          p.owner === 1 - side && p.kind === "football" && p.impact === "super",
      );
    }
    assert.ok(seen, "Carolina reflects a live squad ball");
  }
});

test("Dayana walks forward and poses on a real combat clock, with only nearby physical damage", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "guard", "miss"]) {
      const r = run("dayana", side, mode === "miss" ? 650 : 180);
      if (mode === "guard") r.inputs[1 - side].block = true;
      r.start();
      assert.equal(r.state.finale, undefined);
      const origin = r.source.x;
      const beats: number[] = [];
      let lastHp = r.target.hp;
      for (let i = 0; i < 300 && r.state.fieldFinales; i++) {
        const field = r.state.fieldFinales?.[0];
        r.advance();
        if (r.target.hp < lastHp) {
          beats.push(field!.tick);
          lastHp = r.target.hp;
        }
        assert.equal(r.state.finale, undefined);
      }
      assert.ok(
        (r.source.x - origin) * (side ? -1 : 1) > 150,
        "walk advances through the runway",
      );
      assert.equal(r.state.fieldFinales, undefined);
      assert.equal(r.source.attack, null);
      assert.ok(r.state.tick > 150);
      if (mode === "hit") {
        assert.ok(beats.length > 0);
        assert.ok(
          beats.every((t) => RUNWAY_POSE_TICKS.includes(t as 42 | 90 | 138)),
        );
      } else assert.equal(r.target.hp, 100, mode);
    }
});

test("runway can be evaded, interrupted, cancelled by a jump and rejects an unsupported startup", () => {
  for (const side of [0, 1] as const) {
    const interrupted = run("dayana", side, 65);
    interrupted.start();
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(10);
    assert.equal(interrupted.state.fieldFinales, undefined);
    assert.ok(interrupted.source.hp < 100);
    assert.ok(
      interrupted.source.cooldown < 50,
      "interruption does not strand the remaining performance cooldown",
    );
    const jumped = run("dayana", side, 500);
    jumped.start();
    jumped.advance(20);
    jumped.inputs[side].actions.jump++;
    jumped.advance();
    assert.equal(jumped.state.fieldFinales, undefined);
    assert.ok(jumped.source.vy < 0);
    assert.equal(jumped.source.attack, null);
    const evasive = run("dayana", side, 180);
    evasive.start();
    evasive.inputs[1 - side][side ? "left" : "right"] = true;
    evasive.advance(40);
    evasive.inputs[1 - side][side ? "left" : "right"] = false;
    evasive.advance(220);
    assert.equal(evasive.target.hp, 100, "opponent can leave the attack area");
    const elevated = run("dayana", side, 500);
    elevated.source.y = WORLD.floor - 150;
    elevated.source.supportPlatform = null;
    elevated.source.grounded = true;
    elevated.start(); // unsupported startup must not create a floating runway
    assert.equal(elevated.state.fieldFinales, undefined);
  }
});

test("owner stock loss clears fields, and simultaneous squads serialize without shared clocks or IDs", () => {
  const r = run("deyna", 0, 600, "deyna");
  r.inputs[0].actions.super++;
  r.inputs[1].actions.super++;
  r.advance(9);
  assert.equal(r.state.fieldFinales?.length, 2);
  assert.equal(new Set(r.state.fieldFinales?.map((f) => f.id)).size, 2);
  const copy = JSON.parse(JSON.stringify(r.state)) as MatchState;
  for (let n = 0; n < 210; n++) {
    r.advance();
    stepMatch(copy, r.inputs);
    assert.deepEqual(copy, r.state);
  }
  const lost = run("deyna");
  lost.start();
  lost.source.hp = 0;
  lost.advance();
  assert.equal(lost.state.fieldFinales, undefined);
  for (const id of ["dayana", "deyna"] as const) {
    const replay = run(id);
    replay.start();
    replay.advance(22);
    const saved = JSON.parse(JSON.stringify(replay.state)) as MatchState;
    for (let n = 0; n < 230; n++) {
      replay.advance();
      stepMatch(saved, replay.inputs);
      assert.deepEqual(saved, replay.state);
    }
  }
});

test("temporary actors stay within the arena and camera from either edge and facing", () => {
  for (const id of ["dayana", "deyna"] as const)
    for (const side of [0, 1] as const) {
      const r = run(id, side, 100);
      r.source.x = side ? WORLD.right - 8 : WORLD.left + 8;
      r.target.x = r.source.x + (side ? -100 : 100);
      r.start();
      for (const bounds of fieldFinaleBounds(r.state)) {
        assert.ok(bounds.left >= WORLD.x);
        assert.ok(bounds.right <= WORLD.x + WORLD.width);
      }
      const camera = advanceArenaCamera(undefined, r.state, 1440, 800),
        viewport = cameraBounds(camera, 1440, 800);
      for (const bounds of fieldFinaleBounds(r.state)) {
        assert.ok(bounds.left >= viewport.x);
        assert.ok(bounds.right <= viewport.x + viewport.width);
      }
    }
});

test("squad and runway painters decline before drawing when any pose frame is missing", () => {
  const dimensions = (id: "dayana" | "deyna") => {
    const sheet = ATTACK_ART[id];
    return { [sheet.file]: { width: 2048, height: 2048 } as HTMLImageElement };
  };
  for (const id of ["dayana", "deyna"] as const) {
    const r = run(id);
    r.start();
    const field = r.state.fieldFinales![0],
      sheet = ATTACK_ART[id];
    for (const pose of id === "dayana" ? DAYANA_POSES : DEYNA_POSES) {
      const original = sheet.frames[pose];
      delete sheet.frames[pose];
      try {
        const ctx = new Proxy(
          {},
          {
            get() {
              throw Error("partial field paint");
            },
          },
        ) as CanvasRenderingContext2D;
        assert.equal(
          id === "dayana"
            ? drawDayanaRunway(ctx, dimensions(id), field)
            : drawDeynaSquad(ctx, dimensions(id), field),
          false,
        );
      } finally {
        sheet.frames[pose] = original;
      }
    }
  }
});

test("the runway supports an elevated walk and a capture cancels it without stranding recovery", () => {
  const elevated = run("dayana", 0, 500);
  elevated.source.x = 230;
  elevated.source.y = 392;
  elevated.source.grounded = true;
  elevated.source.supportPlatform = 0;
  elevated.start();
  assert.ok(elevated.state.fieldFinales);
  const y = elevated.source.y;
  elevated.advance(100);
  assert.equal(elevated.source.y, y);
  assert.ok(elevated.source.x > 300);
  assert.equal(elevated.state.finale, undefined);
  const captured = run("dayana", 0, 85, "capriles");
  captured.start();
  captured.inputs[1].actions.super++;
  captured.advance(9);
  assert.equal(captured.state.finale?.fighter, "capriles");
  assert.equal(captured.state.fieldFinales, undefined);
  captured.advance(180);
  assert.ok(captured.source.cooldown < 50);
  captured.advance(80);
  captured.inputs[0].actions.light++;
  captured.advance();
  assert.equal(captured.source.attack, "light");
});
