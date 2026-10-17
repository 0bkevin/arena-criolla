import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, type FounderFighterId } from "../shared/content";
import { CHOREOGRAPHIES, sampleGesture, REST } from "../shared/choreography";
import { presentationById } from "../shared/presentation";
import { victoryById } from "../src/game/victory";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "../shared/engine";

const founders: FounderFighterId[] = [
  "enrique",
  "jesus",
  "carlos",
  "victor",
  "juan",
];
const techniques = ["ledger", "settlement", "ignition", "slash", "grid"];

function setup(fighter: FounderFighterId, attacker: 0 | 1 = 0) {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: attacker === 0 ? fighter : "zavarce", wins: 0 },
    { name: "Dos", fighter: attacker === 1 ? fighter : "zavarce", wins: 0 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => (p.invincible = 0));
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const player = state.players[attacker];
  const other = state.players[1 - attacker];
  player.x = attacker === 0 ? 480 : 700;
  other.x = attacker === 0 ? 700 : 480;
  player.facing = other.x > player.x ? 1 : -1;
  other.facing = player.x > other.x ? 1 : -1;
  state.players.forEach((p) => {
    p.y = WORLD.floor;
    p.grounded = true;
  });
  return { state, inputs, attacker };
}

function advance(state: MatchState, inputs: [Input, Input], ticks: number) {
  for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
}

function startSpecial(
  state: MatchState,
  inputs: [Input, Input],
  attacker: 0 | 1,
) {
  state.players[attacker].energy = 50;
  inputs[attacker].actions.special++;
  stepMatch(state, inputs);
}

test("the five founders have complete, distinct presentation, choreography, and victory identities", () => {
  const fighters = founders.map(fighterById);
  for (const field of ["name", "sprite", "ability", "special"] as const) {
    assert.equal(
      new Set(fighters.map((fighter) => fighter[field])).size,
      founders.length,
      field,
    );
    assert.ok(
      fighters.every((fighter) => fighter[field].length > 0),
      field,
    );
  }
  assert.deepEqual(
    new Set(fighters.map((fighter) => fighter.ability)),
    new Set(techniques),
  );
  assert.equal(
    new Set(fighters.map((fighter) => fighter.sprite)).size,
    founders.length,
  );

  for (const id of founders) {
    const presentation = presentationById(id);
    assert.ok(presentation.introName && presentation.selectionName, id);
    assert.ok(presentation.durationMs > 0, id);
    assert.ok([0, 1, 4].includes(presentation.battleFrame), id);
    assert.equal(presentation.frameFacing.length, 8, id);
    assert.ok(
      presentation.frameFacing.every((facing) => facing === 1 || facing === -1),
      id,
    );

    const choreography = CHOREOGRAPHIES[id];
    assert.ok(choreography.name.length > 0, id);
    assert.ok(choreography.beats.length >= 2, id);
    for (const [progress, sample] of [
      [0, sampleGesture(id, 0)],
      [1, sampleGesture(id, 1)],
    ] as const) {
      assert.equal(sample.at, progress, id);
      for (const [key, value] of Object.entries(sample))
        if (key !== "at") assert.ok(value === 0, `${id}: ${key} should settle`);
    }
    assert.equal(victoryById(id).name.length > 0, true, id);
  }
  assert.equal(
    new Set(founders.map((id) => CHOREOGRAPHIES[id].name)).size,
    founders.length,
  );
  assert.equal(
    new Set(founders.map((id) => victoryById(id).name)).size,
    founders.length,
  );
});

test("founder specials resolve for either player, with and without a facing block, deterministically", () => {
  for (const id of founders) {
    for (const attacker of [0, 1] as const) {
      for (const blocking of [false, true]) {
        const first = setup(id, attacker);
        const second = setup(id, attacker);
        first.inputs[attacker].actions.special++;
        second.inputs[attacker].actions.special++;
        first.inputs[1 - attacker].block = blocking;
        second.inputs[1 - attacker].block = blocking;
        first.state.players[attacker].energy = 50;
        second.state.players[attacker].energy = 50;
        stepMatch(first.state, first.inputs);
        stepMatch(second.state, second.inputs);
        assert.ok(
          first.state.players[attacker].energy < 50,
          `${id}: special did not start`,
        );
        for (let tick = 0; tick < 90; tick++) {
          stepMatch(first.state, first.inputs);
          stepMatch(second.state, second.inputs);
          assert.deepEqual(
            first.state,
            second.state,
            `${id}/${attacker}/${blocking}/${tick}`,
          );
        }
        for (const player of first.state.players) {
          assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y), id);
          assert.ok(player.hp >= 0 && player.hp <= 100, id);
        }
        if (blocking)
          assert.equal(
            first.state.players[1 - attacker].hp,
            100,
            `${id}: block leaked damage`,
          );
        else
          assert.ok(
            first.state.players[1 - attacker].hp < 100,
            `${id}: special did not hit`,
          );
      }
    }
  }
});

test("ledger emits two separated packets and settlement reverses its returning transfer", () => {
  const ledger = setup("enrique");
  ledger.state.players[1].x = 1120;
  startSpecial(ledger.state, ledger.inputs, 0);
  advance(ledger.state, ledger.inputs, 26);
  assert.equal(
    ledger.state.projectiles.filter((shot) => shot.kind === "ledger").length,
    2,
  );

  const settlement = setup("jesus");
  settlement.state.players[1].x = 1120;
  startSpecial(settlement.state, settlement.inputs, 0);
  advance(settlement.state, settlement.inputs, 33);
  const shot = settlement.state.projectiles.find(
    (projectile) => projectile.kind === "settlement",
  );
  assert.ok(shot);
  const beforeReturn = shot.x;
  advance(settlement.state, settlement.inputs, 2);
  const returning = settlement.state.projectiles.find(
    (projectile) => projectile.kind === "settlement",
  );
  assert.ok(returning);
  assert.ok(returning.vx < 0);
  assert.ok(returning.x < beforeReturn);
});

test("ignition advances and slash blinks without overlapping its target", () => {
  const ignition = setup("carlos");
  const start = ignition.state.players[0].x;
  startSpecial(ignition.state, ignition.inputs, 0);
  advance(ignition.state, ignition.inputs, 12);
  assert.ok(ignition.state.players[0].x > start + 40);
  assert.ok(ignition.state.players[0].dash > 0);

  const slash = setup("victor");
  slash.state.players[1].x = 900;
  const slashStart = slash.state.players[0].x;
  startSpecial(slash.state, slash.inputs, 0);
  advance(slash.state, slash.inputs, 13);
  assert.ok(slash.state.players[0].x > slashStart);
  assert.ok(slash.state.players[0].x < slash.state.players[1].x - 40);
  assert.ok(slash.state.players[0].invincible > 0);
});

test("grid snares a grounded opponent while jumping avoids its ground net", () => {
  const grounded = setup("juan");
  grounded.state.players[1].x = 650;
  startSpecial(grounded.state, grounded.inputs, 0);
  advance(grounded.state, grounded.inputs, 18);
  assert.ok(grounded.state.players[1].hp < 100);
  assert.ok(grounded.state.players[1].rootTicks > 0);

  const airborne = setup("juan");
  airborne.state.players[1].x = 650;
  startSpecial(airborne.state, airborne.inputs, 0);
  airborne.inputs[1].actions.jump++;
  stepMatch(airborne.state, airborne.inputs);
  advance(airborne.state, airborne.inputs, 18);
  assert.ok(airborne.state.players[1].y < WORLD.floor);
  assert.equal(airborne.state.players[1].hp, 100);
  assert.equal(airborne.state.players[1].rootTicks, 0);
});
