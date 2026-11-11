import test from "node:test";
import assert from "node:assert/strict";
import fighters from "../../shared/roster/fighters.json";
import stages from "../../shared/roster/stages.json";
import { readFighters, readStages } from "../../shared/roster/roster-data";

const copy = <T>(value: T): T => structuredClone(value);

test("the shipped roster and stages pass validation", () => {
  assert.equal(readFighters(copy(fighters)).length, fighters.length);
  assert.equal(readStages(copy(stages)).length, stages.length);
});

test("malformed fighters fail with the offending field", () => {
  const broken = copy(fighters) as unknown[];
  broken[2] = { ...(broken[2] as object), stats: [1, 2] };
  assert.throws(() => readFighters(broken), /fighters\.json\[2\]\.stats/);
  const unknownAbility = copy(fighters) as unknown[];
  unknownAbility[0] = { ...(unknownAbility[0] as object), ability: "nope" };
  assert.throws(() => readFighters(unknownAbility), /\.ability/);
  assert.throws(
    () => readFighters(copy(fighters).slice(1)),
    /exactly one entry/,
  );
});

test("malformed stages fail with the offending field", () => {
  const broken = copy(stages) as unknown[];
  broken[0] = { ...(broken[0] as object), platforms: [{ x: 1, y: 2 }] };
  assert.throws(() => readStages(broken), /stages\.json\[0\]\.platforms/);
});
