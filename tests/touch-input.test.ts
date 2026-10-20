import test from "node:test";
import assert from "node:assert/strict";
import { TouchInputState } from "../src/game/touch-input";
import { ControlSources, makeInputs, type Control } from "../src/game/controls";

function tracker() {
  const events: string[] = [];
  const input = new TouchInputState(
    (pointer, control) => events.push(`+${pointer}:${control}`),
    (pointer) => events.push(`-${pointer}`),
  );
  return { input, events };
}

test("independent fingers keep a shared direction held until the last release", () => {
  const { input, events } = tracker();
  input.press(11, "right");
  input.press(12, "right");
  input.press(13, "light");
  input.release(11);
  assert.deepEqual(input.pressedControls(), new Set(["right", "light"]));
  input.release(13);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  input.release(12);
  assert.deepEqual(input.pressedControls(), new Set());
  assert.deepEqual(events, [
    "+11:right",
    "+12:right",
    "+13:light",
    "-11",
    "-13",
    "-12",
  ]);
});

test("direction slides transfer immediately, cancel in gaps, and can re-enter", () => {
  const { input, events } = tracker();
  input.press(21, "left");
  input.press(22, "right");
  assert.equal(input.move(21, "right"), true);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.equal(input.move(21, null), true);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.equal(input.move(21, "down"), true);
  assert.deepEqual(input.pressedControls(), new Set(["right", "down"]));
  input.release(21);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.deepEqual(events, [
    "+21:left",
    "+22:right",
    "-21",
    "+21:right",
    "-21",
    "+21:down",
    "-21",
  ]);
});

test("pointer cancel, reset, and unmount cleanup are idempotent", () => {
  const { input, events } = tracker();
  input.press(31, "block");
  input.press(32, "left");
  input.release(31); // pointercancel and pointerup share the same release path
  assert.equal(input.release(31), false);
  input.releaseAll(); // blur, visibility loss, reset, or component cleanup
  assert.deepEqual(input.pressedControls(), new Set());
  assert.deepEqual(input.pointers(), []);
  assert.equal(input.releaseAll(), false);
  assert.deepEqual(events, ["+31:block", "+32:left", "-31", "-32"]);
});

test("disabled controls release only their own fingers and reused ids release old input", () => {
  const { input, events } = tracker();
  input.press(41, "super");
  input.press(42, "block");
  input.releaseControl("super");
  assert.deepEqual(input.pressedControls(), new Set(["block"]));
  input.press(42, "right");
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  input.release(42);
  assert.deepEqual(events, [
    "+41:super",
    "+42:block",
    "-41",
    "-42",
    "+42:right",
    "-42",
  ]);
});

test("all button pairs allow slides except entry into a fresh-press ability", () => {
  const controls: Control[] = [
    "left",
    "right",
    "down",
    "jump",
    "dash",
    "block",
    "light",
    "heavy",
    "special",
    "super",
  ];
  for (const start of controls) {
    for (const destination of controls) {
      const { input, events } = tracker();
      input.press(1, start);
      input.move(1, destination);
      const protectedEntry =
        start !== destination &&
        (destination === "special" || destination === "super");
      assert.deepEqual(
        input.pressedControls(),
        new Set(protectedEntry ? [] : [destination]),
        `${start} → ${destination}`,
      );
      assert.deepEqual(
        events,
        start === destination
          ? [`+1:${start}`]
          : protectedEntry
            ? [`+1:${start}`, "-1"]
            : [`+1:${start}`, "-1", `+1:${destination}`],
      );
      input.release(1);
      assert.deepEqual(input.pressedControls(), new Set());
    }
  }
});

for (const ability of ["special", "super"] as const) {
  test(`${ability} needs a fresh press after leaving, cancellation, or energy depletion`, () => {
    const [gameInput] = makeInputs();
    const sources = new ControlSources(gameInput);
    const input = new TouchInputState(
      (pointer, control) => sources.press(`touch:${pointer}`, control),
      (pointer) => sources.release(`touch:${pointer}`),
    );
    input.press(1, "right");
    input.press(2, null); // Start in a gap or on an unavailable ability.
    input.move(2, ability);
    assert.equal(gameInput.actions[ability], 0);
    input.release(2);
    input.press(2, ability);
    for (let i = 0; i < 20; i++) input.move(2, ability);
    assert.equal(gameInput.actions[ability], 1);
    input.move(2, null);
    input.move(2, ability);
    assert.equal(gameInput.actions[ability], 1);
    assert.deepEqual(input.pressedControls(), new Set(["right"]));
    input.move(2, "block");
    assert.equal(gameInput.block, true);
    input.release(2);
    input.press(2, ability);
    input.releaseControl(ability);
    input.move(2, ability); // Regaining energy must not re-arm the same contact.
    assert.equal(gameInput.actions[ability], 2);
    assert.deepEqual(input.pressedControls(), new Set(["right"]));
    input.release(2);
    input.move(2, ability);
    assert.equal(gameInput.actions[ability], 2);
    input.press(3, ability);
    assert.equal(gameInput.actions[ability], 3);
    assert.equal(gameInput.right, true);
  });
}

test("combat slides release in gaps, re-enter, and fire once per entry", () => {
  const [gameInput] = makeInputs();
  const sources = new ControlSources(gameInput);
  const input = new TouchInputState(
    (pointer, control) => sources.press(`touch:${pointer}`, control),
    (pointer) => sources.release(`touch:${pointer}`),
  );
  input.press(1, "left");
  input.press(2, "block");
  input.move(2, "light");
  assert.equal(gameInput.left, true);
  assert.equal(gameInput.block, false);
  assert.equal(gameInput.actions.light, 1);
  for (let i = 0; i < 50; i++) input.move(2, "light");
  assert.equal(
    gameInput.actions.light,
    1,
    "motion inside a button must not repeat attacks",
  );
  input.move(2, null);
  assert.deepEqual(input.pressedControls(), new Set(["left"]));
  input.move(2, "heavy");
  input.move(2, "light");
  assert.equal(gameInput.actions.heavy, 1);
  assert.equal(gameInput.actions.light, 2);
  input.release(2);
  assert.equal(gameInput.left, true, "the other thumb keeps moving");
  input.release(1);
  assert.equal(gameInput.left, false);
});

test("spending energy releases an unavailable attack without ending the finger's slide", () => {
  const { input, events } = tracker();
  input.press(1, "special");
  input.press(2, "right");
  input.releaseControl("special");
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.equal(input.move(1, "block"), true);
  assert.deepEqual(input.pressedControls(), new Set(["right", "block"]));
  input.releaseAll();
  assert.deepEqual(events, [
    "+1:special",
    "+2:right",
    "-1",
    "+1:block",
    "-1",
    "-2",
  ]);
  assert.equal(
    input.move(1, "light"),
    false,
    "a cancelled gesture cannot restart from a move",
  );
});
