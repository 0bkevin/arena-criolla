import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "./helpers/charged-finale-engine";
import { fighterById, type FighterId } from "../shared/content";
function setup(side: 0 | 1 = 0, gap = 430, rival: FighterId = "zavarce") {
  const actor = { name: "Maite", fighter: "maite" as const, wins: 3 },
    other = { name: "Rival", fighter: rival, wins: 3 };
  const state = createMatch("poliedro", side ? [other, actor] : [actor, other]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 900 : 180;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * gap;
  target.facing = -source.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n = 1) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
  };
  return { state, source, target, inputs, advance, start };
}
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("Maite's super wave snapshots outgoing damage and keeps its super impact after a real reflector", () => {
  for (const side of [0, 1] as const) {
    const plain = setup(side);
    plain.start();
    plain.advance(9);
    const base = plain.state.projectiles[0].damage;
    const buff = setup(side);
    buff.source.transformation = {
      id: "test",
      ticks: 12,
      damageMultiplier: 1.2,
    };
    buff.start();
    buff.advance(9);
    const snapshot = buff.state.projectiles[0].damage;
    close(snapshot, base * 1.2);
    buff.advance(32);
    assert.equal(buff.source.transformation, undefined);
    assert.equal(buff.source.hits, 1);
    close(buff.target.hp, 100 - snapshot * fighterById("zavarce").armor);
    const reflected = setup(side, 430, "carolina");
    reflected.start();
    reflected.advance(22);
    reflected.inputs[1 - side].actions.special++;
    const shot = reflected.state.projectiles[0],
      sent = shot.damage;
    reflected.advance(12);
    assert.equal(shot.owner, 1 - side);
    assert.equal(shot.impact, "super");
    close(shot.damage, sent);
    reflected.advance(35);
    assert.equal(reflected.target.hits, 1);
    close(100 - reflected.source.hp, sent * fighterById("maite").armor);
  }
});
