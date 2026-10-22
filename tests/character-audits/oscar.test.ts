import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../helpers/charged-finale-engine";
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

function setup(side: 0 | 1 = 0, gap = 80, wins = 3) {
  const configs = [
    { name: "Audit Oscar", fighter: "oscar" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch(
    "poliedro",
    side === 0 ? [...configs] : [configs[1], configs[0]],
    "oscar-v28-audit",
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    rival = state.players[1 - side];
  player.x = side === 0 ? 400 : 680;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const emit = (check: string, evidence: unknown) =>
  console.log(JSON.stringify({ character: "oscar", check, evidence }));

test("Oscar preserves identity and the approved microphone, singing, single salsa turn and held guard", () => {
  const f = fighterById("oscar"),
    p = presentationById("oscar"),
    action = ENTRANCE_ACTIONS.oscar!;
  assert.equal(f.name, "Óscar D’León");
  assert.equal(f.ability, "salsa");
  assert.equal(f.special, "Giro del sonero");
  assert.deepEqual(f.combos, [
    "Paso de salsa",
    "Síncopa doble",
    "Cierre del sonero",
  ]);
  assert.equal(p.battleFrame, 1);
  assert.equal(p.introStyle, "dance");
  assert.equal(action.turns, 1);
  assert.deepEqual(
    action.frames.map((f) => f.phase).filter((p, n, all) => p !== all[n - 1]),
    ["draw", "sing", "turn", "settle"],
  );
  assert.ok(action.frames.every((f) => !f.mirror));
  assert.equal(new Set(action.frames.map((f) => f.frame)).size, 16);
  let previous = -1;
  for (let tick = 1; tick < 168; tick++) {
    const s = sampleEntranceAction("oscar", tick / 168);
    if (s) {
      assert.ok(s.current.frame >= previous);
      previous = s.current.frame;
    }
  }
  for (const elapsed of [2800, 5600, 60000]) {
    assert.equal(selectionProgress("oscar", elapsed), 1);
    assert.equal(
      sampleEntranceAction("oscar", selectionProgress("oscar", elapsed)),
      null,
    );
  }
  for (let frame = 0; frame < 8; frame++)
    for (const facing of [-1, 1])
      assert.equal(normalizedFacing("oscar", frame, facing), facing);
  emit("presentation", {
    intro: p.introName,
    durationMs: p.durationMs,
    frames: action.frames.length,
    turns: action.turns,
    technique: TECHNIQUES.salsa,
  });
});

test("Oscar walks, turns, double jumps, rejects a third jump and lands on both player sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280);
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
    const secondVy = r.player.vy;
    assert.equal(r.player.jumps, 2);
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

test("Oscar light and heavy connect once, knock away and respect front guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const action of ["light", "heavy"] as const)
      for (const guard of [false, true]) {
        const r = setup(side);
        r.inputs[1 - side].block = guard;
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 8 : 13);
        close(
          r.rival.hp,
          guard ? 100 : 100 - (action === "light" ? 7 : 13) * 1.01 * 1.03,
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
        });
      }
});

test("Giro del sonero costs 25 energy, lifts once and hits front and rear rivals while respecting their facing guard", () => {
  for (const side of [0, 1] as const)
    for (const location of ["front", "behind"] as const)
      for (const guard of ["idle", "front", "rear"] as const) {
        const r = setup(side),
          direction = side === 0 ? 1 : -1;
        if (location === "behind") r.rival.x = r.player.x - direction * 80;
        // Movement establishes the intentional attack facing before the real special starts.
        r.inputs[side][direction === 1 ? "right" : "left"] = true;
        r.inputs[1 - side].block = guard !== "idle";
        if (guard !== "idle") {
          const targetFacing =
            Math.sign(r.player.x - r.rival.x) * (guard === "front" ? 1 : -1);
          r.inputs[1 - side][targetFacing === 1 ? "right" : "left"] = true;
        }
        r.inputs[side].actions.special++;
        r.advance(1);
        close(r.player.energy, 75);
        r.inputs[side].right = r.inputs[side].left = false;
        const impacts: unknown[] = [],
          blocks = new Set<number>();
        let minimumY = r.player.y;
        for (let n = 1; n < 110; n++) {
          const hp = r.rival.hp;
          r.advance(1);
          minimumY = Math.min(minimumY, r.player.y);
          if (hp !== r.rival.hp)
            impacts.push({
              tick: r.state.tick - INTRO_TOTAL_TICKS,
              hp: r.rival.hp,
              playerY: r.player.y,
              targetY: r.rival.y,
            });
          for (const e of r.state.effects)
            if (e.kind === "block" && e.owner === side) blocks.add(e.id);
          if (n === 7)
            r.inputs[1 - side].left = r.inputs[1 - side].right = false;
          if (n < 10) assert.equal(r.player.facing, direction);
        }
        assert.ok(minimumY < WORLD.floor - 100);
        assert.equal(r.player.attack, null);
        assert.equal(r.state.projectiles.length, 0);
        if (guard === "front") {
          assert.equal(r.rival.hp, 100);
          assert.equal(blocks.size, 1);
          assert.equal(r.player.hits, 0);
        } else {
          close(r.rival.hp, 83.3552);
          assert.equal(r.player.hits, 1);
          assert.equal(blocks.size, 0);
        }
        emit("special", {
          side,
          location,
          guard,
          impacts,
          minimumY,
          hp: r.rival.hp,
          hits: r.player.hits,
          blockCount: blocks.size,
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

test("Oscar special obeys 140 horizontal range and reaches an actually jumping rival and an airborne actor", () => {
  for (const side of [0, 1] as const) {
    for (const gap of [80, 139, 140, 200]) {
      const r = setup(side, gap);
      r.inputs[side].actions.special++;
      r.advance(100);
      assert.equal(r.player.hits, gap < 140 ? 1 : 0);
      emit("range-probe", {
        side,
        gap,
        hp: r.rival.hp,
        hits: r.player.hits,
        stocks: [r.player.stocks, r.rival.stocks],
      });
    }
    for (const airborne of ["actor", "rival"] as const) {
      const r = setup(side);
      r.inputs[airborne === "actor" ? side : 1 - side].actions.jump++;
      r.advance(12);
      const startingY = [r.player.y, r.rival.y];
      r.inputs[side].actions.special++;
      r.advance(100);
      assert.equal(r.player.hits, 1);
      close(r.rival.hp, 83.3552);
      emit("aerial-special", {
        side,
        airborne,
        startingY,
        hp: r.rival.hp,
        hits: r.player.hits,
      });
    }
  }
});

test("Oscar combos recognize whiff chains, connect with chase inputs and apply super energy gates", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) {
        r.inputs[side].actions.light++;
        r.advance(23);
      }
      r.inputs[side].actions.heavy++;
      r.advance(11);
      assert.equal(r.player.combo, "Síncopa doble");
      assert.equal(r.player.comboBonus, 7);
      close(r.rival.hp, 100 - (13 * 1.01 + 7) * 1.03);
      emit("combo-gate", {
        side,
        wins,
        combo: r.player.combo,
        hp: r.rival.hp,
        hits: r.player.hits,
      });
    }
    for (const advanced of [false, true]) {
      const r = setup(side, 80, 0),
        attacks = advanced
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
        r.inputs[side].left = r.inputs[side].right = false;
        r.advance(8);
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length);
      assert.equal(
        r.player.combo,
        advanced ? "Síncopa doble" : "Paso de salsa",
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
      [2, 90],
      [2, 100],
      [3, 100],
    ] as const) {
      const r = setup(side, 200, wins);
      r.player.energy = energy;
      r.inputs[side].actions.super++;
      r.advance(9);
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "oscar"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (energy < 90) {
        assert.equal(r.player.attack, null);
        assert.equal(r.rival.hp, 100);
      } else {
        assert.equal(r.player.combo, "Cierre del sonero");
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

test("Oscar intro consumes inputs and faces the rival after the complete shared timeline on either side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side),
      state = createMatch(
        "poliedro",
        r.state.players.map((p) => p.config) as [
          typeof r.player.config,
          typeof r.player.config,
        ],
      );
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].right = true;
    inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro");
    assert.equal(state.players[side].x, start);
    assert.equal(state.players[side].attack, null);
    stepMatch(state, inputs);
    assert.equal(state.phase, "playing");
    assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
  }
});

function cpuFight(side: 0 | 1) {
  const r = setup(side, 120, 3);
  let cpu = emptyInput();
  const started = new Set<string>(),
    landed = new Set<string>();
  r.inputs[side].actions.special++;
  for (let n = 0; n < 6200 && r.state.phase !== "finished"; n++) {
    const dx = r.rival.x - r.player.x;
    r.inputs[side].left = n >= 180 && dx < -85;
    r.inputs[side].right = n >= 180 && dx > 85;
    r.inputs[side].block =
      n >= 180 &&
      r.rival.attack === "heavy" &&
      Math.abs(dx) < 190 &&
      r.state.tick % 100 < 30;
    if (
      n >= 180 &&
      !r.player.cooldown &&
      !r.player.stun &&
      !r.inputs[side].block
    ) {
      const action =
        Math.abs(dx) < 230 && r.player.energy >= 90
          ? "super"
          : Math.abs(dx) < 135 &&
              r.player.energy >= 25 &&
              r.state.tick % 4 === 0
            ? "special"
            : Math.abs(dx) < 145
              ? r.state.tick % 3
                ? "light"
                : "heavy"
              : null;
      if (action) r.inputs[side].actions[action]++;
    }
    if (
      (r.rival.y < r.player.y - 60 || r.player.x < 120 || r.player.x > 960) &&
      r.player.jumps < 2 &&
      r.state.tick % 34 === 0
    )
      r.inputs[side].actions.jump++;
    // cpuInput controls player index 1. Exchange the actual player tuple for P2 auditing.
    if (side === 1) r.state.players.reverse();
    cpu = cpuInput(r.state, cpu, "normal");
    if (side === 1) r.state.players.reverse();
    r.inputs[1 - side] = cpu;
    r.advance(1);
    if (r.player.attack) started.add(r.player.attack);
    for (const e of r.state.effects)
      if (e.kind === "hit" && e.owner === side) landed.add(e.impact!);
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
test("complete Oscar CPU bouts finish and deterministically replay on both sides", () => {
  for (const side of [0, 1] as const) {
    const first = cpuFight(side),
      replay = cpuFight(side);
    assert.deepEqual(first, replay);
    emit("cpu-fight", {
      side,
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
  }
});
