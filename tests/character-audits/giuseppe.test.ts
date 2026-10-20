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
} from "../../shared/engine";
import {
  INTRO_TOTAL_TICKS,
  normalizedFacing,
  presentationById,
  selectionProgress,
  entranceProgress,
  samplePose,
} from "../../shared/presentation";
import { CHOREOGRAPHIES, sampleGesture } from "../../shared/choreography";

function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Giuseppe", fighter: "giuseppe" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch(
    "poliedro",
    side === 0 ? [...configs] : [configs[1], configs[0]],
    "giuseppe-v28-audit",
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
    JSON.stringify({ character: "giuseppe", check, evidence: value }),
  );
}

test("Giuseppe retains researched identity, three accelerating wave packets and one-shot presentations in both facings", () => {
  const f = fighterById("giuseppe"),
    profile = presentationById("giuseppe");
  assert.equal(f.name, "Giuseppe Gangi");
  assert.equal(f.ability, "audit");
  assert.equal(f.special, "Ráfaga de datos");
  assert.deepEqual(f.combos, [
    "Ping certero",
    "Código limpio",
    "Compilación final",
  ]);
  assert.deepEqual(TECHNIQUES.audit.pulses, [0, 9, 18]);
  assert.equal(TECHNIQUES.audit.projectile?.speed, 4);
  assert.equal(TECHNIQUES.audit.projectile?.maxSpeed, 11);
  assert.equal(profile.introStyle, "defiant");
  assert.equal(profile.selectionStyle, "defiant");
  assert.equal(profile.battleFrame, 1);
  assert.equal(selectionProgress("giuseppe", 2800), 1);
  assert.equal(selectionProgress("giuseppe", 5600), 1);
  for (const side of [0, 1] as const) {
    assert.equal(entranceProgress("giuseppe", side * 180 + 168, side), 1);
    assert.equal(entranceProgress("giuseppe", 510, side), 1);
  }
  for (const beats of [profile.introBeats, profile.selectionBeats]) {
    assert.equal(samplePose(beats, 1).frame, 1);
    assert.equal(samplePose(beats, 2).frame, 1);
  }
  for (const value of Object.values(sampleGesture("giuseppe", 1)))
    assert.ok(value === 0 || value === 1);
  for (let frame = 0; frame < 8; frame++)
    for (const facing of [1, -1])
      assert.equal(normalizedFacing("giuseppe", frame, facing), facing);
  emit("presentation", {
    intro: profile.introName,
    selection: profile.selectionName,
    choreography: CHOREOGRAPHIES.giuseppe.name,
  });
});

test("Giuseppe moves, faces, double jumps, rejects a third jump and lands on both sides", () => {
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

test("Giuseppe light and heavy each connect once and obey directional guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const action of ["light", "heavy"] as const)
      for (const guard of [false, true]) {
        const r = setup(side, 80);
        r.inputs[1 - side].block = guard;
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 8 : 13);
        close(
          r.rival.hp,
          guard ? 100 : 100 - (action === "light" ? 7 : 13) * 0.96 * 1.03,
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

test("Ráfaga de datos emits three packets and respects front/rear guards with single consumption on both sides", () => {
  for (const side of [0, 1] as const)
    for (const guard of ["idle", "front", "rear"] as const) {
      const r = setup(side, 280);
      r.inputs[1 - side].block = guard !== "idle";
      if (guard === "rear")
        r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      const shots = new Map<
        number,
        { tick: number; vx: number; damage: number; kind: string }
      >();
      const impacts: { tick: number; hp: number; hits: number }[] = [],
        blocks = new Set<number>();
      const origin = r.player.x;
      r.inputs[side].actions.special++;
      r.advance(1);
      close(r.player.energy, 75);
      for (let n = 1; n < 180; n++) {
        const hp = r.rival.hp;
        r.advance(1);
        for (const p of r.state.projectiles)
          if (!shots.has(p.id))
            shots.set(p.id, {
              tick: r.state.tick - INTRO_TOTAL_TICKS,
              vx: p.vx,
              damage: p.damage,
              kind: p.kind,
            });
        if (r.rival.hp !== hp)
          impacts.push({
            tick: r.state.tick - INTRO_TOTAL_TICKS,
            hp: r.rival.hp,
            hits: r.player.hits,
          });
        for (const e of r.state.effects)
          if (e.kind === "block" && e.owner === side) blocks.add(e.id);
      }
      emit("special", {
        side,
        guard,
        emissions: [...shots.values()],
        impacts,
        blocks: blocks.size,
        hp: r.rival.hp,
        hits: r.player.hits,
        energy: r.player.energy,
        targetEnergy: r.rival.energy,
      });
      assert.equal(shots.size, 3);
      assert.deepEqual(
        [...shots.values()].map((p) => p.tick),
        [16, 25, 34],
      );
      assert.ok(
        [...shots.values()].every(
          (p) =>
            p.kind === "audit" && Math.abs(p.vx) === 4.24 && p.damage === 6.72,
        ),
      );
      assert.equal(r.player.x, origin);
      assert.equal(r.state.projectiles.length, 0);
      assert.equal(r.player.attack, null);
      if (guard === "front") {
        assert.equal(r.rival.hp, 100);
        assert.equal(blocks.size, 3);
        assert.equal(r.player.hits, 0);
      } else {
        close(r.rival.hp, 100 - 3 * 7 * 0.96 * 1.03);
        assert.equal(r.player.hits, 3);
        assert.equal(blocks.size, 0);
      }
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

test("Giuseppe packets oscillate, accelerate to the cap and expire at age85 without collision on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.player.x = side === 0 ? 70 : 1010;
    r.rival.x = side === 0 ? 1010 : 70;
    r.rival.invincible = 200;
    const records = new Map<
      number,
      {
        firstTick: number;
        lastAge: number;
        maxSpeed: number;
        positive: boolean;
        negative: boolean;
        disappearedTick?: number;
      }
    >();
    r.inputs[side].actions.special++;
    for (let n = 0; n < 130; n++) {
      const before = new Set(r.state.projectiles.map((p) => p.id));
      r.advance(1);
      for (const p of r.state.projectiles) {
        const age = p.age ?? 0;
        const record = records.get(p.id) ?? {
          firstTick: r.state.tick - INTRO_TOTAL_TICKS,
          lastAge: 0,
          maxSpeed: 0,
          positive: false,
          negative: false,
        };
        close(Math.abs(p.vx), Math.min(11, 4 + 0.24 * age));
        close(p.life, 85 - age);
        close(p.y, (p.originY ?? 0) + Math.sin((age * Math.PI * 2) / 26) * 14);
        assert.ok(Math.abs(p.vx) <= 11);
        assert.equal(Math.sign(p.vx), side === 0 ? 1 : -1);
        record.lastAge = age;
        record.maxSpeed = Math.max(record.maxSpeed, Math.abs(p.vx));
        record.positive ||= p.y > (p.originY ?? 0) + 1;
        record.negative ||= p.y < (p.originY ?? 0) - 1;
        records.set(p.id, record);
        before.delete(p.id);
      }
      for (const id of before)
        records.get(id)!.disappearedTick = r.state.tick - INTRO_TOTAL_TICKS;
    }
    assert.equal(records.size, 3);
    assert.equal(r.player.hits, 0);
    assert.equal(r.rival.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    for (const record of records.values()) {
      assert.equal(record.lastAge, 84);
      assert.equal(record.maxSpeed, 11);
      assert.equal(record.positive, true);
      assert.equal(record.negative, true);
      assert.equal(record.disappearedTick, record.firstTick + 84);
    }
    emit("wave-cap-expiry", { side, records: [...records.values()] });
  }
});

test("timed double jump dodges the complete packet train on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280);
    r.inputs[side].actions.special++;
    for (let n = 0; n < 140; n++) {
      if (n === 20 || n === 40) r.inputs[1 - side].actions.jump++;
      r.advance(1);
    }
    emit("jump-dodge", {
      side,
      hp: r.rival.hp,
      hits: r.player.hits,
      stocks: r.rival.stocks,
      projectiles: r.state.projectiles.length,
    });
    assert.equal(r.rival.hp, 100);
    assert.equal(r.player.hits, 0);
    assert.equal(r.rival.stocks, 2);
    assert.equal(r.state.projectiles.length, 0);
  }
});

test("Giuseppe recognizes win-gated combos, connects each chained strike with approach inputs and gates super", () => {
  for (const side of [0, 1] as const) {
    for (const wins of [0, 1]) {
      const r = setup(side, 140, wins);
      for (let n = 0; n < 2; n++) {
        r.inputs[side].actions.light++;
        r.advance(23);
      }
      r.inputs[side].actions.heavy++;
      r.advance(11);
      assert.equal(r.player.combo, wins ? "Código limpio" : "Ping certero");
      assert.equal(r.player.comboBonus, wins ? 7 : 3);
      close(r.rival.hp, 100 - (13 * 0.96 + (wins ? 7 : 3)) * 1.03);
      emit("combo-gate", {
        side,
        wins,
        combo: r.player.combo,
        hp: r.rival.hp,
        hits: r.player.hits,
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
      assert.equal(r.player.combo, advanced ? "Código limpio" : "Ping certero");
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
      if (r.state.finale) r.advance(r.state.finale.duration);
      if (wins < 2 || energy < 90) {
        assert.equal(r.player.attack, null);
        assert.equal(r.rival.hp, 100);
      } else {
        assert.equal(r.player.combo, "Compilación final");
        assert.equal(r.player.comboBonus, 12);
        assert.equal(r.player.hits, 1);
        close(r.rival.hp, 100 - (28 * 0.96 + 12) * 1.03);
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

test("Giuseppe intro gates actions and ends facing his rival from either player side", () => {
  for (const side of [0, 1] as const) {
    const state = createMatch(
      "poliedro",
      side === 0
        ? [
            { name: "G", fighter: "giuseppe", wins: 3 },
            { name: "J", fighter: "javier", wins: 3 },
          ]
        : [
            { name: "J", fighter: "javier", wins: 3 },
            { name: "G", fighter: "giuseppe", wins: 3 },
          ],
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
    assert.equal(state.players[side].attack, null);
  }
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
        !started.has("special") && r.player.energy >= 25
          ? "special"
          : Math.abs(dx) < 230 && r.player.energy >= 90
            ? "super"
            : Math.abs(dx) < 650 && Math.abs(dx) > 180 && r.player.energy >= 25
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
test("a complete Giuseppe bout versus normal CPU finishes and deterministically replays", () => {
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
