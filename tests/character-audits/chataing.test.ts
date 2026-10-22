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
  samplePose,
} from "../../shared/presentation";
import { CHOREOGRAPHIES } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Chataing", fighter: "chataing" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ];
  const state = createMatch(
    "poliedro",
    side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]],
    "chataing-v28-audit",
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
  console.log(
    JSON.stringify({ character: "chataing", check, evidence: value }),
  );
}

test("Chataing retains his researched identity, returning microphone and one-shot facing presentations", () => {
  const f = fighterById("chataing"),
    p = presentationById("chataing");
  assert.equal(f.name, "Luis Chataing");
  assert.equal(f.ability, "static");
  assert.equal(f.special, "Micrófono de vuelta");
  assert.deepEqual(f.combos, [
    "Pregunta directa",
    "Repregunta",
    "Cierre al aire",
  ]);
  assert.equal(TECHNIQUES.static.projectile?.speed, 10);
  assert.equal(TECHNIQUES.static.projectile?.returnAfter, 24);
  assert.deepEqual(TECHNIQUES.static.projectile?.tether, {
    catchX: -9,
    catchY: 129,
    returnSpeed: 18,
  });
  assert.equal(p.prop, "none");
  assert.equal(p.battleFrame, 1);
  assert.equal(selectionProgress("chataing", 2800), 1);
  assert.equal(selectionProgress("chataing", 5600), 1);
  for (const beats of [p.introBeats, p.selectionBeats])
    assert.equal(samplePose(beats, 1).frame, 1);
  for (let frame = 0; frame < 8; frame++)
    for (const facing of [1, -1])
      assert.equal(normalizedFacing("chataing", frame, facing), facing);
  emit("presentation", {
    intro: p.introName,
    choreography: CHOREOGRAPHIES.chataing.name,
  });
});

test("Chataing walks, faces both directions, double jumps, rejects a third jump and lands on either player side", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.player.x = 540;
    r.rival.x = 920;
    const start = r.player.x;
    r.inputs[side].right = true;
    r.advance(24);
    const right = r.player.x;
    assert.ok(right > start + 100);
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

test("Chataing light and heavy connect once and respect a facing guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const action of ["light", "heavy"] as const)
      for (const guard of [false, true]) {
        const r = setup(side, 80);
        r.inputs[1 - side].block = guard;
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 8 : 13);
        close(
          r.rival.hp,
          guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.95 * 1.03,
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

test("Micrófono de vuelta hits idle, blocks toward its flight and defeats rear guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const guard of ["idle", "front", "rear"] as const) {
      const r = setup(side, 200);
      r.inputs[1 - side].block = guard !== "idle";
      if (guard === "rear")
        r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      const shots = new Map<
        number,
        { tick: number; age: number; vx: number; damage: number; kind: string }
      >();
      const impacts: { tick: number; hp: number }[] = [],
        blocks = new Set<number>();
      r.inputs[side].actions.special++;
      r.advance(1);
      close(r.player.energy, 75);
      for (let n = 1; n < 120; n++) {
        const hp = r.rival.hp;
        r.advance(1);
        for (const p of r.state.projectiles)
          if (!shots.has(p.id))
            shots.set(p.id, {
              tick: r.state.tick - INTRO_TOTAL_TICKS,
              age: p.age ?? 0,
              vx: p.vx,
              damage: p.damage,
              kind: p.kind,
            });
        if (r.rival.hp !== hp)
          impacts.push({
            tick: r.state.tick - INTRO_TOTAL_TICKS,
            hp: r.rival.hp,
          });
        for (const e of r.state.effects)
          if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      }
      assert.equal(shots.size, 1);
      assert.equal([...shots.values()][0].tick, 11);
      assert.equal([...shots.values()][0].vx, side === 0 ? 10 : -10);
      close([...shots.values()][0].damage, 11.4);
      assert.equal(r.state.projectiles.length, 0);
      if (guard === "front") {
        assert.equal(r.rival.hp, 100);
        assert.equal(blocks.size, 1);
        assert.equal(r.player.hits, 0);
      } else {
        close(r.rival.hp, 88.258);
        assert.equal(r.player.hits, 1);
        assert.equal(blocks.size, 0);
      }
      emit("special", {
        side,
        guard,
        emissions: [...shots.values()],
        impacts,
        blockCount: blocks.size,
        hp: r.rival.hp,
        hits: r.player.hits,
      });
    }
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.player.energy = 24;
    r.inputs[side].actions.special++;
    r.advance(1);
    assert.equal(r.player.attack, null);
    assert.equal(r.state.projectiles.length, 0);
  }
});

test("the wired microphone turns at age24 and is caught instead of passing through its owner", () => {
  for (const side of [0, 1] as const) {
    const direction = side === 0 ? 1 : -1,
      r = setup(side, 400);
    r.player.x = side === 0 ? 400 : 680;
    r.rival.x = r.player.x + direction * 400;
    const origin = r.player.x,
      path: { age: number; x: number; y: number; returning: boolean }[] = [];
    r.inputs[side].actions.special++;
    for (let n = 0; n < 100; n++) {
      r.advance(1);
      for (const p of r.state.projectiles)
        path.push({
          age: p.age ?? 0,
          x: p.x,
          y: p.y,
          returning: !!p.returning,
        });
    }
    assert.equal(path[0].age, 1);
    close(path[0].x, origin + direction * 85);
    const peak = path.find((p) => p.age === 23)!;
    close(peak.x, origin + direction * 305);
    const turn = path.find((p) => p.age === 24)!;
    assert.equal(turn.returning, true);
    assert.ok((turn.x - peak.x) * direction < 0);
    assert.ok(path.every((p) => (p.x - origin) * direction > -10));
    assert.equal(r.player.x, origin);
    assert.equal(r.player.hp, 100);
    assert.equal(r.rival.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.player.attack, null);
    emit("tether-return", {
      side,
      origin,
      first: path[0],
      peak,
      turn,
      last: path.at(-1),
    });
  }
});

test("returning microphone stays bounded and CPU approaches before using it", () => {
  for (const gap of [280, 319, 320, 400, 460, 500]) {
    const r = setup(0, gap);
    r.inputs[0].actions.special++;
    r.advance(120);
    assert.ok(Number.isFinite(r.player.x) && Number.isFinite(r.rival.x));
    emit("range-probe", { gap, hp: r.rival.hp, hits: r.player.hits });
  }
  const r = setup(1, 500);
  r.advance(90);
  const chosen = cpuInput(r.state, emptyInput(), "normal");
  assert.equal(r.state.tick, 600);
  assert.equal(chosen.actions.special, 0);
  assert.equal(chosen.left, true);
  const start = {
    tick: r.state.tick,
    casterX: r.player.x,
    targetX: r.rival.x,
    energy: r.player.energy,
  };
  r.inputs[1] = chosen;
  r.advance(120);
  assert.equal(r.rival.hp, 100);
  assert.equal(r.player.hits, 0);
  const inReach = setup(1, 280);
  inReach.advance(90);
  assert.equal(
    cpuInput(inReach.state, emptyInput(), "normal").actions.special,
    1,
  );
  emit("cpu-range-probe", {
    start,
    input: chosen,
    finalCasterX: r.player.x,
    finalEnergy: r.player.energy,
    targetHp: r.rival.hp,
    hits: r.player.hits,
  });
});

test("Chataing recognizes base and upgraded combos, connects all strikes with chase inputs, and enforces super gates", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) {
        r.inputs[side].actions.light++;
        r.advance(23);
      }
      r.inputs[side].actions.heavy++;
      r.advance(11);
      assert.equal(r.player.combo, wins ? "Repregunta" : "Pregunta directa");
      assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.95 + (wins ? 7 : 3)) * 1.03);
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
      const r = setup(side, 80, advanced ? 1 : 0),
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
        r.inputs[side].left = false;
        r.inputs[side].right = false;
        r.advance(8);
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 23 : 14);
      }
      assert.equal(r.player.hits, attacks.length);
      assert.equal(
        r.player.combo,
        advanced ? "Repregunta" : "Pregunta directa",
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
      if (r.state.fieldFinales) { assert.equal(r.state.fieldFinales[0].fighter, "chataing"); assert.equal(r.rival.hp, 100); r.advance(320); }
      if (energy < 90) {
        assert.equal(r.player.attack, null);
        assert.equal(r.rival.hp, 100);
      } else {
        assert.equal(r.player.combo, "Cierre al aire");
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

test("Chataing intro locks combat until the shared timeline finishes and faces either-side rivals", () => {
  for (const side of [0, 1] as const) {
    const configs = [
      { name: "Chataing", fighter: "chataing" as const, wins: 3 },
      { name: "Javier", fighter: "javier" as const, wins: 3 },
    ];
    const state = createMatch(
      "poliedro",
      side === 0 ? [configs[0], configs[1]] : [configs[1], configs[0]],
    );
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].right = true;
    inputs[side].actions.special++;
    const start = state.players[side].x;
    for (let n = 0; n < INTRO_TOTAL_TICKS - 1; n++) stepMatch(state, inputs);
    assert.equal(state.phase, "intro");
    assert.equal(state.players[side].x, start);
    assert.equal(state.projectiles.length, 0);
    stepMatch(state, inputs);
    assert.equal(state.phase, "playing");
    assert.equal(state.players[side].facing, side === 0 ? 1 : -1);
  }
});

function cpuFight() {
  const r = setup(0, 420, 3);
  let cpu = emptyInput();
  const started = new Set<string>(),
    landed = new Set<string>();
  // Exercise the special explicitly; later AI choices depend on arena geometry.
  r.inputs[0].actions.special++;
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
          : Math.abs(dx) < 310 && Math.abs(dx) > 180 && r.player.energy >= 25
            ? "special"
            : Math.abs(dx) < 145
              ? r.state.tick % 3
                ? "light"
                : "heavy"
              : null;
      if (action) r.inputs[0].actions[action]++;
    }
    if (
      (r.rival.y < r.player.y - 60 ||
        r.player.x < WORLD.left + 50 ||
        r.player.x > WORLD.right - 50) &&
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
test("a complete Chataing fight against normal CPU finishes and deterministically replays", () => {
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
