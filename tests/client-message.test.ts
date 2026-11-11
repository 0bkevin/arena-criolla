import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, emptyInput } from "../shared/engine/engine";
import {
  cleanName,
  cleanWins,
  messageType,
  parseClientMessage,
} from "../shared/lobby/client-message";

const CODE = "0123456789ABCDEF0123456789ABCDEF";

test("names lose control characters and markup and stop at 20 characters", () => {
  assert.equal(cleanName("  <b>Ana</b>\u0007  "), "bAna/b");
  assert.equal(cleanName("x".repeat(30)), "x".repeat(20));
  assert.equal(cleanName(42), "");
  assert.equal(cleanWins(12.9), 12);
  assert.equal(cleanWins(-3), 0);
  assert.equal(cleanWins(1e9), 9999);
  assert.equal(cleanWins("7"), 0);
  assert.equal(cleanWins(Number.NaN), 0);
});

test("only objects with a string type have a message type", () => {
  assert.equal(messageType({ type: "list" }), "list");
  assert.equal(messageType({ type: 1 }), null);
  assert.equal(messageType(["list"]), null);
  assert.equal(messageType(null), null);
  assert.equal(messageType("list"), null);
});

test("create and join require a known fighter, stage and room code", () => {
  assert.deepEqual(
    parseClientMessage({
      type: "create",
      name: " Ana<> ",
      fighter: "zavarce",
      stage: "caracas",
      wins: 3.5,
      private: 1,
    }),
    {
      type: "create",
      name: "Ana",
      fighter: "zavarce",
      stage: "caracas",
      wins: 3,
      private: true,
    },
  );
  assert.equal(
    parseClientMessage({ type: "create", fighter: "nadie", stage: "caracas" }),
    null,
  );
  assert.equal(
    parseClientMessage({ type: "create", fighter: "zavarce", stage: "luna" }),
    null,
  );
  assert.deepEqual(
    parseClientMessage({
      type: "join",
      code: CODE.toLowerCase(),
      fighter: "ali",
    }),
    {
      type: "join",
      code: CODE.toLowerCase(),
      name: "",
      fighter: "ali",
      wins: 0,
    },
  );
  assert.equal(
    parseClientMessage({ type: "join", code: "ABC", fighter: "ali" }),
    null,
  );
});

test("select keeps valid fields and drops an unknown fighter or stage", () => {
  assert.deepEqual(
    parseClientMessage({ type: "select", fighter: "nadie", stage: "caracas" }),
    { type: "select", stage: "caracas", wins: 0 },
  );
  assert.deepEqual(
    parseClientMessage({ type: "select", fighter: "ali", wins: 4 }),
    { type: "select", fighter: "ali", wins: 4 },
  );
});

test("ready needs a boolean and unknown types are rejected", () => {
  assert.deepEqual(parseClientMessage({ type: "ready", ready: false }), {
    type: "ready",
    ready: false,
  });
  assert.equal(parseClientMessage({ type: "ready", ready: "yes" }), null);
  assert.equal(parseClientMessage({ type: "bogus" }), null);
  assert.deepEqual(parseClientMessage({ type: "leave", extra: 1 }), {
    type: "leave",
  });
});

test("input keeps only strict booleans and bounded integer action counters", () => {
  const actions = Object.fromEntries(ACTIONS.map((action) => [action, 2]));
  const parsed = parseClientMessage({
    type: "input",
    matchId: "m",
    input: { left: true, right: "yes", block: 1, actions },
  });
  const expected = emptyInput();
  expected.left = true;
  for (const action of ACTIONS) expected.actions[action] = 2;
  assert.deepEqual(parsed, { type: "input", matchId: "m", input: expected });

  for (const bad of [-1, 1.5, 1_000_000_001, "2", null]) {
    const input = { actions: { ...actions, [ACTIONS[0]]: bad } };
    assert.equal(
      parseClientMessage({ type: "input", matchId: "m", input }),
      null,
      `action counter ${String(bad)}`,
    );
  }
  const missing = { ...actions };
  delete missing[ACTIONS[0]];
  assert.equal(
    parseClientMessage({
      type: "input",
      matchId: "m",
      input: { actions: missing },
    }),
    null,
  );
  assert.equal(
    parseClientMessage({ type: "input", matchId: 7, input: { actions } }),
    null,
  );
});
