// Checks the roster JSON once at load time, so a malformed or out-of-date data
// file fails loudly instead of being trusted through a type cast.
import {
  ABILITIES,
  FIGHTER_CATEGORIES,
  FIGHTER_IDS,
  STAGE_AMBIENCES,
  STAGE_IDS,
  STAGE_THEMES,
} from "./ids";
import type { FighterDefinition, Platform, StageDefinition } from "./roster";

type Fields = Record<string, unknown>;

function fail(at: string, expected: string): never {
  throw new TypeError(`${at}: expected ${expected}`);
}
const isRecord = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function record(value: unknown, at: string): Fields {
  if (!isRecord(value)) fail(at, "an object");
  return value;
}
const isString = (value: unknown) => typeof value === "string";
const isNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);
function check(
  fields: Fields,
  at: string,
  key: string,
  valid: (value: unknown) => boolean,
  expected: string,
  optional = false,
) {
  if (optional && !(key in fields)) return;
  if (!valid(fields[key])) fail(`${at}.${key}`, expected);
}
const oneOf =
  (options: readonly string[]) =>
  (value: unknown): boolean =>
    typeof value === "string" && options.includes(value);
const tuple =
  (length: number, item: (value: unknown) => boolean) =>
  (value: unknown): boolean =>
    Array.isArray(value) && value.length === length && value.every(item);

/** Every listed id appears exactly once, and no unknown id appears. */
function checkIds(seen: string[], ids: readonly string[], file: string) {
  for (const id of ids)
    if (seen.filter((other) => other === id).length !== 1)
      fail(file, `exactly one entry for "${id}"`);
  if (seen.length !== ids.length) fail(file, `${ids.length} entries`);
}

function assertFighter(
  value: unknown,
  at: string,
): asserts value is FighterDefinition {
  const f = record(value, at);
  check(f, at, "id", oneOf(FIGHTER_IDS), "a known fighter id");
  for (const key of [
    "sprite",
    "name",
    "shortName",
    "title",
    "role",
    "color",
    "description",
    "special",
  ])
    check(f, at, key, isString, "a string");
  for (const key of ["speed", "damage", "armor"])
    check(f, at, key, isNumber, "a number");
  for (const key of [
    "displayHeight",
    "portraitScale",
    "portraitLift",
    "specialUnlockWins",
  ])
    check(f, at, key, isNumber, "a number", true);
  check(f, at, "category", oneOf(FIGHTER_CATEGORIES), "a category", true);
  check(f, at, "ability", oneOf(ABILITIES), "a known ability");
  check(f, at, "stats", tuple(3, isNumber), "three numbers");
  check(f, at, "combos", tuple(3, isString), "three strings");
}

function isPlatform(value: unknown): value is Platform {
  if (!isRecord(value)) return false;
  const p = value;
  if (!isNumber(p.x) || !isNumber(p.y) || !isNumber(p.width)) return false;
  if (!("motion" in p)) return true;
  const m = p.motion;
  return (
    isRecord(m) &&
    (m.axis === "x" || m.axis === "y") &&
    isNumber(m.range) &&
    isNumber(m.period) &&
    (!("phase" in m) || isNumber(m.phase))
  );
}

function assertStage(
  value: unknown,
  at: string,
): asserts value is StageDefinition {
  const s = record(value, at);
  check(s, at, "id", oneOf(STAGE_IDS), "a known stage id");
  for (const key of ["name", "location", "time", "color", "description"])
    check(s, at, key, isString, "a string");
  check(s, at, "artStyle", (v) => v === "pixel", '"pixel"', true);
  check(s, at, "theme", oneOf(STAGE_THEMES), "a stage theme");
  check(s, at, "ambience", oneOf(STAGE_AMBIENCES), "a stage ambience");
  check(
    s,
    at,
    "platforms",
    (v) => Array.isArray(v) && v.every(isPlatform),
    "a list of platforms",
  );
}

/** The fighter definitions in `fighters.json`, checked field by field. */
export function readFighters(data: unknown): FighterDefinition[] {
  if (!Array.isArray(data)) fail("fighters.json", "a list");
  const fighters: FighterDefinition[] = [];
  data.forEach((entry: unknown, i) => {
    assertFighter(entry, `fighters.json[${i}]`);
    fighters.push(entry);
  });
  checkIds(
    fighters.map((fighter) => fighter.id),
    FIGHTER_IDS,
    "fighters.json",
  );
  return fighters;
}

/** The stage definitions in `stages.json`, checked field by field. */
export function readStages(data: unknown): StageDefinition[] {
  if (!Array.isArray(data)) fail("stages.json", "a list");
  const stages: StageDefinition[] = [];
  data.forEach((entry: unknown, i) => {
    assertStage(entry, `stages.json[${i}]`);
    stages.push(entry);
  });
  checkIds(
    stages.map((stage) => stage.id),
    STAGE_IDS,
    "stages.json",
  );
  return stages;
}
