import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
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
