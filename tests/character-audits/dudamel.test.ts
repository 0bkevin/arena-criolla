import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, type FighterId } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS, normalizedFacing, presentationById, selectionProgress } from "../../shared/presentation";
import { ENTRANCE_ACTIONS, sampleEntranceAction } from "../../shared/entrance-actions";
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
