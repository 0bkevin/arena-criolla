import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";
import type { FighterId } from "../shared/content";

function rush(id: FighterId, side: 0 | 1, gap: number, guard = false) {
  const configs = [
    { fighter: "javier" as FighterId, name: "Rival", wins: 0 },
    { fighter: "javier" as FighterId, name: "Rival", wins: 0 },
  ] as [
    { fighter: FighterId; name: string; wins: number },
    { fighter: FighterId; name: string; wins: number },
  ];
  configs[side] = { fighter: id, name: id, wins: 0 };
  const state = createMatch("poliedro", configs);
  state.phase = "playing";
  state.players.forEach((player) => {
    player.invincible = 0;
  });
  state.players[side].x = side === 0 ? 250 : 830;
  state.players[1 - side].x = state.players[side].x + (side === 0 ? gap : -gap);
  state.players[side].facing = side === 0 ? 1 : -1;
  state.players[1 - side].facing = side === 0 ? -1 : 1;
  state.players[side].energy = 100;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[1 - side].block = guard;
  inputs[side].actions.special++;
  const start = state.players[side].x;
  for (let tick = 0; tick < 65; tick++) stepMatch(state, inputs);
  return {
    state,
    attacker: state.players[side],
    target: state.players[1 - side],
    distance: Math.abs(state.players[side].x - start),
  };
}
test("Capriles rush connects once during travel and respects directional guards", () => {
  for (const side of [0, 1] as const) {
    const hit = rush("capriles", side, 240);
    assert.ok(hit.target.hp < 100);
    assert.equal(hit.attacker.hits, 1);
    const blocked = rush("capriles", side, 240, true);
    assert.equal(blocked.target.hp, 100);
    assert.ok(blocked.target.energy < 100);
  }
});
test("Capriles rush crosses an empty gap and only damages on contact", () => {
  for (const side of [0, 1] as const) {
    const state = createMatch("caracas", [
      { name: "P1", fighter: side === 0 ? "capriles" : "javier", wins: 3 },
      { name: "P2", fighter: side === 1 ? "capriles" : "javier", wins: 3 },
    ]);
    state.phase = "playing";
    state.players.forEach((p) => {
      p.energy = 100;
      p.invincible = 0;
    });
    const actor = state.players[side],
      rival = state.players[1 - side];
    actor.x = side ? 700 : 400;
    actor.facing = side ? -1 : 1;
    rival.x = actor.x + actor.facing * 214;
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].actions.special++;
    let impacts = 0;
    for (let tick = 1; tick <= 65; tick++) {
      const beforeHp = rival.hp;
      const gap = Math.abs(actor.x - rival.x);
      stepMatch(state, inputs);
      if (rival.hp < beforeHp) {
        impacts++;
        assert.ok(gap < 125, `P${side + 1}: hit from a distance of ${gap}`);
      }
    }
    assert.equal(impacts, 1, `P${side + 1}: the rush connects once`);
    assert.equal(actor.hits, 1);
    assert.equal(actor.attack, null);
  }
});
test("forward rushes brake after their configured movement window", () => {
  for (const id of ["capriles", "conde", "mcm"] as const)
    for (const side of [0, 1] as const) {
      const result = rush(id, side, 700);
      assert.ok(result.distance < 240, `${id} traveled ${result.distance}`);
      assert.ok(Math.abs(result.attacker.vx) < 1);
    }
});
test("the generals grounded command cannot land while its actor is airborne", () => {
  for (const side of [0, 1] as const) {
    const configs = [
      { fighter: "javier" as FighterId, name: "Rival", wins: 0 },
      { fighter: "javier" as FighterId, name: "Rival", wins: 0 },
    ] as [
      { fighter: FighterId; name: string; wins: number },
      { fighter: FighterId; name: string; wins: number },
    ];
    configs[side] = { fighter: "gomez", name: "General", wins: 0 };
    const state = createMatch("poliedro", configs);
    state.phase = "playing";
    state.players.forEach((player) => {
      player.invincible = 0;
    });
    state.players[side].x = side === 0 ? 350 : 730;
    state.players[1 - side].x = side === 0 ? 480 : 600;
    state.players[side].facing = side === 0 ? 1 : -1;
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[side].actions.special++;
    for (let n = 0; n < 15; n++) stepMatch(state, inputs);
    inputs[side].actions.jump++;
    for (let n = 0; n < 5; n++) stepMatch(state, inputs);
    assert.equal(state.players[1 - side].hp, 100);
  }
});
