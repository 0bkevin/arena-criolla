import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, type FighterId } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../../shared/engine";
import {
  INTRO_TOTAL_TICKS,
  normalizedFacing,
  presentationById,
  selectionProgress,
} from "../../shared/presentation";
import {
  ENTRANCE_ACTIONS,
  sampleEntranceAction,
} from "../../shared/entrance-actions";
import entranceAssets from "../../shared/entrance-assets.json";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(
  side: 0 | 1 = 0,
  gap = 280,
  wins = 3,
  rivalId: FighterId = "javier",
) {
  const configs = [
    { name: "Audit Dudamel", fighter: "dudamel" as const, wins },
    { name: "Audit Javier", fighter: rivalId, wins: 3 },
  ] as const;
  const state = createMatch(
    "poliedro",
    side === 0 ? [...configs] : [configs[1], configs[0]],
    "dudamel-v28-audit",
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}
function emit(check: string, value: unknown) {
  console.log(JSON.stringify({ character: "dudamel", check, evidence: value }));
}

test("Dudamel preserves cadenza, all eight facings and the approved one-shot v24 conducting entrance", () => {
  const f = fighterById("dudamel"),
    p = presentationById("dudamel");
  assert.equal(f.name, "Gustavo Dudamel");
  assert.equal(f.ability, "cadenza");
  assert.equal(f.special, "Cadenza expansiva");
  assert.deepEqual(f.combos, [
    "Primer compás",
    "Cambio de tempo",
    "Gran cadenza",
  ]);
  assert.equal(TECHNIQUES.cadenza.reflect, undefined);
  assert.equal(TECHNIQUES.cadenza.projectile?.growth, 0.65);
  assert.equal(TECHNIQUES.cadenza.startup, 18);
  assert.equal(p.introStyle, "conduct");
  assert.equal(p.selectionStyle, "conduct");
  assert.equal(p.prop, "baton");
  assert.equal(p.battleFrame, 1);
  assert.equal(entranceAssets.dudamel.file, "dudamel-entrance-v24");
  assert.equal(entranceAssets.dudamel.frames.length, 12);
  assert.equal(ENTRANCE_ACTIONS.dudamel?.turns, 0);
  const frames = ENTRANCE_ACTIONS.dudamel!.frames.map(
    (f) => sampleEntranceAction("dudamel", f.at + 0.001)?.current.frame,
  );
  assert.deepEqual(
    frames,
    Array.from({ length: 12 }, (_, n) => n),
  );
  for (const progress of [0, 0.9, 1, 2])
    assert.equal(sampleEntranceAction("dudamel", progress), null);
  assert.equal(selectionProgress("dudamel", 2800), 1);
  assert.equal(selectionProgress("dudamel", 5600), 1);
  for (let frame = 0; frame < 8; frame++)
    for (const facing of [1, -1])
      assert.equal(normalizedFacing("dudamel", frame, facing), facing);
  emit("presentation", {
    intro: p.introName,
    choreographyMetadata: CHOREOGRAPHIES.dudamel.name,
    paintedEntranceOverridesChoreography: true,
    frames,
  });
});

test("Dudamel walks, faces both directions, jumps twice, rejects a third jump and lands on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.player.x = 540;
    r.rival.x = 920;
    const start = r.player.x;
    r.inputs[side].right = true;
    r.advance(24);
    const right = r.player.x;
    assert.ok(right > start + 90);
    assert.equal(r.player.facing, 1);
    r.inputs[side].right = false;
    r.inputs[side].left = true;
    r.advance(24);
    const left = r.player.x;
    assert.ok(left < right - 90);
    assert.equal(r.player.facing, -1);
    r.inputs[side].left = false;
    r.advance(10);
    r.inputs[side].actions.jump++;
    r.advance(10);
    const firstY = r.player.y;
    assert.equal(r.player.jumps, 1);
    assert.ok(firstY < WORLD.floor);
    r.inputs[side].actions.jump++;
    r.advance(1);
    assert.equal(r.player.jumps, 2);
    const secondVy = r.player.vy;
    r.inputs[side].actions.jump++;
    r.advance(1);
    assert.equal(r.player.jumps, 2);
    assert.ok(r.player.vy > secondVy);
    r.advance(100);
    assert.equal(r.player.grounded, true);
    assert.equal(r.player.y, WORLD.floor);
    assert.equal(r.player.jumps, 0);
    emit("movement", {
      side,
      start,
      right,
      left,
      firstY,
      finalY: r.player.y,
      stocks: r.player.stocks,
    });
  }
});

test("Dudamel light and heavy each connect once and obey a facing guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const action of ["light", "heavy"] as const)
      for (const guard of [false, true]) {
        const r = setup(side, 80);
        r.inputs[1 - side].block = guard;
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 8 : 13);
        close(
          r.rival.hp,
          guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.97 * 1.03,
        );
        assert.equal(r.player.hits, guard ? 0 : 1);
        assert.equal(Math.sign(r.rival.vx), side === 0 ? 1 : -1);
        assert.ok(
          r.state.effects.some(
            (e) => e.kind === (guard ? "block" : "hit") && e.impact === action,
          ),
        );
        r.advance(40);
        assert.equal(r.player.hits, guard ? 0 : 1);
        emit("ordinary-attack", {
          side,
          action,
          guard,
          hp: r.rival.hp,
          hits: r.player.hits,
          energy: r.rival.energy,
        });
      }
});

test("Cadenza spends 25 energy and its tick-18 musical wave hits idle/rear guard and respects frontal guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const guard of ["idle", "front", "rear"] as const) {
      const r = setup(side, 80);
      r.inputs[1 - side].block = guard !== "idle";
      if (guard === "rear")
        r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      const origin = r.player.x;
      r.inputs[side].actions.special++;
      r.advance(1);
      close(r.player.energy, 75);
      r.advance(16);
      assert.equal(r.rival.hp, 100);
      assert.equal(r.player.attackTick, 17);
      r.advance(1);
      const strikeTick = r.state.tick;
      r.advance(65);
      assert.equal(r.player.hits, guard === "front" ? 0 : 1);
      close(r.rival.hp, guard === "front" ? 100 : 88.0108);
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.player.attack, null);
      close(r.player.x, origin);
      emit("special-strike", {
        side,
        guard,
        strikeTick,
        hp: r.rival.hp,
        hits: r.player.hits,
        energy: r.player.energy,
        targetEnergy: r.rival.energy,
      });
    }
  for (const side of [0, 1] as const)
    for (const energy of [24, 25]) {
      const r = setup(side);
      r.player.energy = energy;
      r.inputs[side].actions.special++;
      r.advance(1);
      assert.equal(r.player.attack, energy === 24 ? null : "special");
      if (energy === 25) close(r.player.energy, 0.035);
    }
});

test("Dudamel recognizes base and upgraded combos, connects every strike with approach inputs, and enforces super gates on both sides", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) {
        r.inputs[side].actions.light++;
        r.advance(23);
      }
      r.inputs[side].actions.heavy++;
      r.advance(11);
      assert.equal(r.player.combo, wins ? "Cambio de tempo" : "Primer compás");
      assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.97 + (wins ? 7 : 3)) * 1.03);
      emit("combo-gate", {
        side,
        wins,
        combo: r.player.combo,
        bonus: r.player.comboBonus,
        hits: r.player.hits,
        hp: r.rival.hp,
      });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, advanced ? 1 : 0);
      const attacks = advanced
        ? (["light", "light", "heavy"] as const)
        : (["light", "heavy"] as const);
      for (const action of attacks) {
        for (
          let n = 0;
          n < 70 &&
          (r.player.cooldown ||
            Math.abs(r.rival.x - r.player.x) > 80 ||
            !r.rival.grounded);
          n++
        ) {
          const dx = r.rival.x - r.player.x;
          r.inputs[side].left = dx < -70;
          r.inputs[side].right = dx > 70;
          r.advance(1);
        }
        r.inputs[side].left = false;
        r.inputs[side].right = false;
        r.advance(8);
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length);
      assert.equal(
        r.player.combo,
        advanced ? "Cambio de tempo" : "Primer compás",
      );
      emit("connected-combo", {
        side,
        combo: r.player.combo,
        hits: r.player.hits,
        hp: r.rival.hp,
        elapsed: r.state.tick - INTRO_TOTAL_TICKS,
      });
    }
    for (const [wins, energy] of [
      [0, 100],
      [1, 100],
      [2, 89],
      [2, 100],
      [3, 100],
    ] as const) {
      const r = setup(side, 200, wins);
      r.player.energy = energy;
      r.inputs[side].actions.super++;
      r.advance(9);
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "dudamel"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (wins < 2 || energy < 90) {
        assert.equal(r.player.attack, null);
        assert.equal(r.rival.hp, 100);
      } else {
        assert.equal(r.player.combo, "Gran cadenza");
        assert.equal(r.player.comboBonus, 12);
        assert.equal(r.state.finale, undefined);
        assert.equal(r.player.attack, null);
      }
      emit("super-gate", {
        side,
        wins,
        energy,
        hp: r.rival.hp,
        attackerEnergy: r.player.energy,
        combo: r.player.combo,
      });
    }
  }
});

test("Dudamel intro blocks action until the full shared timeline completes", () => {
  const state = createMatch("poliedro", [
    { name: "Dudamel", fighter: "dudamel", wins: 3 },
    { name: "Javier", fighter: "javier", wins: 3 },
  ]);
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].right = true;
  inputs[0].actions.special++;
  const start = state.players[0].x;
  for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
  assert.equal(state.phase, "intro");
  assert.equal(state.players[0].x, start);
  assert.equal(state.projectiles.length, 0);
  stepMatch(state, inputs);
  assert.equal(state.phase, "playing");
  assert.equal(state.players[0].facing, 1);
  assert.equal(state.players[1].facing, -1);
});

function cpuFight() {
  const r = setup(0, 420, 3);
  let cpu = emptyInput();
  const started = new Set<string>(),
    landed = new Set<string>();
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[0].left = n >= 180 && dx < -85;
    r.inputs[0].right = n >= 180 && dx > 85;
    r.inputs[0].block =
      n >= 180 &&
      r.rival.attack === "heavy" &&
      Math.abs(dx) < 190 &&
      r.state.tick % 100 < 30;
    if (
      n >= 180 &&
      !r.player.cooldown &&
      !r.player.stun &&
      !r.inputs[0].block
    ) {
      const action =
        Math.abs(dx) < 230 && r.player.energy >= 90
          ? "super"
          : Math.abs(dx) < 145 && r.player.energy >= 25
            ? "special"
            : Math.abs(dx) < 145
              ? r.state.tick % 3
                ? "light"
                : "heavy"
              : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if (
      (r.rival.y < r.player.y - 60 || r.player.x < 120 || r.player.x > 960) &&
      r.player.jumps < 2 &&
      r.state.tick % 34 === 0
    )
      r.inputs[0].actions.jump++;
    cpu = cpuInput(r.state, cpu, "normal");
    r.inputs[1] = cpu;
    r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects)
      if (e.kind === "hit" && e.owner === 0) landed.add(e.impact!);
    for (const p of r.state.players)
      assert.ok(
        Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.hp >= 0 &&
          p.hp <= 100,
      );
  }
  assert.equal(r.state.phase, "finished");
  assert.ok(r.player.hits > 0);
  assert.ok(r.rival.hits > 0);
  assert.ok(started.has("special"));
  return { state: r.state, started: [...started], landed: [...landed] };
}
test("a complete Dudamel fight versus normal CPU finishes and deterministically replays", () => {
  const first = cpuFight(),
    second = cpuFight();
  assert.deepEqual(first, second);
  emit("cpu-fight", {
    winner: first.state.winner,
    tick: first.state.tick,
    remaining: first.state.remaining,
    started: first.started,
    landed: first.landed,
    players: first.state.players.map((p) => ({
      fighter: p.config.fighter,
      hp: p.hp,
      stocks: p.stocks,
      hits: p.hits,
      peakCombo: p.peakCombo,
    })),
  });
});
